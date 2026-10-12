import 'server-only';
import type { Page, PublicAgentSummary, PublicProfilePage } from '@walls/shared';
import { apiInternalUrl } from '../api-internal-url';

const STATUS_BAD_REQUEST = 400;
const STATUS_NOT_FOUND = 404;

/** GET a public API resource (no cookies); null when it does not exist (or the URL is malformed). */
async function publicGet<T>(path: string): Promise<T | null> {
  const response = await fetch(`${apiInternalUrl()}/api/v1/public${path}`, {
    headers: { accept: 'application/json' },
    // Always current: an approved profile change must show at once (and a prefetch must
    // not cache an old version). These are small queries.
    cache: 'no-store',
  });
  if (response.status === STATUS_NOT_FOUND || response.status === STATUS_BAD_REQUEST) return null;
  if (!response.ok) throw new Error(`GET ${path} failed with HTTP ${response.status}`);
  return (await response.json()) as T;
}

export function getPublicAgents(page: number): Promise<Page<PublicAgentSummary> | null> {
  return publicGet<Page<PublicAgentSummary>>(`/agents?page=${page}`);
}

/** A public agent or seller profile with its listings, or null when not found. */
export function getPublicProfile(
  kind: 'agents' | 'sellers',
  slug: string,
): Promise<PublicProfilePage | null> {
  return publicGet<PublicProfilePage>(`/${kind}/${encodeURIComponent(slug)}`);
}
