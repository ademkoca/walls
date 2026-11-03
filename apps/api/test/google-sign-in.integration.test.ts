import { randomUUID } from 'node:crypto';
import { auditLogs, profileChangeRequests, userIdentities, users } from '@walls/database';
import { type MyProfile, Role, SellerType } from '@walls/shared';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, describe, expect, it } from 'vitest';
import { AuthService } from '../src/auth/auth.service';
import { fakeGoogleScreenUrl } from '../src/auth/google/create-identity-provider';
import {
  FakeIdentityProvider,
  fakeAuthorizationCode,
} from '../src/auth/google/fake-identity-provider';
import { GoogleSignInService } from '../src/auth/google/google-sign-in.service';
import type { ExternalIdentity } from '../src/auth/google/identity-provider';
import { ProfilesService } from '../src/profiles/profiles.service';
import {
  PASSWORD,
  WEB_ORIGIN,
  createTestContext,
  errorOf,
  testConfig,
  testImage,
  tokenFrom,
  uniqueEmail,
  userOf,
} from './helpers';

const ctx = createTestContext();
afterAll(ctx.close);

const AUTH = '/api/v1/auth';
const GOOGLE = `${AUTH}/google`;

type Client = ReturnType<typeof ctx.client>;

const uniqueGmail = () => `${randomUUID()}@gmail.com`;

function googleAccount(overrides: Partial<ExternalIdentity> & { email: string }): ExternalIdentity {
  return {
    subject: `google-${overrides.email}`,
    emailVerified: true,
    hostedDomain: null,
    name: 'Ana Anić',
    picture: null,
    ...overrides,
  };
}

/**
 * One "Continue with Google" round trip through the fake Google: start, choose `account` on
 * the fake screen, come back. Returns the callback response (a redirect).
 */
async function continueWithGoogle(
  client: Client,
  account: ExternalIdentity,
  query: Record<string, string> = {},
) {
  const start = await client.get(`${GOOGLE}?${new URLSearchParams(query).toString()}`);
  expect(start.status).toBe(302);
  const screen = new URL(start.headers.location as string);
  const code = fakeAuthorizationCode(
    account,
    screen.searchParams.get('nonce')!,
    screen.searchParams.get('code_challenge')!,
  );
  const state = screen.searchParams.get('state')!;
  return client.get(`${GOOGLE}/callback?${new URLSearchParams({ code, state }).toString()}`);
}

const profileOf = (response: { body: unknown }) =>
  (response.body as { profile: MyProfile }).profile;

const locationOf = (response: { headers: Record<string, unknown> }) =>
  new URL(response.headers.location as string);

async function findUser(email: string) {
  const [user] = await ctx.db.select().from(users).where(eq(users.email, email));
  return user!;
}

async function googleIdentityOf(userId: string) {
  const [identity] = await ctx.db
    .select()
    .from(userIdentities)
    .where(eq(userIdentities.userId, userId));
  return identity;
}

async function isSignedIn(client: Client) {
  return (await client.get(`${AUTH}/me`)).status === 200;
}

/** A private seller created through Google, signed in, without a password. */
async function googleSeller(email = uniqueGmail()) {
  const client = ctx.client();
  const account = googleAccount({ email });
  await continueWithGoogle(client, account);
  const created = await client.post(`${GOOGLE}/register`, {
    displayName: 'Ana Anić',
    locale: 'sr',
  });
  expect(created.status).toBe(200);
  return { client, account, user: await findUser(email) };
}

async function registerWithPassword(email: string) {
  const response = await ctx.client().post(`${AUTH}/register`, {
    displayName: 'Ana Anić',
    email,
    password: PASSWORD,
    locale: 'sr',
  });
  expect(response.status).toBe(202);
}

async function verifiedPasswordSeller(email: string) {
  await registerWithPassword(email);
  await ctx
    .client()
    .post(`${AUTH}/verify-email`, { token: tokenFrom(await ctx.lastEmailTo(email)) });
}

describe('Google sign-in availability', () => {
  it('tells the web app that Google sign-in is configured', async () => {
    const response = await ctx.client().get(`${AUTH}/providers`);
    expect(response.body).toEqual({ google: true });
  });

  it('starts a round trip with state, nonce and PKCE, bound to a cookie', async () => {
    const start = await ctx.client().get(`${GOOGLE}?locale=en&next=/dashboard/listings`);
    const screen = locationOf(start);
    expect(screen.toString()).toContain(`${WEB_ORIGIN}/api/v1/auth/google/fake`);
    expect(screen.searchParams.get('redirect_uri')).toBe(
      `${WEB_ORIGIN}/api/v1/auth/google/callback`,
    );
    expect(screen.searchParams.get('state')).toMatch(/^[\w-]{43}$/);
    expect(screen.searchParams.get('nonce')).toMatch(/^[\w-]{43}$/);
    expect(screen.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/);
    expect(String(start.headers['set-cookie'])).toMatch(/walls_google=.*HttpOnly.*SameSite=Lax/);
  });

  it('refuses a return address outside the site', async () => {
    const response = await ctx.client().get(`${GOOGLE}?next=//evil.example`);
    expect(response.status).toBe(400);
  });
});

describe('a Google account without a Walls account (SPEC §3.1)', () => {
  it('goes to the choice page, which creates an active private seller without a password', async () => {
    const email = uniqueGmail();
    const client = ctx.client();
    const callback = await continueWithGoogle(client, googleAccount({ email }), { locale: 'en' });
    expect(locationOf(callback).pathname).toBe('/en/continue-with-google');
    expect(await isSignedIn(client)).toBe(false);

    const pending = await client.get(`${GOOGLE}/pending`);
    expect(pending.body).toEqual({ pending: { email, name: 'Ana Anić' } });

    const created = await client.post(`${GOOGLE}/register`, {
      displayName: 'Ana A.',
      locale: 'en',
    });
    expect(created.status).toBe(200);
    expect(userOf(created)).toMatchObject({
      email,
      role: 'PRIVATE_SELLER',
      sellerType: 'PRIVATE_SELLER',
      displayName: 'Ana A.',
      emailVerified: true,
    });
    expect(await isSignedIn(client)).toBe(true);

    const user = await findUser(email);
    expect(user).toMatchObject({ status: 'ACTIVE', passwordHash: null, preferredLocale: 'en' });
    expect(await googleIdentityOf(user.id)).toMatchObject({
      provider: 'GOOGLE',
      providerUserId: `google-${email}`,
    });
    const [audit] = await ctx.db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, user.id), eq(auditLogs.action, 'USER_REGISTERED')));
    expect(audit?.after).toMatchObject({ method: 'GOOGLE' });

    // The choice is used up.
    expect((await client.get(`${GOOGLE}/pending`)).body).toEqual({ pending: null });
  });

  it('never accepts a role, and never registers without a Google sign-in', async () => {
    const client = ctx.client();
    await continueWithGoogle(client, googleAccount({ email: uniqueGmail() }));
    const withRole = await client.post(`${GOOGLE}/register`, {
      displayName: 'Ana',
      locale: 'sr',
      role: 'REAL_ESTATE_AGENT',
    });
    expect(withRole.status).toBe(400);

    const without = await ctx.client().post(`${GOOGLE}/register`, {
      displayName: 'Ana',
      locale: 'sr',
    });
    expect(without.status).toBe(400);
    expect(errorOf(without).code).toBe('INVALID_TOKEN');
  });

  it('signs a connected account straight in, to the page it asked for', async () => {
    const { account } = await googleSeller();
    const client = ctx.client();
    const callback = await continueWithGoogle(client, account, { next: '/dashboard/listings' });
    expect(locationOf(callback).toString()).toBe(`${WEB_ORIGIN}/dashboard/listings`);
    expect(await isSignedIn(client)).toBe(true);
  });
});

describe('connecting Google to an existing account (SPEC §3.1)', () => {
  it('connects a Gmail account automatically, keeps the password and tells the owner', async () => {
    const email = uniqueGmail();
    await verifiedPasswordSeller(email);
    const client = ctx.client();

    const callback = await continueWithGoogle(client, googleAccount({ email }));
    expect(locationOf(callback).pathname).toBe('/dashboard');
    expect(await isSignedIn(client)).toBe(true);

    const user = await findUser(email);
    expect(user.passwordHash).not.toBeNull();
    expect(await googleIdentityOf(user.id)).toBeDefined();
    expect((await ctx.lastEmailTo(email))?.subject).toMatch(
      /^Google prijava je dodata Vašem nalogu/,
    );
    expect((await ctx.client().post(`${AUTH}/login`, { email, password: PASSWORD })).status).toBe(
      200,
    );
  });

  it('connects a Google Workspace account of its own domain automatically', async () => {
    const email = `${randomUUID()}@agencija.example`;
    await verifiedPasswordSeller(email);
    const callback = await continueWithGoogle(
      ctx.client(),
      googleAccount({ email, hostedDomain: 'agencija.example' }),
    );
    expect(locationOf(callback).pathname).toBe('/dashboard');
  });

  it('asks another provider’s address to confirm by email before connecting', async () => {
    const email = uniqueEmail();
    await verifiedPasswordSeller(email);
    const account = googleAccount({ email });
    const client = ctx.client();

    const callback = await continueWithGoogle(client, account);
    expect(locationOf(callback).toString()).toBe(`${WEB_ORIGIN}/login?google=link-sent`);
    expect(await isSignedIn(client)).toBe(false);
    const user = await findUser(email);
    expect(await googleIdentityOf(user.id)).toBeUndefined();

    const message = await ctx.lastEmailTo(email);
    expect(message?.subject).toMatch(/^Povežite Google nalog/);
    expect(message?.text).toContain('/connect-google?token=');
    const token = tokenFrom(message);
    expect((await ctx.client().post(`${GOOGLE}/confirm-link`, { token })).status).toBe(204);
    expect((await ctx.client().post(`${GOOGLE}/confirm-link`, { token })).status).toBe(400);

    expect(await googleIdentityOf(user.id)).toBeDefined();
    const again = await continueWithGoogle(client, account);
    expect(locationOf(again).pathname).toBe('/dashboard');
    expect(await isSignedIn(client)).toBe(true);
  });

  it('verifies an unverified registration and removes the password its registrant chose', async () => {
    const email = uniqueGmail();
    await registerWithPassword(email);
    const verificationToken = tokenFrom(await ctx.lastEmailTo(email));

    const callback = await continueWithGoogle(ctx.client(), googleAccount({ email }));
    expect(locationOf(callback).pathname).toBe('/dashboard');

    const user = await findUser(email);
    expect(user.status).toBe('ACTIVE');
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.passwordHash).toBeNull();
    expect((await ctx.client().post(`${AUTH}/login`, { email, password: PASSWORD })).status).toBe(
      401,
    );
    expect(
      (await ctx.client().post(`${AUTH}/verify-email`, { token: verificationToken })).status,
    ).toBe(400);
  });

  it('refuses a second Google account for an account that already has one', async () => {
    const { user } = await googleSeller();
    const callback = await continueWithGoogle(
      ctx.client(),
      googleAccount({ email: user.email, subject: `other-${randomUUID()}` }),
    );
    expect(locationOf(callback).searchParams.get('google')).toBe('other-google-account');
  });
});

describe('refused Google sign-ins', () => {
  it('refuses a deactivated account', async () => {
    const { user, account } = await googleSeller();
    const admin = await ctx.signedInUser(Role.ADMIN);
    await admin.client.post(`/api/v1/users/${user.id}/deactivate`, { reason: 'Zloupotreba.' });

    const callback = await continueWithGoogle(ctx.client(), account);
    expect(locationOf(callback).searchParams.get('google')).toBe('deactivated');
  });

  it('refuses an address Google has not verified', async () => {
    const callback = await continueWithGoogle(
      ctx.client(),
      googleAccount({ email: uniqueGmail(), emailVerified: false }),
    );
    expect(locationOf(callback).searchParams.get('google')).toBe('email-not-verified');
  });

  it('explains a cancelled sign-in, and fails a callback without its round trip', async () => {
    const client = ctx.client();
    const start = await client.get(`${GOOGLE}?locale=en`);
    const state = locationOf(start).searchParams.get('state')!;
    const cancelled = await client.get(`${GOOGLE}/callback?error=access_denied&state=${state}`);
    expect(locationOf(cancelled).toString()).toBe(`${WEB_ORIGIN}/en/login?google=cancelled`);

    const account = googleAccount({ email: uniqueGmail() });
    const forged = await ctx
      .client()
      .get(
        `${GOOGLE}/callback?${new URLSearchParams({ code: fakeAuthorizationCode(account, 'n', 'c'), state: 'guess' }).toString()}`,
      );
    expect(locationOf(forged).toString()).toBe(`${WEB_ORIGIN}/login?google=failed`);
  });

  it('fails when the state does not match the browser’s round trip', async () => {
    const client = ctx.client();
    const start = await client.get(GOOGLE);
    const screen = locationOf(start);
    const code = fakeAuthorizationCode(
      googleAccount({ email: uniqueGmail() }),
      screen.searchParams.get('nonce')!,
      screen.searchParams.get('code_challenge')!,
    );
    const callback = await client.get(`${GOOGLE}/callback?code=${code}&state=other`);
    expect(locationOf(callback).searchParams.get('google')).toBe('failed');
  });
});

describe('setting up an invited account with Google (SPEC §3.1)', () => {
  const auth = new AuthService(ctx.db, testConfig);

  async function invitedAgency() {
    const email = uniqueEmail();
    await auth.inviteUser(
      {
        email,
        displayName: 'Agencija Kuća',
        role: Role.REAL_ESTATE_AGENT,
        sellerType: SellerType.AGENCY,
        locale: 'sr',
      },
      null,
    );
    return { email, token: tokenFrom(await ctx.lastEmailTo(email)) };
  }

  it('activates the account with the Google account of its address, and uses up the link', async () => {
    const { email, token } = await invitedAgency();
    const client = ctx.client();
    // Not a Google-hosted address: the setup link proves the mailbox instead.
    const callback = await continueWithGoogle(client, googleAccount({ email }), {
      intent: 'setup',
      token,
    });
    expect(locationOf(callback).pathname).toBe('/dashboard');
    expect(await isSignedIn(client)).toBe(true);
    expect(await findUser(email)).toMatchObject({
      status: 'ACTIVE',
      role: 'REAL_ESTATE_AGENT',
      sellerType: 'AGENCY',
      passwordHash: null,
    });

    const reuse = await ctx
      .client()
      .post(`${AUTH}/setup-account`, { token, password: 'another long password' });
    expect(reuse.status).toBe(400);
  });

  it('refuses a Google account with another address', async () => {
    const { token } = await invitedAgency();
    const callback = await continueWithGoogle(
      ctx.client(),
      googleAccount({ email: uniqueGmail() }),
      { intent: 'setup', token },
    );
    const back = locationOf(callback);
    expect(back.pathname).toBe('/setup-account');
    expect(back.searchParams.get('token')).toBe(token);
    expect(back.searchParams.get('google')).toBe('wrong-account');
  });
});

describe('changing the email of an account without a password (SPEC §3.1)', () => {
  it('reports the sign-in methods on the profile', async () => {
    const { client } = await googleSeller();
    const response = await client.get('/api/v1/me/profile');
    expect(profileOf(response)).toMatchObject({ hasPassword: false, googleConnected: true });
  });

  it('needs a fresh confirmation with the connected Google account', async () => {
    const { client, account } = await googleSeller();
    const newEmail = uniqueEmail();

    const before = await client.post('/api/v1/me/email-change', { newEmail });
    expect(before.status).toBe(403);
    expect(errorOf(before).code).toBe('REAUTHENTICATION_REQUIRED');

    const otherAccount = await continueWithGoogle(
      client,
      googleAccount({ email: uniqueGmail(), subject: `other-${randomUUID()}` }),
      { intent: 'reauthenticate', next: '/dashboard/profile' },
    );
    expect(locationOf(otherAccount).searchParams.get('google')).toBe('wrong-account');
    expect((await client.post('/api/v1/me/email-change', { newEmail })).status).toBe(403);

    const confirmed = await continueWithGoogle(client, account, {
      intent: 'reauthenticate',
      next: '/dashboard/profile',
    });
    expect(locationOf(confirmed).toString()).toBe(
      `${WEB_ORIGIN}/dashboard/profile?google=reauthenticated`,
    );
    const after = await client.post('/api/v1/me/email-change', { newEmail });
    expect(after.status).toBe(200);
    expect(profileOf(after).pendingEmail).toBe(newEmail);
  });

  it('still needs the password from accounts that have one', async () => {
    const { client } = await ctx.signedInUser();
    const response = await client.post('/api/v1/me/email-change', { newEmail: uniqueEmail() });
    expect(response.status).toBe(400);
  });
});

describe('reactivating an account without a password', () => {
  it('returns a Google-only account to active', async () => {
    const { user, account } = await googleSeller();
    const superAdmin = await ctx.signedInUser(Role.SUPER_ADMIN);
    await superAdmin.client.post(`/api/v1/users/${user.id}/deactivate`, { reason: 'Provera.' });
    await superAdmin.client.post(`/api/v1/users/${user.id}/reactivate`, { reason: 'U redu.' });

    expect((await findUser(user.email)).status).toBe('ACTIVE');
    const callback = await continueWithGoogle(ctx.client(), account);
    expect(locationOf(callback).pathname).toBe('/dashboard');
  });
});

describe('the Google profile picture (SPEC §3.1)', () => {
  const logger = pino({ level: 'silent' });
  const auth = new AuthService(ctx.db, testConfig);
  const profiles = new ProfilesService(ctx.db, auth, ctx.media, logger);
  const PICTURE = 'https://lh3.googleusercontent.com/a/ACg8oc-photo=s96-c';

  async function serviceServingPicture() {
    const picture = await testImage({ width: 600, height: 600 });
    const requested: string[] = [];
    const fetchImpl: typeof fetch = (input) => {
      requested.push(input instanceof URL ? input.href : (input as string));
      return Promise.resolve(new Response(new Uint8Array(picture)));
    };
    const service = new GoogleSignInService(
      ctx.db,
      testConfig,
      auth,
      profiles,
      new FakeIdentityProvider(fakeGoogleScreenUrl(WEB_ORIGIN)),
      logger,
      fetchImpl,
    );
    return { service, requested };
  }

  it('becomes a new private seller’s profile picture, copied into Walls’ storage', async () => {
    const { service, requested } = await serviceServingPicture();
    const email = uniqueGmail();
    await service.register(
      { identity: googleAccount({ email, picture: PICTURE }), locale: 'sr' },
      { displayName: 'Ana Anić', locale: 'sr' },
      {},
    );
    expect(requested).toEqual(['https://lh3.googleusercontent.com/a/ACg8oc-photo=s512-c']);
    const user = await findUser(email);
    expect(user.avatarUrl).not.toBeNull();
    expect(user.avatarUrl).not.toContain('googleusercontent');
  });

  it('waits for Admin approval on a professional’s profile, like any picture change', async () => {
    const { service } = await serviceServingPicture();
    const email = uniqueEmail();
    await auth.inviteUser(
      {
        email,
        displayName: 'Marko Marković',
        role: Role.REAL_ESTATE_AGENT,
        sellerType: SellerType.REAL_ESTATE_AGENT,
        locale: 'sr',
      },
      null,
    );
    const token = tokenFrom(await ctx.lastEmailTo(email));
    const { roundTrip, authorizationUrl } = service.start({
      intent: 'setup',
      locale: 'sr',
      token,
    });
    const screen = new URL(authorizationUrl);
    const code = fakeAuthorizationCode(
      googleAccount({ email, picture: PICTURE }),
      screen.searchParams.get('nonce')!,
      screen.searchParams.get('code_challenge')!,
    );
    const result = await service.finish({ code, state: roundTrip.state }, roundTrip, null, {});
    expect(result.session).toBeDefined();

    const user = await findUser(email);
    expect(user.avatarUrl).toBeNull();
    const [request] = await ctx.db
      .select()
      .from(profileChangeRequests)
      .where(eq(profileChangeRequests.userId, user.id));
    expect(request).toMatchObject({ status: 'PENDING' });
    expect(request?.avatarUrl).not.toBeNull();
  });

  it('ignores pictures that are not Google’s', async () => {
    const { service, requested } = await serviceServingPicture();
    const email = uniqueGmail();
    await service.register(
      {
        identity: googleAccount({ email, picture: 'https://evil.example/photo.jpg' }),
        locale: 'sr',
      },
      { displayName: 'Ana Anić', locale: 'sr' },
      {},
    );
    expect(requested).toEqual([]);
    expect((await findUser(email)).avatarUrl).toBeNull();
  });
});
