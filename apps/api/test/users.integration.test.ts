import { users } from '@walls/database';
import {
  type AuditLogEntry,
  type Page,
  Role,
  type UserDetail,
  type UserSummary,
} from '@walls/shared';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { PASSWORD, createTestContext, errorOf, uniqueEmail } from './helpers';

const ctx = createTestContext();
afterAll(ctx.close);

const USERS = '/api/v1/users';
const userOf = (response: { body: unknown }) => (response.body as { user: UserDetail }).user;
const pageOf = <T>(response: { body: unknown }) => response.body as Page<T>;

describe('listing users (SPEC §2.1)', () => {
  it('lets admins search users by name or email and filter by role', async () => {
    const admin = await ctx.signedInUser(Role.ADMIN);
    const agent = await ctx.signedInUser(Role.REAL_ESTATE_AGENT);

    const byEmail = pageOf<UserSummary>(
      await admin.client.get(`${USERS}?q=${encodeURIComponent(agent.user.email)}`),
    );
    expect(byEmail.items.map((user) => user.id)).toEqual([agent.user.id]);

    const agents = pageOf<UserSummary>(
      await admin.client.get(`${USERS}?role=REAL_ESTATE_AGENT&status=ACTIVE`),
    );
    expect(agents.items.every((user) => user.role === 'REAL_ESTATE_AGENT')).toBe(true);
    expect(agents.items[0]).not.toHaveProperty('passwordHash');
  });

  it('is closed to sellers and agents', async () => {
    for (const role of [Role.PRIVATE_SELLER, Role.REAL_ESTATE_AGENT]) {
      const { client } = await ctx.signedInUser(role);
      expect((await client.get(USERS)).status).toBe(403);
    }
  });
});

describe('deactivation and reactivation (SPEC §2.1)', () => {
  it('signs the user out, blocks login, emails the reason and audits it', async () => {
    const admin = await ctx.signedInUser(Role.ADMIN);
    const seller = await ctx.signedInUser();

    expect((await admin.client.post(`${USERS}/${seller.user.id}/deactivate`, {})).status).toBe(400);
    const response = await admin.client.post(`${USERS}/${seller.user.id}/deactivate`, {
      reason: 'Lažni oglasi.',
    });
    expect(userOf(response)).toMatchObject({
      status: 'DEACTIVATED',
      permissions: { canDeactivate: false, canReactivate: true },
    });

    expect((await seller.client.get('/api/v1/auth/me')).status).toBe(401);
    const login = await ctx
      .client()
      .post('/api/v1/auth/login', { email: seller.user.email, password: PASSWORD });
    expect(errorOf(login).code).toBe('ACCOUNT_DEACTIVATED');

    const email = await ctx.lastEmailTo(seller.user.email);
    expect(email?.text).toContain('Lažni oglasi.');

    const audit = pageOf<AuditLogEntry>(
      await admin.client.get(`/api/v1/audit-log?entityType=USER&entityId=${seller.user.id}`),
    );
    expect(audit.items[0]).toMatchObject({
      action: 'USER_DEACTIVATED',
      reason: 'Lažni oglasi.',
      actor: { id: admin.user.id, displayName: admin.user.displayName },
    });
  });

  it('reactivates with a reason, and the user can sign in again', async () => {
    const admin = await ctx.signedInUser(Role.ADMIN);
    const seller = await ctx.signedInUser();
    await admin.client.post(`${USERS}/${seller.user.id}/deactivate`, { reason: 'Provera.' });

    const response = await admin.client.post(`${USERS}/${seller.user.id}/reactivate`, {
      reason: 'Provera je završena.',
    });
    expect(userOf(response).status).toBe('ACTIVE');
    const email = await ctx.lastEmailTo(seller.user.email);
    expect(email?.subject).toContain('ponovo aktivan');

    const login = await ctx
      .client()
      .post('/api/v1/auth/login', { email: seller.user.email, password: PASSWORD });
    expect(login.status).toBe(200);
  });

  it('follows the role rules: admins cannot touch admins; nobody deactivates themselves or Super Admins', async () => {
    const admin = await ctx.signedInUser(Role.ADMIN);
    const otherAdmin = await ctx.signedInUser(Role.ADMIN);
    const superAdmin = await ctx.signedInUser(Role.SUPER_ADMIN);
    const reason = { reason: 'Test.' };

    expect(
      (await admin.client.post(`${USERS}/${otherAdmin.user.id}/deactivate`, reason)).status,
    ).toBe(403);
    expect((await admin.client.post(`${USERS}/${admin.user.id}/deactivate`, reason)).status).toBe(
      403,
    );
    expect(
      (await superAdmin.client.post(`${USERS}/${superAdmin.user.id}/deactivate`, reason)).status,
    ).toBe(403);
    const otherSuperAdmin = await ctx.signedInUser(Role.SUPER_ADMIN);
    expect(
      (await superAdmin.client.post(`${USERS}/${otherSuperAdmin.user.id}/deactivate`, reason))
        .status,
    ).toBe(403);

    expect(
      (await superAdmin.client.post(`${USERS}/${otherAdmin.user.id}/deactivate`, reason)).status,
    ).toBe(200);
  });

  it('cannot deactivate twice or reactivate an active account', async () => {
    const admin = await ctx.signedInUser(Role.ADMIN);
    const seller = await ctx.signedInUser();
    const reason = { reason: 'Test.' };
    expect((await admin.client.post(`${USERS}/${seller.user.id}/reactivate`, reason)).status).toBe(
      409,
    );
    await admin.client.post(`${USERS}/${seller.user.id}/deactivate`, reason);
    expect((await admin.client.post(`${USERS}/${seller.user.id}/deactivate`, reason)).status).toBe(
      409,
    );
  });
});

describe('inviting admins (SPEC §2.1)', () => {
  it('lets a Super Admin invite an Admin, who receives an account-setup link', async () => {
    const superAdmin = await ctx.signedInUser(Role.SUPER_ADMIN);
    const email = uniqueEmail();
    const response = await superAdmin.client.post(`${USERS}/admins`, {
      email,
      displayName: 'Nova Administratorka',
      locale: 'en',
    });
    expect(response.status).toBe(201);
    expect(userOf(response)).toMatchObject({ role: 'ADMIN', status: 'PENDING_SETUP' });
    expect((await ctx.lastEmailTo(email))?.text).toContain('/en/setup-account?token=');
  });

  it('does not let Admins invite Admins, or anyone pick another role', async () => {
    const admin = await ctx.signedInUser(Role.ADMIN);
    const superAdmin = await ctx.signedInUser(Role.SUPER_ADMIN);
    const input = { email: uniqueEmail(), displayName: 'Neko', locale: 'sr' };
    expect((await admin.client.post(`${USERS}/admins`, input)).status).toBe(403);
    expect(
      (await superAdmin.client.post(`${USERS}/admins`, { ...input, role: 'SUPER_ADMIN' })).status,
    ).toBe(400);
  });

  it('refuses an email that already has an account', async () => {
    const superAdmin = await ctx.signedInUser(Role.SUPER_ADMIN);
    const seller = await ctx.signedInUser();
    const response = await superAdmin.client.post(`${USERS}/admins`, {
      email: seller.user.email,
      displayName: 'Duplikat',
      locale: 'sr',
    });
    expect(response.status).toBe(409);
    const [row] = await ctx.db.select().from(users).where(eq(users.id, seller.user.id));
    expect(row?.role).toBe('PRIVATE_SELLER');
  });
});

describe('audit log', () => {
  it('is readable by admins only', async () => {
    const admin = await ctx.signedInUser(Role.ADMIN);
    const seller = await ctx.signedInUser();
    expect((await admin.client.get('/api/v1/audit-log')).status).toBe(200);
    expect((await seller.client.get('/api/v1/audit-log')).status).toBe(403);
  });
});
