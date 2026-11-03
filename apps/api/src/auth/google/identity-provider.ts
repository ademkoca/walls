import { createHash } from 'node:crypto';
import type { AuthProvider } from '@walls/shared';

/** The account a provider vouches for after a successful sign-in on its screen. */
export interface ExternalIdentity {
  /** The provider's permanent user ID (Google's `sub`); emails can change, this cannot. */
  subject: string;
  email: string;
  emailVerified: boolean;
  /** The Google Workspace domain of the account (`hd`), if it belongs to one. */
  hostedDomain: string | null;
  name: string | null;
  /** Address of the profile picture, if the account has one. */
  picture: string | null;
}

/** Values bound to one sign-in round trip (OAuth `state`, OpenID `nonce`, PKCE). */
export interface AuthorizationRequest {
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}

export interface CodeExchange {
  code: string;
  redirectUri: string;
  codeVerifier: string;
  nonce: string;
}

/**
 * An external sign-in provider (SPEC §3.1). The rest of the API only sees this interface,
 * so Google can be replaced in tests and more providers can be added later.
 */
export interface IdentityProvider {
  readonly provider: AuthProvider;
  /** Where to send the browser to sign in. */
  authorizationUrl(request: AuthorizationRequest): string;
  /** Redeems the code from the callback. Throws when the provider cannot vouch for it. */
  exchangeCode(exchange: CodeExchange): Promise<ExternalIdentity>;
}

/** The PKCE S256 challenge of a verifier (RFC 7636). */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}
