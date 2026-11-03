import type { Config } from '../../config';
import type { Logger } from '../../logger';
import { FakeIdentityProvider } from './fake-identity-provider';
import { GoogleIdentityProvider } from './google-identity-provider';
import type { IdentityProvider } from './identity-provider';

/** Path of the Google round trip's endpoints, under the API's /api/v1 prefix. */
export const GOOGLE_ROUTES_PATH = '/auth/google';
const API_PREFIX = '/api/v1';

/**
 * Browsers reach the API through the web app's /api proxy, so Google returns to the site's
 * own origin; this exact address is registered with the Google OAuth client.
 */
export function googleRedirectUri(webOrigin: string): string {
  return `${webOrigin}${API_PREFIX}${GOOGLE_ROUTES_PATH}/callback`;
}

export function fakeGoogleScreenUrl(webOrigin: string): string {
  return `${webOrigin}${API_PREFIX}${GOOGLE_ROUTES_PATH}/fake`;
}

/** Google, the fake stand-in (development and tests; config refuses it in production), or none. */
export function createIdentityProvider(
  config: Pick<Config, 'google' | 'webOrigin'>,
  logger: Logger,
): IdentityProvider | undefined {
  if (!config.google) return undefined;
  if (config.google.provider === 'google') {
    return new GoogleIdentityProvider(config.google.clientId, config.google.clientSecret);
  }
  logger.warn('GOOGLE_SIGN_IN_FAKE is on: "Continue with Google" signs in with made-up accounts');
  return new FakeIdentityProvider(fakeGoogleScreenUrl(config.webOrigin));
}
