import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { currencyEnum, id, localeEnum, timestamptz } from './columns';
import { users } from './users';

/**
 * Cached exchange rates (SPEC §12). Each refresh inserts a row; the latest `fetchedAt`
 * for a pair is current. 1 `base` = `rate` × `quote`.
 */
export const exchangeRates = pgTable(
  'exchange_rates',
  {
    id: id(),
    base: currencyEnum().notNull(),
    quote: currencyEnum().notNull(),
    /** Kept as string to avoid floating-point loss; see `convertMinorUnits` in @walls/shared. */
    rate: numeric({ precision: 20, scale: 10, mode: 'string' }).notNull(),
    provider: text().notNull(),
    fetchedAt: timestamptz().notNull(),
  },
  (table) => [
    index().on(table.base, table.quote, table.fetchedAt.desc()),
    check('exchange_rates_positive', sql`${table.rate} > 0`),
    check('exchange_rates_distinct_currencies', sql`${table.base} <> ${table.quote}`),
  ],
);

export const emailStatusEnum = pgEnum('email_status', ['PENDING', 'SENT', 'FAILED']);

/**
 * Transactional email outbox (SPEC §21). Emails are written in the same transaction as
 * the change that triggers them and delivered by a worker through `EmailService`.
 * `payload` holds template variables only; it is cleared once the email is sent because
 * it can contain single-use links.
 */
export const emailOutbox = pgTable(
  'email_outbox',
  {
    id: id(),
    template: text().notNull(),
    recipientEmail: text().notNull(),
    locale: localeEnum().notNull(),
    payload: jsonb().$type<Record<string, unknown>>(),
    status: emailStatusEnum().notNull().default('PENDING'),
    attempts: integer().notNull().default(0),
    lastError: text(),
    nextAttemptAt: timestamptz().notNull().defaultNow(),
    sentAt: timestamptz(),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (table) => [
    index('email_outbox_pending_idx')
      .on(table.nextAttemptAt)
      .where(sql`${table.status} = 'PENDING'`),
    check('email_outbox_attempts', sql`${table.attempts} >= 0`),
  ],
);

/**
 * Generic audit trail for important changes (SPEC §25). `before`/`after` hold the changed
 * fields only; the entity itself stays relational in its own table.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    /** Null for system-initiated changes. */
    actorId: uuid().references(() => users.id, { onDelete: 'restrict' }),
    /** Stable action identifier, e.g. LISTING_APPROVED or USER_DEACTIVATED. */
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text().notNull(),
    before: jsonb().$type<Record<string, unknown>>(),
    after: jsonb().$type<Record<string, unknown>>(),
    /** Justification for the change, e.g. a rejection or deactivation reason. */
    reason: text(),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (table) => [
    index().on(table.entityType, table.entityId, table.createdAt),
    index().on(table.actorId, table.createdAt),
  ],
);
