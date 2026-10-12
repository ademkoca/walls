import {
  type DbExecutor,
  amenities,
  listingMedia,
  listingStatusHistory,
  listingTexts,
  listings,
  properties,
  propertyAmenities,
  propertyLocations,
} from '@walls/database';
import { DEFAULT_LOCALE, MediaType } from '@walls/shared';
import { and, asc, count, desc, eq, isNull, or, sql } from 'drizzle-orm';

export type ListingRow = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type PropertyRow = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type LocationRow = typeof propertyLocations.$inferSelect;
export type NewLocation = typeof propertyLocations.$inferInsert;
export type ListingTextRow = typeof listingTexts.$inferSelect;
export type MediaRow = typeof listingMedia.$inferSelect;
export type NewMedia = typeof listingMedia.$inferInsert;
export type StatusHistoryEntry = typeof listingStatusHistory.$inferInsert;

/** A listing with everything the dashboard editor shows. */
export interface ListingAggregate {
  listing: ListingRow;
  property: PropertyRow;
  location: LocationRow | null;
  texts: ListingTextRow[];
  amenityCodes: string[];
  /** Images only, in display order. */
  images: MediaRow[];
}

export async function insertProperty(db: DbExecutor, property: NewProperty): Promise<PropertyRow> {
  const [created] = await db.insert(properties).values(property).returning();
  return created!;
}

export async function insertListing(db: DbExecutor, listing: NewListing): Promise<ListingRow> {
  const [created] = await db.insert(listings).values(listing).returning();
  return created!;
}

export async function insertStatusHistory(db: DbExecutor, entry: StatusHistoryEntry) {
  await db.insert(listingStatusHistory).values(entry);
}

/** Locks the listing row for the rest of the transaction, serializing concurrent changes. */
export async function lockListing(db: DbExecutor, id: string): Promise<ListingRow | undefined> {
  const [listing] = await db.select().from(listings).where(eq(listings.id, id)).for('update');
  return listing;
}

export async function findListingAggregate(
  db: DbExecutor,
  id: string,
): Promise<ListingAggregate | undefined> {
  const [row] = await db
    .select({ listing: listings, property: properties, location: propertyLocations })
    .from(listings)
    .innerJoin(properties, eq(properties.id, listings.propertyId))
    .leftJoin(propertyLocations, eq(propertyLocations.propertyId, properties.id))
    .where(eq(listings.id, id))
    .limit(1);
  if (!row) return undefined;

  const [texts, amenityRows, images] = await Promise.all([
    db.select().from(listingTexts).where(eq(listingTexts.listingId, id)),
    db
      .select({ code: propertyAmenities.amenityCode })
      .from(propertyAmenities)
      .innerJoin(amenities, eq(amenities.code, propertyAmenities.amenityCode))
      .where(eq(propertyAmenities.propertyId, row.property.id))
      .orderBy(asc(amenities.sortOrder)),
    findImages(db, id),
  ]);
  return { ...row, texts, amenityCodes: amenityRows.map((amenity) => amenity.code), images };
}

export interface ListingSummaryRow {
  listing: ListingRow;
  propertyType: PropertyRow['propertyType'];
  title: string | null;
  city: string | null;
  coverImageUrl: string | null;
  imageCount: number;
}

/** Listings the user created or is assigned to, newest change first. Deleted drafts are excluded. */
export async function findListingsForEditor(
  db: DbExecutor,
  userId: string,
): Promise<ListingSummaryRow[]> {
  const imageStats = db
    .select({
      listingId: listingMedia.listingId,
      imageCount: count().as('image_count'),
      coverImageUrl:
        sql<string>`max(${listingMedia.url}) filter (where ${listingMedia.isPrimary})`.as(
          'cover_image_url',
        ),
    })
    .from(listingMedia)
    .where(eq(listingMedia.type, MediaType.IMAGE))
    .groupBy(listingMedia.listingId)
    .as('image_stats');

  const rows = await db
    .select({
      listing: listings,
      propertyType: properties.propertyType,
      title: listingTexts.title,
      city: propertyLocations.city,
      coverImageUrl: imageStats.coverImageUrl,
      imageCount: imageStats.imageCount,
    })
    .from(listings)
    .innerJoin(properties, eq(properties.id, listings.propertyId))
    .leftJoin(propertyLocations, eq(propertyLocations.propertyId, properties.id))
    .leftJoin(
      listingTexts,
      and(eq(listingTexts.listingId, listings.id), eq(listingTexts.locale, DEFAULT_LOCALE)),
    )
    .leftJoin(imageStats, eq(imageStats.listingId, listings.id))
    .where(
      and(
        or(eq(listings.createdById, userId), eq(listings.assignedAgentId, userId)),
        isNull(listings.deletedAt),
      ),
    )
    .orderBy(desc(listings.updatedAt));

  return rows.map((row) => ({ ...row, imageCount: row.imageCount ?? 0 }));
}

export async function updateListing(
  db: DbExecutor,
  id: string,
  changes: Partial<NewListing>,
): Promise<void> {
  // Always touches updated_at, so editing only texts or media still counts as a change.
  await db
    .update(listings)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(listings.id, id));
}

export async function updateProperty(
  db: DbExecutor,
  id: string,
  changes: Partial<NewProperty>,
): Promise<void> {
  if (Object.keys(changes).length === 0) return;
  await db.update(properties).set(changes).where(eq(properties.id, id));
}

export async function upsertLocation(db: DbExecutor, location: NewLocation): Promise<void> {
  await db
    .insert(propertyLocations)
    .values(location)
    .onConflictDoUpdate({ target: propertyLocations.propertyId, set: location });
}

/** Replaces all texts of a listing. */
export async function replaceTexts(
  db: DbExecutor,
  listingId: string,
  texts: readonly { locale: ListingTextRow['locale']; title: string; description: string }[],
): Promise<void> {
  await db.delete(listingTexts).where(eq(listingTexts.listingId, listingId));
  if (texts.length > 0) {
    await db.insert(listingTexts).values(texts.map((text) => ({ ...text, listingId })));
  }
}

/** Replaces the amenities of a property. Unknown codes fail on the foreign key. */
export async function replaceAmenities(
  db: DbExecutor,
  propertyId: string,
  codes: readonly string[],
): Promise<void> {
  await db.delete(propertyAmenities).where(eq(propertyAmenities.propertyId, propertyId));
  if (codes.length > 0) {
    await db
      .insert(propertyAmenities)
      .values(codes.map((amenityCode) => ({ propertyId, amenityCode })));
  }
}

export async function findImages(db: DbExecutor, listingId: string): Promise<MediaRow[]> {
  return db
    .select()
    .from(listingMedia)
    .where(and(eq(listingMedia.listingId, listingId), eq(listingMedia.type, MediaType.IMAGE)))
    .orderBy(asc(listingMedia.sortOrder), asc(listingMedia.createdAt));
}

export async function insertMedia(db: DbExecutor, media: NewMedia): Promise<MediaRow> {
  const [created] = await db.insert(listingMedia).values(media).returning();
  return created!;
}

export async function deleteMedia(db: DbExecutor, mediaId: string): Promise<void> {
  await db.delete(listingMedia).where(eq(listingMedia.id, mediaId));
}

/**
 * Writes the image order and cover. The cover flag is cleared first because at most one
 * image per listing may be primary at any moment (unique index).
 */
export async function writeImageOrder(
  db: DbExecutor,
  listingId: string,
  orderedIds: readonly string[],
  primaryId: string,
): Promise<void> {
  await db
    .update(listingMedia)
    .set({ isPrimary: false })
    .where(and(eq(listingMedia.listingId, listingId), eq(listingMedia.isPrimary, true)));
  for (const [sortOrder, mediaId] of orderedIds.entries()) {
    await db
      .update(listingMedia)
      .set({ sortOrder, isPrimary: mediaId === primaryId })
      .where(and(eq(listingMedia.id, mediaId), eq(listingMedia.listingId, listingId)));
  }
}
