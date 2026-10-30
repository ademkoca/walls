import {
  type DbExecutor,
  inquiries,
  listingViewVisitors,
  listingViewsDaily,
  listings,
} from '@walls/database';
import { InquiryStatus } from '@walls/shared';
import { and, count, eq, gte, isNull, lt, sql, sum } from 'drizzle-orm';
import { creator, publiclyVisible } from '../public/listing-cards';

/** A public listing's id and its creator, whose own views are not counted. */
export async function findViewableListing(db: DbExecutor, slug: string) {
  const [row] = await db
    .select({ id: listings.id, createdById: listings.createdById })
    .from(listings)
    .innerJoin(creator, eq(creator.id, listings.createdById))
    .where(and(publiclyVisible, eq(listings.slug, slug)))
    .limit(1);
  return row;
}

/**
 * Counts one view of a listing by a visitor on a day; a visitor already counted that day
 * is not counted again. Returns whether the view was counted.
 */
export async function countView(
  db: DbExecutor,
  listingId: string,
  day: string,
  visitorHash: string,
): Promise<boolean> {
  const firstToday = await db
    .insert(listingViewVisitors)
    .values({ listingId, day, visitorHash })
    .onConflictDoNothing()
    .returning({ listingId: listingViewVisitors.listingId });
  if (firstToday.length === 0) return false;
  await db
    .insert(listingViewsDaily)
    .values({ listingId, day, views: 1 })
    .onConflictDoUpdate({
      target: [listingViewsDaily.listingId, listingViewsDaily.day],
      set: { views: sql`${listingViewsDaily.views} + 1` },
    });
  return true;
}

/** Visitor fingerprints are only needed for the current day. */
export async function deleteVisitorsBefore(db: DbExecutor, day: string): Promise<void> {
  await db.delete(listingViewVisitors).where(lt(listingViewVisitors.day, day));
}

const toNumber = (value: string | number | null | undefined) => Number(value ?? 0);

export async function listingTotals(db: DbExecutor, listingId: string) {
  const [[views], [inquiryCount]] = await Promise.all([
    db
      .select({ total: sum(listingViewsDaily.views) })
      .from(listingViewsDaily)
      .where(eq(listingViewsDaily.listingId, listingId)),
    db.select({ total: count() }).from(inquiries).where(eq(inquiries.listingId, listingId)),
  ]);
  return { totalViews: toNumber(views?.total), inquiryCount: inquiryCount?.total ?? 0 };
}

export async function listingViewsSince(db: DbExecutor, listingId: string, firstDay: string) {
  const rows = await db
    .select({ day: listingViewsDaily.day, value: listingViewsDaily.views })
    .from(listingViewsDaily)
    .where(and(eq(listingViewsDaily.listingId, listingId), gte(listingViewsDaily.day, firstDay)));
  return rows;
}

export async function platformTotals(db: DbExecutor, firstDay: string) {
  const [byStatus, [inquiryTotals], [views], [recentViews]] = await Promise.all([
    db
      .select({ status: listings.status, total: count() })
      .from(listings)
      .where(isNull(listings.deletedAt))
      .groupBy(listings.status),
    db
      .select({
        total: count(),
        new: sql<number>`count(*) filter (where ${inquiries.status} = ${InquiryStatus.NEW})`.mapWith(
          Number,
        ),
      })
      .from(inquiries),
    db.select({ total: sum(listingViewsDaily.views) }).from(listingViewsDaily),
    db
      .select({ total: sum(listingViewsDaily.views) })
      .from(listingViewsDaily)
      .where(gte(listingViewsDaily.day, firstDay)),
  ]);
  return {
    byStatus: new Map(byStatus.map((row) => [row.status, row.total])),
    inquiries: { total: inquiryTotals?.total ?? 0, new: inquiryTotals?.new ?? 0 },
    views: { total: toNumber(views?.total), last30Days: toNumber(recentViews?.total) },
  };
}
