import { AuthProvider } from '@walls/shared';
import { z } from 'zod';
import type {
  AuthorizationRequest,
  CodeExchange,
  ExternalIdentity,
  IdentityProvider,
} from './identity-provider';

export const GOOGLE_AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
/** Only the account's identity: no access to the user's Google data. */
const SCOPES = 'openid email profile';
const REQUEST_TIMEOUT_MS = 10_000;
const CLOCK_SKEW_SECONDS = 60;
const MS_PER_SECOND = 1000;

const tokenResponseSchema = z.object({ id_token: z.string() });

const idTokenClaimsSchema = z.object({
  iss: z.string(),
  aud: z.string(),
  exp: z.number(),
  sub: z.string().min(1),
  nonce: z.string(),
  email: z.string().min(1),
  email_verified: z.boolean().default(false),
  hd: z.string().optional(),
  name: z.string().optional(),
  picture: z.string().optional(),
});

/** The claims of a JWT, without checking its signature (see `exchangeCode`). */
function decodeJwtClaims(jwt: string): unknown {
  const payload = jwt.split('.')[1];
  if (!payload) throw new Error('Google returned a malformed ID token');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

/**
 * Google sign-in with OpenID Connect: the authorization code flow with PKCE, a `nonce`, and
 * the client secret (SPEC §3.1). Uses `fetch` directly; no Google SDK.
 */
export class GoogleIdentityProvider implements IdentityProvider {
  readonly provider = AuthProvider.GOOGLE;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  authorizationUrl(request: AuthorizationRequest): string {
    const url = new URL(GOOGLE_AUTHORIZATION_URL);
    url.search = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: request.redirectUri,
      response_type: 'code',
      scope: SCOPES,
      state: request.state,
      nonce: request.nonce,
      code_challenge: request.codeChallenge,
      code_challenge_method: 'S256',
      // People with several Google accounts choose which one each time.
      prompt: 'select_account',
    }).toString();
    return url.toString();
  }

  /**
   * The ID token comes straight from Google's token endpoint over TLS, in exchange for the
   * code and the client secret, so TLS vouches for its issuer and its signature need not be
   * checked (OpenID Connect Core §3.1.3.7, step 6). Audience, expiry and nonce still are.
   */
  async exchangeCode(exchange: CodeExchange): Promise<ExternalIdentity> {
    const response = await this.fetchImpl(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: exchange.code,
        redirect_uri: exchange.redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code_verifier: exchange.codeVerifier,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Google token request failed with HTTP ${response.status}`);
    const { id_token: idToken } = tokenResponseSchema.parse(await response.json());
    const claims = idTokenClaimsSchema.parse(decodeJwtClaims(idToken));

    if (!GOOGLE_ISSUERS.has(claims.iss)) throw new Error('ID token from an unexpected issuer');
    if (claims.aud !== this.clientId) throw new Error('ID token for another client');
    if (claims.exp + CLOCK_SKEW_SECONDS < Date.now() / MS_PER_SECOND) {
      throw new Error('ID token has expired');
    }
    if (claims.nonce !== exchange.nonce) throw new Error('ID token nonce does not match');

    return {
      subject: claims.sub,
      email: claims.email,
      emailVerified: claims.email_verified,
      hostedDomain: claims.hd ?? null,
      name: claims.name?.trim() || null,
      picture: claims.picture ?? null,
    };
  }
}
