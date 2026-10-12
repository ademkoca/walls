import { profileChangeRequests, users } from '@walls/database';
import {
  type AuditLogEntry,
  type MyProfile,
  type Page,
  type ProfileChangeRequestDetail,
  Role,
} from '@walls/shared';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { PASSWORD, createTestContext, errorOf, testImage, tokenFrom, uniqueEmail } from './helpers';

const ctx = createTestContext();
afterAll(ctx.close);

const PROFILE = '/api/v1/me/profile';
const CHANGES = '/api/v1/profile-changes';

const profileOf = (response: { body: unknown }) =>
  (response.body as { profile: MyProfile }).profile;
const requestOf = (response: { body: unknown }) =>
  (response.body as { request: ProfileChangeRequestDetail }).request;

const profileInput = {
  displayName: 'Marko Marković',
  bio: 'Prodajem stanove na Vračaru.',
  agencyName: 'Kvadrat nekretnine',
  phone: '+381 64 123 4567',
  isPhonePublic: false,
  isEmailPublic: true,
};

async function agentWithPhone() {
  const agent = await ctx.signedInUser(Role.REAL_ESTATE_AGENT);
  await ctx.db.update(users).set({ phone: '+381 64 000 0000' }).where(eq(users.id, agent.user.id));
  return agent;
}

async function pendingRequestsOf(userId: string) {
  return ctx.db
    .select()
    .from(profileChangeRequests)
    .where(eq(profileChangeRequests.userId, userId));
}

describe('private seller profile (SPEC §4)', () => {
  it('applies changes immediately, audits them, and drops an agency name', async () => {
    const seller = await ctx.signedInUser();
    const profile = profileOf(await seller.client.put(PROFILE, profileInput));
    expect(profile).toMatchObject({
      changesRequireApproval: false,
      changeRequest: null,
      publicPath: `/sellers/${seller.user.slug}`,
      live: {
        displayName: 'Marko Marković',
        bio: 'Prodajem stanove na Vračaru.',
        agencyName: null,
        phone: '+381 64 123 4567',
        isPhonePublic: false,
        isEmailPublic: true,
      },
    });

    const admin = await ctx.signedInUser(Role.ADMIN);
    const audit = (
      await admin.client.get(`/api/v1/audit-log?entityType=USER&entityId=${seller.user.id}`)
    ).body as Page<AuditLogEntry>;
    expect(audit.items[0]).toMatchObject({
      action: 'USER_PROFILE_UPDATED',
      before: { displayName: seller.user.displayName },
      after: { displayName: 'Marko Marković' },
    });
  });

  it('replaces the profile picture and deletes the old file', async () => {
    const seller = await ctx.signedInUser();
    const avatar = await testImage({ width: 400, height: 400 });
    const first = profileOf(await seller.client.upload(`${PROFILE}/avatar`, avatar));
    expect(first.live.avatarUrl).toMatch(/^https:\/\/media\.test\/avatars\//);
    const firstKey = first.live.avatarUrl!.replace('https://media.test/', '');

    const second = profileOf(await seller.client.upload(`${PROFILE}/avatar`, avatar));
    expect(second.live.avatarUrl).not.toBe(first.live.avatarUrl);
    await expect.poll(() => ctx.media.files.has(firstKey)).toBe(false);

    const removed = profileOf(await seller.client.delete(`${PROFILE}/avatar`));
    expect(removed.live.avatarUrl).toBeNull();
  });

  it('checks profile pictures by content and size', async () => {
    const seller = await ctx.signedInUser();
    const tiny = await testImage({ width: 150, height: 150 });
    const response = await seller.client.upload(`${PROFILE}/avatar`, tiny);
    expect(errorOf(response)).toMatchObject({
      code: 'INVALID_IMAGE',
      details: { issues: ['DIMENSIONS_TOO_SMALL'] },
    });
    const text = await seller.client.upload(`${PROFILE}/avatar`, Buffer.from('hello'), 'a.jpg');
    expect(errorOf(text).code).toBe('INVALID_IMAGE');
  });

  it('never accepts a phone verification status from the user', async () => {
    const seller = await ctx.signedInUser();
    const response = await seller.client.put(PROFILE, {
      ...profileInput,
      phoneVerificationStatus: 'VERIFIED',
    });
    expect(response.status).toBe(400);
  });

  it('is only for sellers and agents', async () => {
    const admin = await ctx.signedInUser(Role.ADMIN);
    expect((await admin.client.get(PROFILE)).status).toBe(403);
    expect((await ctx.client().get(PROFILE)).status).toBe(401);
  });
});

describe('agent profile changes need approval (SPEC §4)', () => {
  it('keeps one pending request that further edits update, while the live profile stays', async () => {
    const agent = await agentWithPhone();
    const first = profileOf(await agent.client.put(PROFILE, profileInput));
    expect(first.live.displayName).toBe(agent.user.displayName);
    expect(first.changeRequest).toMatchObject({
      status: 'PENDING',
      proposed: { displayName: 'Marko Marković', isPhonePublic: true },
      changes: ['DISPLAY_NAME', 'BIO', 'AGENCY_NAME', 'PHONE', 'EMAIL_PUBLIC'],
    });

    const avatar = await testImage({ width: 400, height: 400 });
    const second = profileOf(await agent.client.upload(`${PROFILE}/avatar`, avatar));
    expect(second.live.avatarUrl).toBeNull();
    expect(second.changeRequest?.proposed.avatarUrl).toMatch(/^https:\/\/media\.test\//);
    expect(await pendingRequestsOf(agent.user.id)).toHaveLength(1);
  });

  it('withdraws the request when the edits match the live profile again', async () => {
    const agent = await agentWithPhone();
    await agent.client.put(PROFILE, { ...profileInput, phone: '+381 64 000 0000' });
    const reverted = profileOf(
      await agent.client.put(PROFILE, {
        displayName: agent.user.displayName,
        bio: '',
        agencyName: '',
        phone: '+381 64 000 0000',
        isPhonePublic: true,
        isEmailPublic: false,
      }),
    );
    expect(reverted.changeRequest).toBeNull();
    expect(await pendingRequestsOf(agent.user.id)).toEqual([]);
  });

  it('requires agents to keep a phone number', async () => {
    const agent = await agentWithPhone();
    const response = await agent.client.put(PROFILE, { ...profileInput, phone: '' });
    expect(errorOf(response)).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('lets the agent discard pending changes', async () => {
    const agent = await agentWithPhone();
    await agent.client.put(PROFILE, profileInput);
    const discarded = profileOf(await agent.client.delete(`${PROFILE}/change-request`));
    expect(discarded.changeRequest).toBeNull();
  });

  it('publishes approved changes, resets the phone status and emails the agent', async () => {
    const agent = await agentWithPhone();
    await ctx.db
      .update(users)
      .set({ phoneVerificationStatus: 'VERIFIED' })
      .where(eq(users.id, agent.user.id));
    const pending = profileOf(await agent.client.put(PROFILE, profileInput)).changeRequest!;

    const admin = await ctx.signedInUser(Role.ADMIN);
    const detail = requestOf(await admin.client.get(`${CHANGES}/${pending.id}`));
    expect(detail).toMatchObject({
      canReview: true,
      live: { displayName: agent.user.displayName },
      proposed: { displayName: 'Marko Marković' },
    });

    const approved = requestOf(await admin.client.post(`${CHANGES}/${pending.id}/approve`));
    expect(approved).toMatchObject({ status: 'APPROVED', canReview: false });
    const [stored] = await ctx.db.select().from(users).where(eq(users.id, agent.user.id));
    expect(stored).toMatchObject({
      displayName: 'Marko Marković',
      agencyName: 'Kvadrat nekretnine',
      phone: '+381 64 123 4567',
      phoneVerificationStatus: 'UNVERIFIED',
      isPhonePublic: true,
    });
    expect((await ctx.lastEmailTo(agent.user.email))?.subject).toContain('odobrene');
  });

  it('keeps the live profile on rejection, emails the reason and deletes a proposed picture', async () => {
    const agent = await agentWithPhone();
    const avatar = await testImage({ width: 400, height: 400 });
    const proposed = profileOf(await agent.client.upload(`${PROFILE}/avatar`, avatar));
    const key = proposed.changeRequest!.proposed.avatarUrl!.replace('https://media.test/', '');

    const admin = await ctx.signedInUser(Role.SUPER_ADMIN);
    expect(
      (await admin.client.post(`${CHANGES}/${proposed.changeRequest!.id}/reject`, {})).status,
    ).toBe(400);
    await admin.client.post(`${CHANGES}/${proposed.changeRequest!.id}/reject`, {
      reason: 'Fotografija nije profesionalna.',
    });

    const after = profileOf(await agent.client.get(PROFILE));
    expect(after.live.avatarUrl).toBeNull();
    expect(after.changeRequest).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Fotografija nije profesionalna.',
    });
    expect((await ctx.lastEmailTo(agent.user.email))?.text).toContain(
      'Fotografija nije profesionalna.',
    );
    await expect.poll(() => ctx.media.files.has(key)).toBe(false);
  });

  it('is reviewed by admins only', async () => {
    const agent = await agentWithPhone();
    const pending = profileOf(await agent.client.put(PROFILE, profileInput)).changeRequest!;
    expect((await agent.client.get(CHANGES)).status).toBe(403);
    expect((await agent.client.post(`${CHANGES}/${pending.id}/approve`)).status).toBe(403);
  });
});

describe('changing the sign-in email (SPEC §3–4)', () => {
  it('needs the current password and an address nobody uses', async () => {
    const seller = await ctx.signedInUser();
    const other = await ctx.signedInUser();
    const wrong = await seller.client.post('/api/v1/me/email-change', {
      newEmail: uniqueEmail(),
      currentPassword: 'wrong password',
    });
    expect(errorOf(wrong).code).toBe('INVALID_CREDENTIALS');

    const taken = await seller.client.post('/api/v1/me/email-change', {
      newEmail: other.user.email,
      currentPassword: PASSWORD,
    });
    expect(errorOf(taken).code).toBe('EMAIL_IN_USE');
  });

  it('changes a seller email once the new address is confirmed, and tells the old one', async () => {
    const seller = await ctx.signedInUser();
    const newEmail = uniqueEmail();
    const requested = profileOf(
      await seller.client.post('/api/v1/me/email-change', {
        newEmail,
        currentPassword: PASSWORD,
      }),
    );
    expect(requested).toMatchObject({ email: seller.user.email, pendingEmail: newEmail });

    const confirm = await ctx.client().post('/api/v1/auth/confirm-email-change', {
      token: tokenFrom(await ctx.lastEmailTo(newEmail)),
    });
    expect(confirm.body).toEqual({ awaitingApproval: false });
    expect((await ctx.lastEmailTo(seller.user.email))?.text).toContain(newEmail);

    const login = await ctx.client().post('/api/v1/auth/login', {
      email: newEmail,
      password: PASSWORD,
    });
    expect(login.status).toBe(200);
  });

  it("adds an agent's confirmed address to their change request for approval", async () => {
    const agent = await agentWithPhone();
    const newEmail = uniqueEmail();
    await agent.client.post('/api/v1/me/email-change', { newEmail, currentPassword: PASSWORD });
    const confirm = await ctx.client().post('/api/v1/auth/confirm-email-change', {
      token: tokenFrom(await ctx.lastEmailTo(newEmail)),
    });
    expect(confirm.body).toEqual({ awaitingApproval: true });

    const pending = profileOf(await agent.client.get(PROFILE));
    expect(pending).toMatchObject({
      email: agent.user.email,
      changeRequest: { newEmail, changes: ['EMAIL'] },
    });

    const admin = await ctx.signedInUser(Role.ADMIN);
    await admin.client.post(`${CHANGES}/${pending.changeRequest!.id}/approve`);
    const [stored] = await ctx.db.select().from(users).where(eq(users.id, agent.user.id));
    expect(stored?.email).toBe(newEmail);
    expect((await ctx.lastEmailTo(agent.user.email))?.text).toContain(newEmail);
  });

  it('lets the user cancel a change before confirming it', async () => {
    const seller = await ctx.signedInUser();
    const newEmail = uniqueEmail();
    await seller.client.post('/api/v1/me/email-change', { newEmail, currentPassword: PASSWORD });
    const token = tokenFrom(await ctx.lastEmailTo(newEmail));
    const cancelled = profileOf(await seller.client.delete('/api/v1/me/email-change'));
    expect(cancelled.pendingEmail).toBeNull();
    const confirm = await ctx.client().post('/api/v1/auth/confirm-email-change', { token });
    expect(errorOf(confirm).code).toBe('INVALID_TOKEN');
  });
});
