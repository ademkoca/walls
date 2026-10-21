import 'server-only';
import type {
  ExchangeRateView,
  ListingSearchResult,
  Page,
  ProfessionalSellerType,
  PublicPartnerSummary,
  PublicHome,
  PublicListingDetail,
  PublicProfilePage,
  SitemapEntries,
} from '@walls/shared';
import { type ListingSearch, listingSearchToQuery } from '@walls/validation';
import { cache } from 'react';
import { apiInternalUrl } from '../api-internal-url';

const STATUS_BAD_REQUEST = 400;
const STATUS_NOT_FOUND = 404;

/** GET a public API resource (no cookies); null when it does not exist (or the URL is malformed). */
async function publicGet<T>(path: string): Promise<T | null> {
  const response = await fetch(`${apiInternalUrl()}/api/v1/public${path}`, {
    headers: { accept: 'application/json' },
    // Always current: an approved change must show at once (and a prefetch must not cache
    // an old version). These are small queries.
    cache: 'no-store',
  });
  if (response.status === STATUS_NOT_FOUND || response.status === STATUS_BAD_REQUEST) return null;
  if (!response.ok) throw new Error(`GET ${path} failed with HTTP ${response.status}`);
  return (await response.json()) as T;
}

/** A public resource that always exists; a missing one is an error. */
async function requiredGet<T>(path: string): Promise<T> {
  const body = await publicGet<T>(path);
  if (body === null) throw new Error(`GET ${path} returned no data`);
  return body;
}

/** One page of the professionals directory, optionally of one kind. */
export function getPublicPartners(query: {
  type: ProfessionalSellerType | undefined;
  page: number;
}): Promise<Page<PublicPartnerSummary> | null> {
  const search = new URLSearchParams({
    page: String(query.page),
    ...(query.type ? { type: query.type } : {}),
  });
  return publicGet<Page<PublicPartnerSummary>>(`/partners?${search.toString()}`);
}

/** A public professional or private-seller profile with its listings, or null when not found. */
export function getPublicProfile(
  kind: 'partners' | 'sellers',
  slug: string,
): Promise<PublicProfilePage | null> {
  return publicGet<PublicProfilePage>(`/${kind}/${encodeURIComponent(slug)}`);
}

export function searchListings(search: ListingSearch): Promise<ListingSearchResult> {
  return requiredGet(`/listings?${new URLSearchParams(listingSearchToQuery(search)).toString()}`);
}

/**
 * A published listing's public page, or null when it is not (or no longer) public. Cached
 * per request: the page and its metadata both need it.
 */
export const getPublicListing = cache((slug: string): Promise<PublicListingDetail | null> =>
  publicGet<PublicListingDetail>(`/listings/${encodeURIComponent(slug)}`),
);

export function getPublicHome(): Promise<PublicHome> {
  return requiredGet('/home');
}

/** The current EUR → RSD rate; null before the API first retrieved one. */
export function getExchangeRate(): Promise<ExchangeRateView | null> {
  return publicGet<ExchangeRateView | null>('/exchange-rate');
}

export function getSitemapEntries(): Promise<SitemapEntries> {
  return requiredGet('/sitemap');
}
