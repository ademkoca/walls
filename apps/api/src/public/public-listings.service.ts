import type { Database } from '@walls/database';
import {
  HOME_LISTINGS_LIMIT,
  LISTING_SEARCH_PAGE_SIZE,
  type ListingSearchResult,
  ListingSort,
  Locale,
  type PublicHome,
  type PublicListingDetail,
  type SitemapEntries,
  toPublicLocation,
} from '@walls/shared';
import type { ListingSearch } from '@walls/validation';
import type { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { notFound } from '../http/errors';
import type { MediaStorage } from '../media/media-storage';
import { priceView, storedPrice } from '../listings/listing-content';
import { toCards } from './listing-cards';
import {
  countHomeStats,
  findFeaturedListings,
  findPublicListing,
  findSitemapEntries,
  searchPublicListings,
} from './public-listings.repository';
import { toPublicProfile } from './public-profile-view';

type PublicListingRow = NonNullable<Awaited<ReturnType<typeof findPublicListing>>>;

/** Published listings on the public website (SPEC §16–17). */
export class PublicListingsService {
  constructor(
    private readonly db: Database,
    private readonly rates: ExchangeRatesService,
    private readonly media: MediaStorage,
  ) {}

  async search(search: ListingSearch): Promise<ListingSearchResult> {
    const rate = await this.rates.current();
    const { rows, total } = await searchPublicListings(
      this.db,
      search,
      rate?.rate ?? null,
      LISTING_SEARCH_PAGE_SIZE,
    );
    return {
      items: await toCards(this.db, rows),
      page: search.page,
      pageSize: LISTING_SEARCH_PAGE_SIZE,
      total,
      hasMore: search.page * LISTING_SEARCH_PAGE_SIZE < total,
    };
  }

  async home(): Promise<PublicHome> {
    const [featured, latest, counts] = await Promise.all([
      findFeaturedListings(this.db, HOME_LISTINGS_LIMIT),
      searchPublicListings(
        this.db,
        { sort: ListingSort.NEWEST, page: 1 },
        null,
        HOME_LISTINGS_LIMIT,
      ),
      countHomeStats(this.db),
    ]);
    return {
      featured: await toCards(this.db, featured),
      latest: await toCards(this.db, latest.rows),
      stats: { listings: latest.total, ...counts },
    };
  }

  async listing(slug: string): Promise<PublicListingDetail> {
    const row = await findPublicListing(this.db, slug);
    if (!row) throw notFound();
    const cover = row.images[0];
    return {
      ...toPublicListingDetail(row),
      linkPreviewImage: cover ? this.media.linkPreviewImage(cover, 'wide') : null,
    };
  }

  async sitemap(): Promise<SitemapEntries> {
    const { listingRows, partnerRows, sellerRows } = await findSitemapEntries(this.db);
    const entry = (row: { slug: string | null; updatedAt: Date | null }) => ({
      slug: row.slug!,
      updatedAt: (row.updatedAt ?? new Date()).toISOString(),
    });
    return {
      listings: listingRows.map(entry),
      partners: partnerRows.map(entry),
      sellers: sellerRows.map(entry),
    };
  }
}

/**
 * The public page of a listing. The street address and coordinates are left out unless
 * the advertiser made them public (SPEC §13); the approximate area is given instead.
 */
function toPublicListingDetail(
  row: PublicListingRow,
): Omit<PublicListingDetail, 'linkPreviewImage'> {
  const { listing, property, location, texts } = row;
  const text = (locale: Locale) => texts.find((entry) => entry.locale === locale);
  const english = text(Locale.EN);
  // Published listings have passed the submission requirements (SPEC §39): the type,
  // the Serbian text and the full location are present.
  return {
    id: listing.id,
    slug: listing.slug!,
    title: { sr: text(Locale.SR)?.title ?? '', en: english?.title || null },
    description: { sr: text(Locale.SR)?.description ?? '', en: english?.description || null },
    propertyType: property.propertyType!,
    transactionType: listing.transactionType!,
    price: priceView({ price: storedPrice(listing) }),
    attributes: {
      floorArea: property.floorArea,
      plotArea: property.plotArea,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      floor: property.floor,
      totalFloors: property.totalFloors,
      yearBuilt: property.yearBuilt,
      parkingSpaces: property.parkingSpaces,
      heatingType: property.heatingType,
      furnishedStatus: property.furnishedStatus,
    },
    amenityCodes: row.amenityCodes,
    location: toPublicLocation(
      {
        country: location!.country!,
        city: location!.city!,
        municipality: location!.municipality,
        neighborhood: location!.neighborhood,
        postalCode: location!.postalCode,
        street: location!.street!,
        streetNumber: location!.streetNumber!,
        latitude: location!.latitude!,
        longitude: location!.longitude!,
      },
      listing.isExactAddressPublic,
    ),
    images: row.images.map(({ url, width, height }) => ({ url, width, height })),
    advertiser: toPublicProfile(row.creator),
    assignedAgent: row.assignedAgent ? toPublicProfile(row.assignedAgent) : null,
    publishedAt: listing.publishedAt!.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}
