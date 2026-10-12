import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { citext, id, localeEnum, reviewStatusEnum, timestamps, timestamptz } from './columns';
import { users } from './users';

/** "For real-estate agents" applications, reviewed by Admins/Super Admins (SPEC §2.1). */
export const agentApplications = pgTable(
  'agent_applications',
  {
    id: id(),
    fullName: text().notNull(),
    email: citext().notNull(),
    phone: text().notNull(),
    agencyName: text(),
    /** Language of the emails sent to the applicant and of the resulting account. */
    locale: localeEnum().notNull().default('sr'),
    status: reviewStatusEnum().notNull().default('PENDING'),
    rejectionReason: text(),
    reviewedById: uuid().references(() => users.id, { onDelete: 'restrict' }),
    reviewedAt: timestamptz(),
    /** The agent account created or activated on approval. */
    resultingUserId: uuid().references(() => users.id, { onDelete: 'restrict' }),
    ...timestamps(),
  },
  (table) => [
    index().on(table.status, table.createdAt),
    // One open application per email address.
    uniqueIndex('agent_applications_one_pending_per_email')
      .on(table.email)
      .where(sql`${table.status} = 'PENDING'`),
    check(
      'agent_applications_review_fields',
      sql`(${table.status} = 'PENDING') = (${table.reviewedAt} IS NULL AND ${table.reviewedById} IS NULL)`,
    ),
    check(
      'agent_applications_rejection_reason',
      sql`(${table.status} = 'REJECTED') = (${table.rejectionReason} IS NOT NULL)`,
    ),
    check(
      'agent_applications_approved_has_user',
      sql`(${table.status} = 'APPROVED') = (${table.resultingUserId} IS NOT NULL)`,
    ),
  ],
);

/** Supporting proof files. Private: visible to Admins/Super Admins only (SPEC §19). */
export const agentApplicationFiles = pgTable(
  'agent_application_files',
  {
    id: id(),
    applicationId: uuid()
      .notNull()
      .references(() => agentApplications.id, { onDelete: 'cascade' }),
    storageKey: text().notNull(),
    originalFileName: text().notNull(),
    /** Detected from the file content, not taken from the client. */
    mimeType: text().notNull(),
    bytes: integer().notNull(),
    /** Upload order within the application. */
    position: integer().notNull(),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('agent_application_files_position').on(table.applicationId, table.position),
    check('agent_application_files_bytes', sql`${table.bytes} > 0`),
  ],
);
