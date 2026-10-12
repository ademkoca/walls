import 'server-only';
import type {
  AgentApplicationDetail,
  AgentApplicationSummary,
  AuditLogEntry,
  CurrentUser,
  MyProfile,
  ProfileChangeRequestDetail,
  ProfileChangeRequestSummary,
  ReviewQueueCounts,
  ReviewStatus,
  ListingDetail,
  ListingSummary,
  Page,
  UserDetail,
  UserSummary,
} from '@walls/shared';
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

/** Builds `path?query` from defined values only. */
export function withQuery(
  path: string,
  query: Record<string, string | number | boolean | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

/** Dashboard listings: the user's own, or every listing for reviewers. */
export async function getListings(
  query: { status?: string; pendingRevision?: boolean } = {},
): Promise<ListingSummary[] | null> {
  return (
    (await serverGet<{ listings: ListingSummary[] }>(withQuery('/listings', query)))?.listings ??
    null
  );
}

export async function getUsers(query: {
  role?: string;
  status?: string;
  q?: string;
  page?: number;
}): Promise<Page<UserSummary> | null> {
  return serverGet<Page<UserSummary>>(withQuery('/users', query));
}

/** Throws NotAccessibleError for 403/404. */
export async function getUser(id: string): Promise<UserDetail | null> {
  return (await serverGet<{ user: UserDetail }>(`/users/${encodeURIComponent(id)}`))?.user ?? null;
}

export async function getAuditLog(query: {
  entityType?: string;
  entityId?: string;
  page?: number;
}): Promise<Page<AuditLogEntry> | null> {
  return serverGet<Page<AuditLogEntry>>(withQuery('/audit-log', query));
}

/** The listing, or null when signed out. Throws NotAccessibleError for 403/404. */
export async function getListing(id: string): Promise<ListingDetail | null> {
  return (
    (await serverGet<{ listing: ListingDetail }>(`/listings/${encodeURIComponent(id)}`))?.listing ??
    null
  );
}

export async function getMyProfile(): Promise<MyProfile | null> {
  return (await serverGet<{ profile: MyProfile }>('/me/profile'))?.profile ?? null;
}

/** Waiting items for the reviewer navigation. */
export async function getReviewQueueCounts(): Promise<ReviewQueueCounts | null> {
  return (await serverGet<{ counts: ReviewQueueCounts }>('/review-queue/counts'))?.counts ?? null;
}

export async function getAgentApplications(query: {
  status: ReviewStatus;
  page: number;
}): Promise<Page<AgentApplicationSummary> | null> {
  return serverGet<Page<AgentApplicationSummary>>(withQuery('/agent-applications', query));
}

/** Throws NotAccessibleError for 403/404. */
export async function getAgentApplication(id: string): Promise<AgentApplicationDetail | null> {
  return (
    (
      await serverGet<{ application: AgentApplicationDetail }>(
        `/agent-applications/${encodeURIComponent(id)}`,
      )
    )?.application ?? null
  );
}

export async function getProfileChanges(query: {
  status: ReviewStatus;
  page: number;
}): Promise<Page<ProfileChangeRequestSummary> | null> {
  return serverGet<Page<ProfileChangeRequestSummary>>(withQuery('/profile-changes', query));
}

/** Throws NotAccessibleError for 403/404. */
export async function getProfileChange(id: string): Promise<ProfileChangeRequestDetail | null> {
  return (
    (
      await serverGet<{ request: ProfileChangeRequestDetail }>(
        `/profile-changes/${encodeURIComponent(id)}`,
      )
    )?.request ?? null
  );
}
