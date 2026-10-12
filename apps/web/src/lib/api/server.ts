import 'server-only';
import type { CurrentUser, ListingDetail, ListingSummary } from '@walls/shared';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { apiInternalUrl } from '../api-internal-url';

const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;
const STATUS_NOT_FOUND = 404;

/** A GET the API answered with "not yours" or "doesn't exist"; pages show a 404 for both. */
export class NotAccessibleError extends Error {}

/**
 * GET from the API on behalf of the browser, forwarding its cookies (server-to-server, so
 * no CSRF Origin is needed). Returns null when the session is missing or expired.
 */
async function serverGet<T>(path: string): Promise<T | null> {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) return null;

  const response = await fetch(`${apiInternalUrl()}/api/v1${path}`, {
    headers: { cookie: cookieHeader, accept: 'application/json' },
    cache: 'no-store',
  });
  if (response.status === STATUS_UNAUTHORIZED) return null;
  if (response.status === STATUS_FORBIDDEN || response.status === STATUS_NOT_FOUND) {
    throw new NotAccessibleError(`GET ${path} answered ${response.status}`);
  }
  if (!response.ok) throw new Error(`GET ${path} failed with HTTP ${response.status}`);
  return (await response.json()) as T;
}

/** The signed-in user for this request, or null. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const data = await serverGet<{ user: CurrentUser }>('/auth/me');
  return data?.user ?? null;
});

export async function getMyListings(): Promise<ListingSummary[] | null> {
  return (await serverGet<{ listings: ListingSummary[] }>('/listings'))?.listings ?? null;
}

/** The listing, or null when signed out. Throws NotAccessibleError for 403/404. */
export async function getListing(id: string): Promise<ListingDetail | null> {
  return (
    (await serverGet<{ listing: ListingDetail }>(`/listings/${encodeURIComponent(id)}`))?.listing ??
    null
  );
}
