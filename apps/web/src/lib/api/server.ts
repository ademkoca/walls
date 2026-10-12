import 'server-only';
import type { CurrentUser } from '@walls/shared';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { apiInternalUrl } from '../api-internal-url';

const STATUS_UNAUTHORIZED = 401;

/**
 * The signed-in user for this request, or null. Forwards the browser's cookies to the API
 * (server-to-server, so no CSRF Origin is needed for this GET). Deduplicated per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) return null;

  const response = await fetch(`${apiInternalUrl()}/api/v1/auth/me`, {
    headers: { cookie: cookieHeader, accept: 'application/json' },
    cache: 'no-store',
  });
  if (response.status === STATUS_UNAUTHORIZED) return null;
  if (!response.ok) throw new Error(`GET /auth/me failed with HTTP ${response.status}`);
  return ((await response.json()) as { user: CurrentUser }).user;
});
