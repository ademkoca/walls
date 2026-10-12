import { auditLogs, authTokens, userSessions, users } from '@walls/database';
import { and, eq } from 'drizzle-orm';
import supertest from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { AuthService } from '../src/auth/auth.service';
import {
  PASSWORD,
  WEB_ORIGIN,
  createTestContext,
  errorOf,
  testConfig,
  tokenFrom,
  uniqueEmail,
  userOf,
} from './helpers';

const ctx = createTestContext();
afterAll(ctx.close);

const AUTH = '/api/v1/auth';

async function register(email: string, password = PASSWORD) {
  return ctx
    .client()
    .post(`${AUTH}/register`, { displayName: 'Ana Anić', email, password, locale: 'sr' });
}

/** Registers, verifies the email and returns a logged-in client. */
async function verifiedSeller(email = uniqueEmail()) {
  await register(email);
  const client = ctx.client();
  await client.post(`${AUTH}/verify-email`, { token: tokenFrom(await ctx.lastEmailTo(email)) });
  const login = await client.post(`${AUTH}/login`, { email, password: PASSWORD });
  expect(login.status).toBe(200);
  return { email, client };
}

async function findUser(email: string) {
  const [user] = await ctx.db.select().from(users).where(eq(users.email, email));
  return user!;
}

describe('registration (SPEC §3)', () => {
  it('creates an unverified private seller and emails a Serbian verification link', async () => {
    const email = uniqueEmail();
    const response = await register(email);
    expect(response.status).toBe(202);

    const user = await findUser(email);
    expect(user).toMatchObject({
      role: 'PRIVATE_SELLER',
      status: 'PENDING_VERIFICATION',
      displayName: 'Ana Anić',
      preferredLocale: 'sr',
      emailVerifiedAt: null,
    });
    expect(user.slug).toMatch(/^ana-anic(-\d+)?$/);
    expect(user.passwordHash).toMatch(/^scrypt\$/);

    const message = await ctx.lastEmailTo(email);
    expect(message?.subject).toBe('Potvrdite svoju email adresu – Walls');
    expect(message?.text).toContain(`${WEB_ORIGIN}/verify-email?token=`);
  });

  it('sends English emails with /en links to English registrations', async () => {
    const email = uniqueEmail();
    await ctx.client().post(`${AUTH}/register`, {
      displayName: 'John Smith',
      email,
      password: PASSWORD,
      locale: 'en',
    });
    const message = await ctx.lastEmailTo(email);
    expect(message?.subject).toBe('Confirm your email address – Walls');
    expect(message?.text).toContain(`${WEB_ORIGIN}/en/verify-email?token=`);
  });

  it('cannot self-assign the agent role', async () => {
    const response = await ctx.client().post(`${AUTH}/register`, {
      displayName: 'Mallory',
      email: uniqueEmail(),
      password: PASSWORD,
      locale: 'sr',
      role: 'REAL_ESTATE_AGENT',
    });
    expect(response.status).toBe(400);
    expect(errorOf(response).code).toBe('VALIDATION_FAILED');
  });

  it('gives the same response for an existing account and emails its owner instead', async () => {
    const { email } = await verifiedSeller();
    const response = await register(email, 'a different password');
    expect(response.status).toBe(202);
    expect((await ctx.lastEmailTo(email))?.subject).toBe('Već imate nalog – Walls');
  });

  it('never lets a repeat registration change the password of a pending account', async () => {
    const email = uniqueEmail();
    await register(email, PASSWORD);
    await register(email, 'attacker chosen password');
    const client = ctx.client();
    await client.post(`${AUTH}/verify-email`, { token: tokenFrom(await ctx.lastEmailTo(email)) });

    expect(
      (await client.post(`${AUTH}/login`, { email, password: 'attacker chosen password' })).status,
    ).toBe(401);
    expect((await client.post(`${AUTH}/login`, { email, password: PASSWORD })).status).toBe(200);
  });

  it('gives each user a unique public slug', async () => {
    const [first, second] = [uniqueEmail(), uniqueEmail()];
    await register(first);
    await register(second);
    expect((await findUser(first)).slug).not.toBe((await findUser(second)).slug);
  });
});

describe('email verification', () => {
  it('activates the account, audits it, and works only once', async () => {
    const email = uniqueEmail();
    await register(email);
    const token = tokenFrom(await ctx.lastEmailTo(email));

    expect((await ctx.client().post(`${AUTH}/verify-email`, { token })).status).toBe(204);
    const user = await findUser(email);
    expect(user.status).toBe('ACTIVE');
    expect(user.emailVerifiedAt).not.toBeNull();

    const audit = await ctx.db
      .select({ action: auditLogs.action })
      .from(auditLogs)
      .where(eq(auditLogs.entityId, user.id));
    expect(audit.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(['USER_REGISTERED', 'USER_EMAIL_VERIFIED']),
    );

    const reuse = await ctx.client().post(`${AUTH}/verify-email`, { token });
    expect(reuse.status).toBe(400);
    expect(errorOf(reuse).code).toBe('INVALID_TOKEN');
  });

  it('only accepts the newest link after a resend', async () => {
    const email = uniqueEmail();
    await register(email);
    const oldToken = tokenFrom(await ctx.lastEmailTo(email));
    expect((await ctx.client().post(`${AUTH}/resend-verification`, { email })).status).toBe(202);
    const newToken = tokenFrom(await ctx.lastEmailTo(email));

    expect((await ctx.client().post(`${AUTH}/verify-email`, { token: oldToken })).status).toBe(400);
    expect((await ctx.client().post(`${AUTH}/verify-email`, { token: newToken })).status).toBe(204);
  });

  it('rejects expired links', async () => {
    const email = uniqueEmail();
    await register(email);
    const token = tokenFrom(await ctx.lastEmailTo(email));
    const user = await findUser(email);
    await ctx.db
      .update(authTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(authTokens.userId, user.id));

    expect((await ctx.client().post(`${AUTH}/verify-email`, { token })).status).toBe(400);
  });
});

describe('login and sessions', () => {
  it('refuses unverified accounts, after checking the password', async () => {
    const email = uniqueEmail();
    await register(email);
    const wrongPassword = await ctx
      .client()
      .post(`${AUTH}/login`, { email, password: 'wrong password' });
    expect(wrongPassword.status).toBe(401);

    const response = await ctx.client().post(`${AUTH}/login`, { email, password: PASSWORD });
    expect(response.status).toBe(403);
    expect(errorOf(response).code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('answers unknown emails exactly like wrong passwords', async () => {
    const { email } = await verifiedSeller();
    const wrong = await ctx.client().post(`${AUTH}/login`, { email, password: 'wrong password' });
    const unknown = await ctx
      .client()
      .post(`${AUTH}/login`, { email: uniqueEmail(), password: PASSWORD });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
  });

  it('sets an HttpOnly, SameSite=Lax session cookie and never returns the password hash', async () => {
    const email = uniqueEmail();
    await register(email);
    await ctx
      .client()
      .post(`${AUTH}/verify-email`, { token: tokenFrom(await ctx.lastEmailTo(email)) });

    const response = await ctx.client().post(`${AUTH}/login`, { email, password: PASSWORD });
    expect(response.status).toBe(200);
    const cookie = String(response.headers['set-cookie']);
    expect(cookie).toMatch(/^walls_session=[\w-]{43};/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(JSON.stringify(response.body)).not.toContain('scrypt');
    expect(userOf(response)).toMatchObject({
      email,
      role: 'PRIVATE_SELLER',
      emailVerified: true,
    });
  });

  it('stores only a hash of the session token', async () => {
    const { email } = await verifiedSeller();
    const user = await findUser(email);
    const response = await ctx.client().post(`${AUTH}/login`, { email, password: PASSWORD });
    const token = /walls_session=([\w-]+)/.exec(String(response.headers['set-cookie']))?.[1];
    const sessions = await ctx.db
      .select()
      .from(userSessions)
      .where(eq(userSessions.userId, user.id));
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.map((session) => session.tokenHash)).not.toContain(token);
  });

  it('returns the current user until logout', async () => {
    const { email, client } = await verifiedSeller();
    const me = await client.get(`${AUTH}/me`);
    expect(me.status).toBe(200);
    expect(userOf(me).email).toBe(email);

    expect((await client.post(`${AUTH}/logout`)).status).toBe(204);
    const after = await client.get(`${AUTH}/me`);
    expect(after.status).toBe(401);
    expect(errorOf(after).code).toBe('UNAUTHENTICATED');
  });

  it('ends existing sessions and blocks login when an account is deactivated', async () => {
    const { email, client } = await verifiedSeller();
    await ctx.db
      .update(users)
      .set({ status: 'DEACTIVATED', deactivatedAt: new Date() })
      .where(eq(users.email, email));

    expect((await client.get(`${AUTH}/me`)).status).toBe(401);
    const login = await ctx.client().post(`${AUTH}/login`, { email, password: PASSWORD });
    expect(login.status).toBe(403);
    expect(errorOf(login).code).toBe('ACCOUNT_DEACTIVATED');
  });

  it('rejects expired sessions', async () => {
    const { email, client } = await verifiedSeller();
    const user = await findUser(email);
    await ctx.db
      .update(userSessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(userSessions.userId, user.id));
    expect((await client.get(`${AUTH}/me`)).status).toBe(401);
  });
});

describe('password reset', () => {
  it('sets a new password, signs out every session and notifies the user', async () => {
    const { email, client } = await verifiedSeller();
    expect((await ctx.client().post(`${AUTH}/forgot-password`, { email })).status).toBe(202);
    const message = await ctx.lastEmailTo(email);
    expect(message?.subject).toBe('Resetovanje lozinke – Walls');

    const newPassword = 'a brand new passphrase';
    const token = tokenFrom(message);
    expect(
      (await ctx.client().post(`${AUTH}/reset-password`, { token, password: newPassword })).status,
    ).toBe(204);

    expect((await client.get(`${AUTH}/me`)).status).toBe(401);
    expect((await ctx.client().post(`${AUTH}/login`, { email, password: PASSWORD })).status).toBe(
      401,
    );
    expect(
      (await ctx.client().post(`${AUTH}/login`, { email, password: newPassword })).status,
    ).toBe(200);
    expect((await ctx.lastEmailTo(email))?.subject).toBe('Lozinka je promenjena – Walls');
    expect(
      (
        await ctx
          .client()
          .post(`${AUTH}/reset-password`, { token, password: 'yet another passphrase' })
      ).status,
    ).toBe(400);
  });

  it('responds the same for unknown emails and sends nothing', async () => {
    const email = uniqueEmail();
    expect((await ctx.client().post(`${AUTH}/forgot-password`, { email })).status).toBe(202);
    expect(await ctx.lastEmailTo(email)).toBeUndefined();
  });

  it('rejects a weak new password', async () => {
    const { email } = await verifiedSeller();
    await ctx.client().post(`${AUTH}/forgot-password`, { email });
    const token = tokenFrom(await ctx.lastEmailTo(email));
    const response = await ctx
      .client()
      .post(`${AUTH}/reset-password`, { token, password: 'short' });
    expect(response.status).toBe(400);
  });
});

describe('invited account setup', () => {
  it('activates an invited Super Admin once they set a password from the emailed link', async () => {
    const email = uniqueEmail();
    await new AuthService(ctx.db, testConfig).inviteUser(
      { email, displayName: 'Super Admin', role: 'SUPER_ADMIN', locale: 'en' },
      null,
    );
    const message = await ctx.lastEmailTo(email);
    expect(message?.subject).toBe('Set up your account – Walls');
    expect((await ctx.client().post(`${AUTH}/login`, { email, password: PASSWORD })).status).toBe(
      401,
    );

    const client = ctx.client();
    expect(
      (
        await client.post(`${AUTH}/setup-account`, {
          token: tokenFrom(message),
          password: PASSWORD,
        })
      ).status,
    ).toBe(204);
    expect((await client.post(`${AUTH}/login`, { email, password: PASSWORD })).status).toBe(200);
    expect(userOf(await client.get(`${AUTH}/me`))).toMatchObject({
      role: 'SUPER_ADMIN',
      emailVerified: true,
    });
  });

  it('refuses to invite an email that already has an account', async () => {
    const { email } = await verifiedSeller();
    await expect(
      new AuthService(ctx.db, testConfig).inviteUser(
        { email, displayName: 'Dup', role: 'SUPER_ADMIN', locale: 'sr' },
        null,
      ),
    ).rejects.toThrow('already belongs to an account');
  });
});

describe('request protection', () => {
  it('rejects state-changing requests without an allowed Origin (CSRF)', async () => {
    const body = { email: uniqueEmail(), password: PASSWORD };
    const noOrigin = await supertest(ctx.app).post(`${AUTH}/login`).send(body);
    expect(noOrigin.status).toBe(403);
    expect(errorOf(noOrigin).code).toBe('ORIGIN_NOT_ALLOWED');

    const evil = await supertest(ctx.app)
      .post(`${AUTH}/login`)
      .set('Origin', 'https://evil.example')
      .send(body);
    expect(evil.status).toBe(403);
  });

  it('allows safe requests without an Origin', async () => {
    expect((await supertest(ctx.app).get(`${AUTH}/me`)).status).toBe(401);
  });

  it('throttles repeated failed logins for the same email', async () => {
    const limited = createTestContext({
      rateLimits: {
        perIp: { windowMs: 60_000, limit: 100 },
        failedLogins: { windowMs: 60_000, limit: 2 },
      },
    });
    try {
      const client = limited.client();
      const attempt = { email: uniqueEmail(), password: 'wrong password' };
      expect((await client.post(`${AUTH}/login`, attempt)).status).toBe(401);
      expect((await client.post(`${AUTH}/login`, attempt)).status).toBe(401);
      const blocked = await client.post(`${AUTH}/login`, attempt);
      expect(blocked.status).toBe(429);
      expect(errorOf(blocked).code).toBe('RATE_LIMITED');
    } finally {
      await limited.close();
    }
  });

  it('returns consistent errors for malformed JSON and unknown routes', async () => {
    const malformed = await supertest(ctx.app)
      .post(`${AUTH}/login`)
      .set('Origin', WEB_ORIGIN)
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(malformed.status).toBe(400);
    expect(errorOf(malformed).code).toBe('INVALID_JSON');

    const missing = await supertest(ctx.app).get('/api/v1/nope');
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  });

  it('reports validation problems with field paths', async () => {
    const response = await ctx.client().post(`${AUTH}/register`, {
      displayName: 'A',
      email: 'nope',
      password: 'short',
      locale: 'sr',
    });
    expect(response.status).toBe(400);
    const paths = (errorOf(response).details as { path: string[] }[]).map((issue) => issue.path[0]);
    expect(paths).toEqual(expect.arrayContaining(['displayName', 'email', 'password']));
  });
});

describe('email outbox', () => {
  it('clears payloads once sent, so emailed links are not kept in the database', async () => {
    const email = uniqueEmail();
    await register(email);
    await ctx.lastEmailTo(email);
    const { emailOutbox } = await import('@walls/database');
    const rows = await ctx.db
      .select()
      .from(emailOutbox)
      .where(and(eq(emailOutbox.recipientEmail, email), eq(emailOutbox.status, 'SENT')));
    expect(rows.length).toBe(1);
    expect(rows[0]?.payload).toBeNull();
  });
});
