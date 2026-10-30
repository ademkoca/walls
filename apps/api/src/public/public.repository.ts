import { type DbExecutor, listings, properties, propertyLocations, users } from '@walls/database';
import { Role, UserStatus } from '@walls/shared';
import type { PartnerDirectoryQuery } from '@walls/validation';
import { type SQL, and, asc, count, desc, eq, or } from 'drizzle-orm';
import { pageBounds } from '../http/paging';
import { type CardRow, cardColumns, creator, publiclyVisible } from './listing-cards';

/** An active professional or private seller with a public profile page. */
export async function findPublicUser(db: DbExecutor, slug: string, role: Role) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.slug, slug), eq(users.role, role), eq(users.status, UserStatus.ACTIVE)))
    .limit(1);
  return user;
}

/**
 * Public listings advertised by a user, or assigned to them as the agent or agency; newest
 * first.
 */
export async function findPublicListingsOf(
  db: DbExecutor,
  userId: string,
  page: number,
  pageSize: number,
): Promise<CardRow[]> {
  const { limit, offset } = pageBounds(page, pageSize);
  return db
    .select(cardColumns)
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
    .orderBy(desc(listings.publishedAt), asc(listings.id))
    .limit(limit)
    .offset(offset);
}

/**
 * One page of active professionals (agents, agencies, investors; or one kind) by name, with
 * their number of public listings.
 */
export async function findPublicPartners(
  db: DbExecutor,
  query: PartnerDirectoryQuery,
  pageSize: number,
) {
  const { limit, offset } = pageBounds(query.page, pageSize);
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
    ...(query.type ? [eq(users.sellerType, query.type)] : []),
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
