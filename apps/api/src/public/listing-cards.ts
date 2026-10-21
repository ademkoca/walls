import {
  type DbExecutor,
  listingMedia,
  listingTexts,
  listings,
  properties,
  propertyLocations,
  users,
} from '@walls/database';
import { ListingStatus, Locale, type PublicListingCard, UserStatus } from '@walls/shared';
import { and, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { priceView, storedPrice } from '../listings/listing-content';

/** The listing's creator; join it to apply `publiclyVisible`. */
export const creator = alias(users, 'creator');

/**
 * Listings visitors may see (SPEC §46): published, not deleted, and not created by a
 * deactivated account (decision, Phase 6). Mirrors `isListingPubliclyVisible`.
 */
export const publiclyVisible = and(
  eq(listings.status, ListingStatus.PUBLISHED),
  isNull(listings.deletedAt),
  ne(creator.status, UserStatus.DEACTIVATED),
)!;

/** The columns a listing card needs, selected by every public list query. */
export const cardColumns = { listing: listings, property: properties, location: propertyLocations };

export interface CardRow {
  listing: typeof listings.$inferSelect;
  property: typeof properties.$inferSelect;
  location: typeof propertyLocations.$inferSelect | null;
}

/** Adds the titles and cover images of the listings in `rows`, as cards in the same order. */
export async function toCards(db: DbExecutor, rows: CardRow[]): Promise<PublicListingCard[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.listing.id);
  const [texts, covers] = await Promise.all([
    db
      .select({
        listingId: listingTexts.listingId,
        locale: listingTexts.locale,
        title: listingTexts.title,
      })
      .from(listingTexts)
      .where(inArray(listingTexts.listingId, ids)),
    db
      .select({ listingId: listingMedia.listingId, url: listingMedia.url })
      .from(listingMedia)
      .where(
        and(
          inArray(listingMedia.listingId, ids),
          eq(listingMedia.isPrimary, true),
          isNotNull(listingMedia.approvedAt),
        ),
      ),
  ]);
  return rows.map(({ listing, property, location }) => {
    const title = (locale: Locale) =>
      texts.find((text) => text.listingId === listing.id && text.locale === locale)?.title ?? null;
    return {
      id: listing.id,
      // Published listings always have a slug and publication date (database constraint).
      slug: listing.slug!,
      title: { sr: title(Locale.SR) ?? '', en: title(Locale.EN) || null },
      propertyType: property.propertyType!,
      transactionType: listing.transactionType!,
      price: priceView({ price: storedPrice(listing) }),
      city: location?.city ?? null,
      municipality: location?.municipality ?? null,
      neighborhood: location?.neighborhood ?? null,
      coverImageUrl: covers.find((cover) => cover.listingId === listing.id)?.url ?? null,
      floorArea: property.floorArea,
      plotArea: property.plotArea,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      sellerType: listing.sellerType,
      publishedAt: listing.publishedAt!.toISOString(),
    };
  });
}
