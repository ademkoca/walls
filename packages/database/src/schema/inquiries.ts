import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { citext, id, inquiryStatusEnum, timestamps } from './columns';
import { listings } from './listings';
import { users } from './users';

/** Visitor inquiries about a listing (SPEC §20). Visitors have no account. */
export const inquiries = pgTable(
  'inquiries',
  {
    id: id(),
    listingId: uuid()
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    /** Resolved server-side at creation: the assigned agent, otherwise the advertiser. */
    recipientUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** The listing's assigned agent when the inquiry was created, if any. */
    assignedAgentId: uuid().references(() => users.id, { onDelete: 'restrict' }),
    visitorName: text().notNull(),
    visitorEmail: citext().notNull(),
    visitorPhone: text(),
    message: text().notNull(),
    status: inquiryStatusEnum().notNull().default('NEW'),
    ...timestamps(),
  },
  (table) => [
    index().on(table.recipientUserId, table.status, table.createdAt),
    index().on(table.listingId, table.createdAt),
  ],
);
