import {
  type DbExecutor,
  listingMedia,
  listingTexts,
  listings,
  properties,
  propertyLocations,
  users,
} from '@walls/database';
import { ListingStatus, Role, UserStatus } from '@walls/shared';
import {
  type SQL,
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { pageBounds } from '../http/paging';

const creator = alias(users, 'creator');

/**
 * Listings visitors may see (SPEC §46): published, not deleted, and not created by a
 * deactivated account (decision, Phase 6). Mirrors `isListingPubliclyVisible`.
 */
const publiclyVisible = and(
  eq(listings.status, ListingStatus.PUBLISHED),
  isNull(listings.deletedAt),
  ne(creator.status, UserStatus.DEACTIVATED),
);

/** An active agent or private seller with a public profile page. */
export async function findPublicUser(db: DbExecutor, slug: string, role: Role) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.slug, slug), eq(users.role, role), eq(users.status, UserStatus.ACTIVE)))
    .limit(1);
  return user;
}

/** Public listings advertised by a user, or assigned to them as the agent; newest first. */
export async function findPublicListingsOf(db: DbExecutor, userId: string) {
  const rows = await db
    .select({ listing: listings, property: properties, location: propertyLocations })
    .from(listings)
    .innerJoin(creator, eq(creator.id, listings.createdById))
    .innerJoin(properties, eq(properties.id, listings.propertyId))
    .leftJoin(propertyLocations, eq(propertyLocations.propertyId, listings.propertyId))
    .where(
      and(
        publiclyVisible,
        or(eq(listings.createdById, userId), eq(listings.assignedAgentId, userId)),
      ),
    )
    .orderBy(desc(listings.publishedAt), asc(listings.id));
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.listing.id);
  const [texts, covers] = await Promise.all([
    db.select().from(listingTexts).where(inArray(listingTexts.listingId, ids)),
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
  return rows.map((row) => ({
    ...row,
    texts: texts.filter((text) => text.listingId === row.listing.id),
    coverUrl: covers.find((cover) => cover.listingId === row.listing.id)?.url ?? null,
  }));
}

/** One page of active agents by name, with their number of public listings. */
export async function findPublicAgents(db: DbExecutor, page: number, pageSize: number) {
  const { limit, offset } = pageBounds(page, pageSize);
  const listingCount = db
    .select({ agentId: users.id, total: count(listings.id).as('total') })
    .from(users)
    .innerJoin(
      listings,
      or(eq(listings.createdById, users.id), eq(listings.assignedAgentId, users.id)),
    )
    .innerJoin(creator, eq(creator.id, listings.createdById))
    .where(and(eq(users.role, Role.REAL_ESTATE_AGENT), publiclyVisible))
    .groupBy(users.id)
    .as('listing_count');

  const conditions: SQL[] = [
    eq(users.role, Role.REAL_ESTATE_AGENT),
    eq(users.status, UserStatus.ACTIVE),
  ];
  return db
    .select({ user: users, listingCount: listingCount.total })
    .from(users)
    .leftJoin(listingCount, eq(listingCount.agentId, users.id))
    .where(and(...conditions))
    .orderBy(asc(users.displayName), asc(users.id))
    .limit(limit)
    .offset(offset);
}
