import {
  type DbExecutor,
  amenities,
  listingMedia,
  listingRevisions,
  listingStatusHistory,
  listingTexts,
  listings,
  properties,
  propertyAmenities,
  propertyLocations,
  users,
} from '@walls/database';
import {
  DEFAULT_LOCALE,
  type ListingContent,
  type ListingStatus,
  MediaType,
  ReviewStatus,
  type UserReference,
} from '@walls/shared';
import {
  type SQL,
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  like,
  ne,
  or,
  sql,
} from 'drizzle-orm';

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
export type RevisionRow = typeof listingRevisions.$inferSelect;

/** A listing with everything the dashboard editor shows. */
export interface ListingAggregate {
  listing: ListingRow;
  property: PropertyRow;
  creator: UserReference;
  location: LocationRow | null;
  texts: ListingTextRow[];
  amenityCodes: string[];
  /** Images only, in display order (approved and revision-added). */
  images: MediaRow[];
  /** The pending revision, or the latest revision when it was rejected. */
  revision: RevisionRow | null;
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
    .select({
      listing: listings,
      property: properties,
      location: propertyLocations,
      creator: { id: users.id, displayName: users.displayName },
    })
    .from(listings)
    .innerJoin(properties, eq(properties.id, listings.propertyId))
    .innerJoin(users, eq(users.id, listings.createdById))
    .leftJoin(propertyLocations, eq(propertyLocations.propertyId, properties.id))
    .where(eq(listings.id, id))
    .limit(1);
  if (!row) return undefined;

  const [texts, amenityRows, images, revision] = await Promise.all([
    db.select().from(listingTexts).where(eq(listingTexts.listingId, id)),
    db
      .select({ code: propertyAmenities.amenityCode })
      .from(propertyAmenities)
      .innerJoin(amenities, eq(amenities.code, propertyAmenities.amenityCode))
      .where(eq(propertyAmenities.propertyId, row.property.id))
      .orderBy(asc(amenities.sortOrder)),
    findImages(db, id),
    findVisibleRevision(db, id),
  ]);
  return {
    ...row,
    texts,
    amenityCodes: amenityRows.map((amenity) => amenity.code),
    images,
    revision,
  };
}

export interface ListingSummaryRow {
  listing: ListingRow;
  creator: UserReference;
  propertyType: PropertyRow['propertyType'];
  title: string | null;
  city: string | null;
  coverImageUrl: string | null;
  imageCount: number;
  hasPendingRevision: boolean;
}

/**
 * Dashboard listing rows, newest change first. Deleted drafts are always excluded.
 * `creatorId` limits the rows to listings that user created.
 */
const pendingRevisionExists = exists(
  sql`(select 1 from ${listingRevisions} where ${listingRevisions.listingId} = ${listings.id} and ${listingRevisions.status} = ${ReviewStatus.PENDING})`,
);

export interface SummaryFilter {
  creatorId?: string;
  status?: ListingStatus;
  pendingRevision?: boolean;
}

function summaryConditions(filter: SummaryFilter): SQL[] {
  const conditions: SQL[] = [isNull(listings.deletedAt)];
  if (filter.pendingRevision) conditions.push(pendingRevisionExists);
  if (filter.creatorId) conditions.push(eq(listings.createdById, filter.creatorId));
  if (filter.status) conditions.push(eq(listings.status, filter.status));
  return conditions;
}

export async function findListingSummaries(
  db: DbExecutor,
  filter: SummaryFilter,
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
      creator: { id: users.id, displayName: users.displayName },
      propertyType: properties.propertyType,
      title: listingTexts.title,
      city: propertyLocations.city,
      coverImageUrl: imageStats.coverImageUrl,
      imageCount: imageStats.imageCount,
      hasPendingRevision: sql<boolean>`${pendingRevisionExists}`,
    })
    .from(listings)
    .innerJoin(properties, eq(properties.id, listings.propertyId))
    .innerJoin(users, eq(users.id, listings.createdById))
    .leftJoin(propertyLocations, eq(propertyLocations.propertyId, properties.id))
    .leftJoin(
      listingTexts,
      and(eq(listingTexts.listingId, listings.id), eq(listingTexts.locale, DEFAULT_LOCALE)),
    )
    .leftJoin(imageStats, eq(imageStats.listingId, listings.id))
    .where(and(...summaryConditions(filter)))
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

/** Listing slugs that `base` could collide with: `base` itself and `base-N`. */
export async function findListingSlugsLike(db: DbExecutor, base: string): Promise<string[]> {
  const rows = await db
    .select({ slug: listings.slug })
    .from(listings)
    .where(or(eq(listings.slug, base), like(listings.slug, `${base}-%`)));
  return rows.flatMap((row) => (row.slug ? [row.slug] : []));
}

/** Marks every not-yet-approved image of the listing as approved (shown publicly). */
export async function approvePendingImages(db: DbExecutor, listingId: string): Promise<void> {
  await db
    .update(listingMedia)
    .set({ approvedAt: new Date() })
    .where(and(eq(listingMedia.listingId, listingId), isNull(listingMedia.approvedAt)));
}

/** Storage keys of every media file of the listing, for cleanup after deletion. */
export async function findMediaStorageKeys(db: DbExecutor, listingId: string): Promise<string[]> {
  const rows = await db
    .select({ key: listingMedia.storageKey })
    .from(listingMedia)
    .where(eq(listingMedia.listingId, listingId));
  return rows.map((row) => row.key);
}

/**
 * Permanently deletes a listing and everything that belongs only to it (texts, media rows,
 * history; via cascades), and its property when no other listing uses it. Audit entries
 * are kept.
 */
export async function deleteListingPermanently(
  db: DbExecutor,
  listing: Pick<ListingRow, 'id' | 'propertyId'>,
): Promise<void> {
  await db.delete(listings).where(eq(listings.id, listing.id));
  const [other] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(and(eq(listings.propertyId, listing.propertyId), ne(listings.id, listing.id)))
    .limit(1);
  if (!other) await db.delete(properties).where(eq(properties.id, listing.propertyId));
}

/** The pending revision, or the latest one if it was rejected (approved ones are history). */
export async function findVisibleRevision(
  db: DbExecutor,
  listingId: string,
): Promise<RevisionRow | null> {
  const [latest] = await db
    .select()
    .from(listingRevisions)
    .where(eq(listingRevisions.listingId, listingId))
    .orderBy(desc(listingRevisions.createdAt))
    .limit(1);
  return latest && latest.status !== ReviewStatus.APPROVED ? latest : null;
}

export async function findPendingRevision(
  db: DbExecutor,
  listingId: string,
): Promise<RevisionRow | undefined> {
  const [revision] = await db
    .select()
    .from(listingRevisions)
    .where(
      and(
        eq(listingRevisions.listingId, listingId),
        eq(listingRevisions.status, ReviewStatus.PENDING),
      ),
    );
  return revision;
}

/** Creates the listing's pending revision or replaces its content. */
export async function savePendingRevision(
  db: DbExecutor,
  revision: {
    listingId: string;
    content: ListingContent;
    updatedById: string;
  },
): Promise<void> {
  const pending = await findPendingRevision(db, revision.listingId);
  if (pending) {
    await db
      .update(listingRevisions)
      .set({
        content: revision.content,
        updatedById: revision.updatedById,
      })
      .where(eq(listingRevisions.id, pending.id));
  } else {
    await db.insert(listingRevisions).values(revision);
  }
}

export async function deleteRevision(db: DbExecutor, id: string): Promise<void> {
  await db.delete(listingRevisions).where(eq(listingRevisions.id, id));
}

export async function closeRevision(
  db: DbExecutor,
  id: string,
  outcome: { status: 'APPROVED' | 'REJECTED'; reviewedById: string; rejectionReason?: string },
): Promise<void> {
  await db
    .update(listingRevisions)
    .set({ ...outcome, reviewedAt: new Date() })
    .where(eq(listingRevisions.id, id));
}

/** Deletes media rows by id; returns their storage keys for cleanup. */
export async function deleteMediaRows(
  db: DbExecutor,
  listingId: string,
  mediaIds: readonly string[],
): Promise<string[]> {
  if (mediaIds.length === 0) return [];
  const rows = await db
    .delete(listingMedia)
    .where(and(eq(listingMedia.listingId, listingId), inArray(listingMedia.id, [...mediaIds])))
    .returning({ key: listingMedia.storageKey });
  return rows.map((row) => row.key);
}

/** Images a pending revision added (not yet approved). */
export async function unapprovedImageIds(db: DbExecutor, listingId: string): Promise<string[]> {
  const rows = await db
    .select({ id: listingMedia.id })
    .from(listingMedia)
    .where(and(eq(listingMedia.listingId, listingId), isNull(listingMedia.approvedAt)));
  return rows.map((row) => row.id);
}
