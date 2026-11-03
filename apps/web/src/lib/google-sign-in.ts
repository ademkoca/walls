import type { GoogleSignInIntent, Locale } from '@walls/shared';

/** The API endpoint that starts "Continue with Google"; the browser navigates to it. */
const GOOGLE_START_PATH = '/api/v1/auth/google';

/**
 * Where a "Continue with Google" link points (SPEC §3.1). `next` is a page of this site
 * (without the locale prefix) to return to; `token` is a setup link's token.
 */
export function googleSignInHref(options: {
  locale: Locale;
  intent?: GoogleSignInIntent;
  next?: string | undefined;
  token?: string | null | undefined;
}): string {
  const query = new URLSearchParams({ locale: options.locale });
  if (options.intent) query.set('intent', options.intent);
  if (options.next) query.set('next', options.next);
  if (options.token) query.set('token', options.token);
  return `${GOOGLE_START_PATH}?${query.toString()}`;
}
