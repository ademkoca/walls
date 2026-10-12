import type { Currency, PropertyType, TransactionType } from '../enums';
import type { PublicListingLocation } from '../listing/location';
import type { Page } from './admin';
import type { PriceView, PropertyAttributesView } from './listings';
import type { PublicListingCard, PublicProfile } from './profiles';

/** Public website shapes (SPEC §16). Dates are ISO 8601 strings. */

/** The cached exchange rate (SPEC §12): 1 `base` = `rate` × `quote`. */
export interface ExchangeRateView {
  base: Currency;
  quote: Currency;
  /** Decimal string, e.g. "117.3693". */
  rate: string;
  provider: string;
  /** When the rate was retrieved from the provider. */
  fetchedAt: string;
}

export interface ListingSearchResult extends Page<PublicListingCard> {
  /** Matching listings across all pages. */
  total: number;
  pageSize: number;
}

export interface PublicListingImage {
  url: string;
  width: number | null;
  height: number | null;
}

/** A published listing's public page. Never includes a hidden address or private data. */
export interface PublicListingDetail {
  id: string;
  slug: string;
  /** Serbian text always; English text when the advertiser wrote it. */
  title: { sr: string; en: string | null };
  description: { sr: string; en: string | null };
  propertyType: PropertyType;
  transactionType: TransactionType;
  price: PriceView;
  attributes: PropertyAttributesView;
  amenityCodes: string[];
  location: PublicListingLocation;
  /** Approved images in display order, the cover first. */
  images: PublicListingImage[];
  /** The listing's creator (SPEC §5). */
  advertiser: PublicProfile;
  /** The agent an Admin assigned to the listing, if any (SPEC §46). */
  assignedAgent: PublicProfile | null;
  publishedAt: string;
  updatedAt: string;
}

export interface PublicHome {
  featured: PublicListingCard[];
  latest: PublicListingCard[];
}

/** What the sitemap lists (SPEC §32). */
export interface SitemapEntries {
  listings: { slug: string; updatedAt: string }[];
  agents: { slug: string; updatedAt: string }[];
  sellers: { slug: string; updatedAt: string }[];
}
