import { AuthProvider } from '@walls/shared';
import { z } from 'zod';
import {
  type AuthorizationRequest,
  type CodeExchange,
  type ExternalIdentity,
  type IdentityProvider,
  pkceChallenge,
} from './identity-provider';

const fakeCodeSchema = z.object({
  identity: z.object({
    subject: z.string().min(1),
    email: z.string().min(1),
    emailVerified: z.boolean(),
    hostedDomain: z.string().nullable(),
    name: z.string().nullable(),
    picture: z.string().nullable(),
  }),
  nonce: z.string(),
  codeChallenge: z.string(),
});

/**
 * The "authorization code" the fake Google screen returns: the chosen account itself, bound
 * to the round trip's nonce and PKCE challenge so the API's checks are exercised as with
 * Google.
 */
export function fakeAuthorizationCode(
  identity: ExternalIdentity,
  nonce: string,
  codeChallenge: string,
): string {
  return Buffer.from(JSON.stringify({ identity, nonce, codeChallenge })).toString('base64url');
}

/**
 * A stand-in for Google in development and tests (GOOGLE_SIGN_IN_FAKE=on, never in
 * production): its "sign-in screen" is a form served by the API where any account can be
 * made up. Lets the E2E suite and local development use "Continue with Google" offline.
 */
export class FakeIdentityProvider implements IdentityProvider {
  readonly provider = AuthProvider.GOOGLE;

  /** `screenUrl`: the API's fake sign-in screen (see `fakeGoogleRoutes`). */
  constructor(private readonly screenUrl: string) {}

  authorizationUrl(request: AuthorizationRequest): string {
    const url = new URL(this.screenUrl);
    url.search = new URLSearchParams({
      redirect_uri: request.redirectUri,
      state: request.state,
      nonce: request.nonce,
      code_challenge: request.codeChallenge,
    }).toString();
    return url.toString();
  }

  exchangeCode(exchange: CodeExchange): Promise<ExternalIdentity> {
    return Promise.resolve().then(() => {
      const code = fakeCodeSchema.parse(
        JSON.parse(Buffer.from(exchange.code, 'base64url').toString('utf8')),
      );
      if (code.nonce !== exchange.nonce) throw new Error('Nonce does not match');
      if (code.codeChallenge !== pkceChallenge(exchange.codeVerifier)) {
        throw new Error('PKCE verifier does not match');
      }
      return code.identity;
    });
  }
}
