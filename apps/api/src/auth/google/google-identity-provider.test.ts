import { describe, expect, it } from 'vitest';
import { GoogleIdentityProvider } from './google-identity-provider';

const CLIENT_ID = 'walls-client.apps.googleusercontent.com';
const NONCE = 'nonce-123';
const EXCHANGE = {
  code: 'code-from-google',
  redirectUri: 'https://walls.rs/api/v1/auth/google/callback',
  codeVerifier: 'verifier',
  nonce: NONCE,
};

const urlOf = (input: Parameters<typeof fetch>[0]) =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** An unsigned JWT: the provider relies on TLS to the token endpoint, not the signature. */
function idToken(claims: Record<string, unknown>): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'RS256' })}.${part(claims)}.signature`;
}

const GOOD_CLAIMS = {
  iss: 'https://accounts.google.com',
  aud: CLIENT_ID,
  exp: nowSeconds() + 3600,
  sub: '1234567890',
  nonce: NONCE,
  email: 'ana@gmail.com',
  email_verified: true,
  name: 'Ana Anić',
  picture: 'https://lh3.googleusercontent.com/a/photo=s96-c',
};

function providerAnswering(claims: Record<string, unknown>, status = 200) {
  const requests: { url: string; body: URLSearchParams }[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    requests.push({ url: urlOf(input), body: init?.body as URLSearchParams });
    return Promise.resolve(new Response(JSON.stringify({ id_token: idToken(claims) }), { status }));
  };
  return { provider: new GoogleIdentityProvider(CLIENT_ID, 'secret', fetchImpl), requests };
}

describe('Google identity provider (SPEC §3.1)', () => {
  it('asks only for the identity, with PKCE and account selection', () => {
    const url = new URL(
      providerAnswering(GOOD_CLAIMS).provider.authorizationUrl({
        redirectUri: EXCHANGE.redirectUri,
        state: 'state-1',
        nonce: NONCE,
        codeChallenge: 'challenge',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: CLIENT_ID,
      redirect_uri: EXCHANGE.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: 'state-1',
      nonce: NONCE,
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
  });

  it('redeems the code with the PKCE verifier and returns the account', async () => {
    const { provider, requests } = providerAnswering({ ...GOOD_CLAIMS, hd: undefined });
    await expect(provider.exchangeCode(EXCHANGE)).resolves.toEqual({
      subject: '1234567890',
      email: 'ana@gmail.com',
      emailVerified: true,
      hostedDomain: null,
      name: 'Ana Anić',
      picture: 'https://lh3.googleusercontent.com/a/photo=s96-c',
    });
    expect(requests[0]!.url).toBe('https://oauth2.googleapis.com/token');
    expect(Object.fromEntries(requests[0]!.body)).toMatchObject({
      grant_type: 'authorization_code',
      code: 'code-from-google',
      code_verifier: 'verifier',
      client_id: CLIENT_ID,
      client_secret: 'secret',
    });
  });

  it.each([
    ['another issuer', { iss: 'https://evil.example' }],
    ['another client', { aud: 'someone-else' }],
    ['an expired token', { exp: nowSeconds() - 3600 }],
    ['another nonce', { nonce: 'replayed' }],
  ])('refuses an ID token from %s', async (_case, override) => {
    const { provider } = providerAnswering({ ...GOOD_CLAIMS, ...override });
    await expect(provider.exchangeCode(EXCHANGE)).rejects.toThrow();
  });

  it('treats a missing email_verified claim as unverified', async () => {
    const { provider } = providerAnswering({ ...GOOD_CLAIMS, email_verified: undefined });
    await expect(provider.exchangeCode(EXCHANGE)).resolves.toMatchObject({
      emailVerified: false,
    });
  });

  it('fails when Google refuses the code', async () => {
    const { provider } = providerAnswering(GOOD_CLAIMS, 400);
    await expect(provider.exchangeCode(EXCHANGE)).rejects.toThrow(/400/);
  });
});
