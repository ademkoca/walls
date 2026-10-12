import { users } from '@walls/database';
import { type Page, type PublicAgentSummary, type PublicProfilePage, Role } from '@walls/shared';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createTestContext } from './helpers';
import { LISTINGS, submittedListing } from './listing-fixtures';

const ctx = createTestContext();
afterAll(ctx.close);

const pageOf = (response: { body: unknown }) => response.body as PublicProfilePage;

async function setProfile(userId: string, values: Partial<typeof users.$inferInsert>) {
  await ctx.db.update(users).set(values).where(eq(users.id, userId));
}

async function publishedListing(owner: Awaited<ReturnType<typeof ctx.signedInUser>>) {
  const id = await submittedListing(owner.client);
  const admin = await ctx.signedInUser(Role.ADMIN);
  expect((await admin.client.post(`${LISTINGS}/${id}/approve`)).status).toBe(200);
  return { id, admin };
}

describe('public seller profiles (SPEC §19)', () => {
  it('shows only the contact details the seller made public, with the phone status', async () => {
    const seller = await ctx.signedInUser();
    await setProfile(seller.user.id, { phone: '+381 64 123 4567', bio: 'Zdravo!' });

    const hidden = pageOf(await ctx.client().get(`/api/v1/public/sellers/${seller.user.slug}`));
    expect(hidden.profile).toMatchObject({ phone: null, email: null, approvedAgent: false });
    expect(hidden.profile).not.toHaveProperty('status');
    expect(JSON.stringify(hidden)).not.toContain(seller.user.email);

    await setProfile(seller.user.id, { isPhonePublic: true, isEmailPublic: true });
    const shown = pageOf(await ctx.client().get(`/api/v1/public/sellers/${seller.user.slug}`));
    expect(shown.profile).toMatchObject({
      bio: 'Zdravo!',
      email: seller.user.email,
      phone: { phone: '+381 64 123 4567', verificationStatus: 'UNVERIFIED' },
    });
  });

  it('lists the seller’s published listings only', async () => {
    const seller = await ctx.signedInUser();
    const { id } = await publishedListing(seller);
    await submittedListing(seller.client); // still in review: not public

    const page = pageOf(await ctx.client().get(`/api/v1/public/sellers/${seller.user.slug}`));
    expect(page.listings.map((listing) => listing.id)).toEqual([id]);
    expect(page.listings[0]).toMatchObject({
      title: { sr: 'Trosoban stan na Vračaru', en: null },
      propertyType: 'APARTMENT',
      transactionType: 'SALE',
    });
    expect(page.listings[0]?.coverImageUrl).toMatch(/^https:\/\/media\.test\//);
  });

  it('is not found for deactivated users, admins, or the wrong profile type', async () => {
    const seller = await ctx.signedInUser();
    const admin = await ctx.signedInUser(Role.ADMIN);
    expect((await ctx.client().get(`/api/v1/public/agents/${seller.user.slug}`)).status).toBe(404);
    expect((await ctx.client().get(`/api/v1/public/sellers/${admin.user.slug}`)).status).toBe(404);

    await admin.client.post(`/api/v1/users/${seller.user.id}/deactivate`, { reason: 'Prevara.' });
    expect((await ctx.client().get(`/api/v1/public/sellers/${seller.user.slug}`)).status).toBe(404);
  });
});

describe('public agent profiles (SPEC §19)', () => {
  it('always shows the agent phone with its status, and marks the agent approved', async () => {
    const agent = await ctx.signedInUser(Role.REAL_ESTATE_AGENT);
    await setProfile(agent.user.id, {
      phone: '+381 11 222 3333',
      agencyName: 'Kvadrat',
      isPhonePublic: false,
    });
    const page = pageOf(await ctx.client().get(`/api/v1/public/agents/${agent.user.slug}`));
    expect(page.profile).toMatchObject({
      approvedAgent: true,
      agencyName: 'Kvadrat',
      phone: { phone: '+381 11 222 3333', verificationStatus: 'UNVERIFIED' },
      email: null,
    });
  });

  it('lists listings the agent created and listings assigned to them', async () => {
    const agent = await ctx.signedInUser(Role.REAL_ESTATE_AGENT);
    const own = await publishedListing(agent);
    const seller = await ctx.signedInUser();
    const assigned = await publishedListing(seller);
    await assigned.admin.client.put(`${LISTINGS}/${assigned.id}/assignment`, {
      agentId: agent.user.id,
    });

    const page = pageOf(await ctx.client().get(`/api/v1/public/agents/${agent.user.slug}`));
    expect(page.listings.map((listing) => listing.id).sort()).toEqual([own.id, assigned.id].sort());

    const directory = (await ctx.client().get('/api/v1/public/agents'))
      .body as Page<PublicAgentSummary>;
    expect(directory.items.find((item) => item.slug === agent.user.slug)?.listingCount).toBe(2);
  });

  it('hides listings of a deactivated creator even when assigned to the agent', async () => {
    const agent = await ctx.signedInUser(Role.REAL_ESTATE_AGENT);
    const seller = await ctx.signedInUser();
    const assigned = await publishedListing(seller);
    await assigned.admin.client.put(`${LISTINGS}/${assigned.id}/assignment`, {
      agentId: agent.user.id,
    });
    await assigned.admin.client.post(`/api/v1/users/${seller.user.id}/deactivate`, {
      reason: 'Prevara.',
    });
    const page = pageOf(await ctx.client().get(`/api/v1/public/agents/${agent.user.slug}`));
    expect(page.listings).toEqual([]);
  });
});
