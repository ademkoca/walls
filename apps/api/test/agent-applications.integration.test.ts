import { agentApplications, users } from '@walls/database';
import {
  type AgentApplicationDetail,
  type AgentApplicationSummary,
  type Page,
  Role,
  type UserDetail,
} from '@walls/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { PASSWORD, createTestContext, errorOf, testImage, tokenFrom, uniqueEmail } from './helpers';

const ctx = createTestContext();
afterAll(ctx.close);

const APPLICATIONS = '/api/v1/agent-applications';
const PDF = Buffer.from('%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\ntrailer\n%%EOF\n');

const applicationOf = (response: { body: unknown }) =>
  (response.body as { application: AgentApplicationDetail }).application;

function fields(email: string, overrides: Record<string, string> = {}) {
  return {
    sellerType: 'REAL_ESTATE_AGENT',
    fullName: 'Marko Marković',
    email,
    phone: '+381 64 123 4567',
    agencyName: 'Kvadrat nekretnine',
    locale: 'sr',
    ...overrides,
  };
}

async function apply(
  email = uniqueEmail(),
  files: { data: Buffer; name: string }[] = [{ data: PDF, name: 'licenca.pdf' }],
  overrides: Record<string, string> = {},
) {
  const response = await ctx.client().multipart(APPLICATIONS, fields(email, overrides), files);
  return { email, response };
}

async function pendingApplicationFor(email: string) {
  const [row] = await ctx.db
    .select()
    .from(agentApplications)
    .where(and(eq(agentApplications.email, email), eq(agentApplications.status, 'PENDING')));
  return row;
}

/** Collects a binary response body (supertest only parses text and JSON by default). */
function binary(response: unknown, done: (error: Error | null, body: Buffer) => void) {
  const stream = response as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  stream.on('end', () => done(null, Buffer.concat(chunks)));
}

describe('submitting an agent application (SPEC §2.1)', () => {
  it('stores the details and private proof files, and confirms by email', async () => {
    const image = await testImage({ format: 'png', width: 800, height: 600 });
    const { email, response } = await apply(uniqueEmail(), [
      { data: PDF, name: 'licenca.pdf' },
      { data: image, name: 'članska karta.png' },
    ]);
    expect(response.status).toBe(202);

    const stored = await pendingApplicationFor(email);
    expect(stored).toMatchObject({
      status: 'PENDING',
      sellerType: 'REAL_ESTATE_AGENT',
      agencyName: 'Kvadrat nekretnine',
    });
    expect((await ctx.lastEmailTo(email))?.subject).toContain('Primili smo Vašu prijavu');

    const admin = await ctx.signedInUser(Role.ADMIN);
    const detail = applicationOf(await admin.client.get(`${APPLICATIONS}/${stored!.id}`));
    expect(detail.files.map((file) => [file.fileName, file.mimeType])).toEqual([
      ['licenca.pdf', 'application/pdf'],
      ['članska karta.png', 'image/png'],
    ]);

    const download = await admin.client
      .get(`${APPLICATIONS}/${stored!.id}/files/${detail.files[0]!.id}`)
      .buffer(true)
      .parse(binary);
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toBe('application/pdf');
    expect(download.headers['cache-control']).toBe('private, no-store');
    expect(Buffer.from(download.body as Buffer).equals(PDF)).toBe(true);
  });

  it('is for an agent, agency or investor; only agents name the agency they work for', async () => {
    const agency = await apply(uniqueEmail(), undefined, {
      sellerType: 'AGENCY',
      fullName: 'Kvadrat nekretnine',
    });
    expect(agency.response.status).toBe(202);
    expect(await pendingApplicationFor(agency.email)).toMatchObject({
      sellerType: 'AGENCY',
      fullName: 'Kvadrat nekretnine',
      agencyName: null,
    });

    for (const sellerType of ['PRIVATE_SELLER', 'SUPER_ADMIN', '']) {
      const refused = await apply(uniqueEmail(), undefined, { sellerType });
      expect(refused.response.status, sellerType).toBe(400);
      expect(await pendingApplicationFor(refused.email)).toBeUndefined();
    }
  });

  it('keeps proof files and applications away from everyone but admins', async () => {
    const { email } = await apply();
    const stored = await pendingApplicationFor(email);
    const admin = await ctx.signedInUser(Role.ADMIN);
    const [file] = applicationOf(await admin.client.get(`${APPLICATIONS}/${stored!.id}`)).files;
    const fileUrl = `${APPLICATIONS}/${stored!.id}/files/${file!.id}`;

    expect((await ctx.client().get(fileUrl)).status).toBe(401);
    expect((await ctx.client().get(APPLICATIONS)).status).toBe(401);
    for (const role of [Role.PRIVATE_SELLER, Role.REAL_ESTATE_AGENT]) {
      const { client } = await ctx.signedInUser(role);
      expect((await client.get(fileUrl)).status).toBe(403);
      expect((await client.get(APPLICATIONS)).status).toBe(403);
      expect((await client.post(`${APPLICATIONS}/${stored!.id}/approve`)).status).toBe(403);
    }
  });

  it('checks proof files by content, not by name', async () => {
    const email = uniqueEmail();
    const fake = await ctx
      .client()
      .multipart(APPLICATIONS, fields(email), [
        { data: Buffer.from('not really a pdf'), name: 'dokaz.pdf' },
      ]);
    expect(fake.status).toBe(422);
    expect(errorOf(fake)).toMatchObject({
      code: 'INVALID_FILE',
      details: { files: [{ name: 'dokaz.pdf', issues: ['UNSUPPORTED_TYPE'] }] },
    });

    const storedFiles = ctx.privateFiles.files.size;
    const webp = await testImage({ format: 'webp' });
    const unsupported = await ctx.client().multipart(APPLICATIONS, fields(email), [
      { data: PDF, name: 'ok.pdf' },
      { data: webp, name: 'dokaz.png' },
    ]);
    expect(errorOf(unsupported).code).toBe('INVALID_FILE');
    // Every file is checked before any is stored.
    expect(ctx.privateFiles.files.size).toBe(storedFiles);
    expect(await pendingApplicationFor(email)).toBeUndefined();
  });

  it('requires at least one proof file and refuses a role or unknown fields', async () => {
    const email = uniqueEmail();
    const noFiles = await ctx.client().multipart(APPLICATIONS, fields(email), []);
    expect(errorOf(noFiles)).toMatchObject({ code: 'VALIDATION_FAILED' });

    const withRole = await ctx
      .client()
      .multipart(APPLICATIONS, fields(email, { role: 'SUPER_ADMIN' }), [
        { data: PDF, name: 'a.pdf' },
      ]);
    expect(withRole.status).toBe(400);
    expect(await pendingApplicationFor(email)).toBeUndefined();
  });

  it('does not reveal registered emails: it answers the same and explains by email', async () => {
    const { user } = await ctx.signedInUser();
    const { response } = await apply(user.email);
    expect(response.status).toBe(202);
    expect(await pendingApplicationFor(user.email)).toBeUndefined();
    expect((await ctx.lastEmailTo(user.email))?.text).toContain('već pripada nalogu');
  });

  it('keeps a single open application per email address', async () => {
    const { email } = await apply();
    const { response } = await apply(email);
    expect(response.status).toBe(202);
    expect((await ctx.lastEmailTo(email))?.subject).toContain('već u obradi');
    const rows = await ctx.db
      .select()
      .from(agentApplications)
      .where(eq(agentApplications.email, email));
    expect(rows).toHaveLength(1);
  });
});

describe('reviewing agent applications (SPEC §2.1)', () => {
  it('lists pending applications oldest first', async () => {
    const first = await apply();
    const second = await apply();
    const admin = await ctx.signedInUser(Role.ADMIN);
    const page = (await admin.client.get(`${APPLICATIONS}?status=PENDING`))
      .body as Page<AgentApplicationSummary>;
    const emails = page.items.map((item) => item.email);
    expect(emails.indexOf(first.email)).toBeLessThan(emails.indexOf(second.email));
  });

  it('approval creates the agent account, which the applicant activates from the email', async () => {
    const { email } = await apply();
    const stored = await pendingApplicationFor(email);
    const admin = await ctx.signedInUser(Role.SUPER_ADMIN);

    const approved = applicationOf(
      await admin.client.post(`${APPLICATIONS}/${stored!.id}/approve`),
    );
    expect(approved).toMatchObject({
      status: 'APPROVED',
      canReview: false,
      reviewedBy: { id: admin.user.id },
      resultingUser: { displayName: 'Marko Marković' },
    });

    const [agent] = await ctx.db.select().from(users).where(eq(users.email, email));
    expect(agent).toMatchObject({
      role: 'REAL_ESTATE_AGENT',
      sellerType: 'REAL_ESTATE_AGENT',
      status: 'PENDING_SETUP',
      phone: '+381 64 123 4567',
      agencyName: 'Kvadrat nekretnine',
      phoneVerificationStatus: 'UNVERIFIED',
      passwordHash: null,
    });

    const setupEmail = await ctx.lastEmailTo(email);
    expect(setupEmail?.subject).toContain('odobrena');
    const applicant = ctx.client();
    expect(
      (
        await applicant.post('/api/v1/auth/setup-account', {
          token: tokenFrom(setupEmail),
          password: PASSWORD,
        })
      ).status,
    ).toBe(204);
    const login = await applicant.post('/api/v1/auth/login', { email, password: PASSWORD });
    expect(login.body).toMatchObject({ user: { role: 'REAL_ESTATE_AGENT', emailVerified: true } });

    const again = await admin.client.post(`${APPLICATIONS}/${stored!.id}/approve`);
    expect(errorOf(again).code).toBe('INVALID_STATE');

    // The proof stays available to admins from the agent's account, as evidence of eligibility.
    const account = (await admin.client.get(`/api/v1/users/${agent!.id}`)).body as {
      user: UserDetail;
    };
    expect(account.user.agentApplication).toMatchObject({
      id: stored!.id,
      files: [{ fileName: 'licenca.pdf', mimeType: 'application/pdf' }],
    });
    const fileId = account.user.agentApplication!.files[0]!.id;
    expect((await admin.client.get(`${APPLICATIONS}/${stored!.id}/files/${fileId}`)).status).toBe(
      200,
    );
  });

  it('approval creates an investor or agency account of the kind applied for', async () => {
    const admin = await ctx.signedInUser(Role.ADMIN);
    for (const sellerType of ['INVESTOR', 'AGENCY'] as const) {
      const { email } = await apply(uniqueEmail(), undefined, {
        sellerType,
        fullName: 'Gradnja Pazar',
      });
      const stored = await pendingApplicationFor(email);
      const detail = applicationOf(await admin.client.get(`${APPLICATIONS}/${stored!.id}`));
      expect(detail).toMatchObject({ sellerType, agencyName: null });

      await admin.client.post(`${APPLICATIONS}/${stored!.id}/approve`);
      const [account] = await ctx.db.select().from(users).where(eq(users.email, email));
      expect(account).toMatchObject({
        role: 'REAL_ESTATE_AGENT',
        sellerType,
        displayName: 'Gradnja Pazar',
        agencyName: null,
        status: 'PENDING_SETUP',
      });
    }
  });

  it('cannot approve when the email has meanwhile been registered', async () => {
    const { email } = await apply();
    const stored = await pendingApplicationFor(email);
    await ctx.client().post('/api/v1/auth/register', {
      displayName: 'Neko Drugi',
      email,
      password: PASSWORD,
      locale: 'sr',
    });
    const admin = await ctx.signedInUser(Role.ADMIN);
    expect(applicationOf(await admin.client.get(`${APPLICATIONS}/${stored!.id}`)).emailInUse).toBe(
      true,
    );
    const response = await admin.client.post(`${APPLICATIONS}/${stored!.id}/approve`);
    expect(errorOf(response).code).toBe('EMAIL_IN_USE');
  });

  it('rejection needs a reason, which is emailed; no account is created', async () => {
    const { email } = await apply();
    const stored = await pendingApplicationFor(email);
    const admin = await ctx.signedInUser(Role.ADMIN);

    expect((await admin.client.post(`${APPLICATIONS}/${stored!.id}/reject`, {})).status).toBe(400);
    const rejected = applicationOf(
      await admin.client.post(`${APPLICATIONS}/${stored!.id}/reject`, {
        reason: 'Dokaz nije čitljiv.',
      }),
    );
    expect(rejected).toMatchObject({ status: 'REJECTED', rejectionReason: 'Dokaz nije čitljiv.' });
    expect((await ctx.lastEmailTo(email))?.text).toContain('Dokaz nije čitljiv.');
    expect(await ctx.db.select().from(users).where(eq(users.email, email))).toEqual([]);

    // The applicant may apply again after a rejection.
    expect((await apply(email)).response.status).toBe(202);
    expect((await pendingApplicationFor(email))?.status).toBe('PENDING');
  });
});
