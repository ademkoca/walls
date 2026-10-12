import { type DbExecutor, inquiries, listingTexts, listings, users } from '@walls/database';
import { InquiryStatus, Locale } from '@walls/shared';
import type { InquiryListQuery } from '@walls/validation';
import { type SQL, and, count, desc, eq, gt, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { pageBounds } from '../http/paging';
import { creator, publiclyVisible } from '../public/listing-cards';

export type InquiryRow = typeof inquiries.$inferSelect;

const recipient = alias(users, 'recipient');
const agent = alias(users, 'agent');
const serbianText = alias(listingTexts, 'sr_text');

/** A public listing that can receive inquiries, with its creator and assigned agent. */
export async function findInquirableListing(db: DbExecutor, slug: string) {
  const [row] = await db
    .select({ listing: listings, creator, title: serbianText.title })
    .from(listings)
    .innerJoin(creator, eq(creator.id, listings.createdById))
    .leftJoin(
      serbianText,
      and(eq(serbianText.listingId, listings.id), eq(serbianText.locale, Locale.SR)),
    )
    .where(and(publiclyVisible, eq(listings.slug, slug)))
    .limit(1);
  if (!row) return undefined;
  const assignedAgent = row.listing.assignedAgentId
    ? (await db.select().from(users).where(eq(users.id, row.listing.assignedAgentId)).limit(1))[0]
    : undefined;
  return { ...row, assignedAgent: assignedAgent ?? null };
}

/** Inquiries from one email address about one listing since `since`. */
export async function countRecentInquiries(
  db: DbExecutor,
  listingId: string,
  visitorEmail: string,
  since: Date,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(inquiries)
    .where(
      and(
        eq(inquiries.listingId, listingId),
        eq(inquiries.visitorEmail, visitorEmail),
        gt(inquiries.createdAt, since),
      ),
    );
  return row?.total ?? 0;
}

export async function insertInquiry(
  db: DbExecutor,
  values: typeof inquiries.$inferInsert,
): Promise<InquiryRow> {
  const [row] = await db.insert(inquiries).values(values).returning();
  return row!;
}

/** The columns every inquiry view needs. */
const viewColumns = {
  inquiry: inquiries,
  listing: {
    id: listings.id,
    slug: listings.slug,
    status: listings.status,
    createdById: listings.createdById,
  },
  title: serbianText.title,
  recipient: { id: recipient.id, displayName: recipient.displayName },
  agent: { id: agent.id, displayName: agent.displayName },
};

function viewQuery(db: DbExecutor) {
  return db
    .select(viewColumns)
    .from(inquiries)
    .innerJoin(listings, eq(listings.id, inquiries.listingId))
    .innerJoin(recipient, eq(recipient.id, inquiries.recipientUserId))
    .leftJoin(agent, eq(agent.id, inquiries.assignedAgentId))
    .leftJoin(
      serbianText,
      and(eq(serbianText.listingId, listings.id), eq(serbianText.locale, Locale.SR)),
    );
}

export type InquiryViewRow = NonNullable<Awaited<ReturnType<typeof findInquiry>>>;

export async function findInquiry(db: DbExecutor, id: string) {
  const [row] = await viewQuery(db).where(eq(inquiries.id, id)).limit(1);
  return row;
}

/**
 * Inquiries a user can see: those they received, and those about listings they created
 * (read-only when an agent handles them). `null` means every inquiry (Admins).
 */
function visibleTo(userId: string | null): SQL | undefined {
  if (userId === null) return undefined;
  return or(eq(inquiries.recipientUserId, userId), eq(listings.createdById, userId));
}

export async function findInquiries(
  db: DbExecutor,
  userId: string | null,
  query: InquiryListQuery,
) {
  const { limit, offset } = pageBounds(query.page);
  return viewQuery(db)
    .where(and(eq(inquiries.status, query.status), visibleTo(userId)))
    .orderBy(desc(inquiries.createdAt), desc(inquiries.id))
    .limit(limit)
    .offset(offset);
}

/** New inquiries a user manages; `null` counts every new inquiry (Admins). */
export async function countNewInquiries(db: DbExecutor, recipientId: string | null) {
  const [row] = await db
    .select({ total: count() })
    .from(inquiries)
    .where(
      and(
        eq(inquiries.status, InquiryStatus.NEW),
        recipientId === null ? undefined : eq(inquiries.recipientUserId, recipientId),
      ),
    );
  return row?.total ?? 0;
}

export async function lockInquiry(db: DbExecutor, id: string) {
  const [row] = await db.select().from(inquiries).where(eq(inquiries.id, id)).for('update');
  return row;
}

export async function updateInquiryStatus(
  db: DbExecutor,
  id: string,
  status: InquiryStatus,
): Promise<void> {
  await db.update(inquiries).set({ status }).where(eq(inquiries.id, id));
}

/** Inquiries a signed-in user sent, newest first, with who received them. */
export async function findSentInquiries(db: DbExecutor, senderId: string, page: number) {
  const { limit, offset } = pageBounds(page);
  return db
    .select({
      inquiry: inquiries,
      listing: { id: listings.id, slug: listings.slug, status: listings.status },
      title: serbianText.title,
      recipientName: recipient.displayName,
    })
    .from(inquiries)
    .innerJoin(listings, eq(listings.id, inquiries.listingId))
    .innerJoin(recipient, eq(recipient.id, inquiries.recipientUserId))
    .leftJoin(
      serbianText,
      and(eq(serbianText.listingId, listings.id), eq(serbianText.locale, Locale.SR)),
    )
    .where(eq(inquiries.senderUserId, senderId))
    .orderBy(desc(inquiries.createdAt), desc(inquiries.id))
    .limit(limit)
    .offset(offset);
}
