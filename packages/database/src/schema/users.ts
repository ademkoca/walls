import { sql } from 'drizzle-orm';
import { boolean, check, index, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import {
  citext,
  id,
  phoneVerificationStatusEnum,
  roleEnum,
  timestamps,
  timestamptz,
  userStatusEnum,
} from './columns';

export const users = pgTable(
  'users',
  {
    id: id(),
    email: citext().notNull().unique(),
    /** Null for accounts that have not completed setup (and, later, OAuth-only accounts). */
    passwordHash: text(),
    role: roleEnum().notNull(),
    status: userStatusEnum().notNull(),
    emailVerifiedAt: timestamptz(),

    // Public profile (SPEC §19).
    displayName: text().notNull(),
    /** Stable public profile URL segment, e.g. /agents/marko-markovic. */
    slug: text().notNull().unique(),
    bio: text(),
    /** Provider-agnostic media storage key of the profile picture. */
    avatarStorageKey: text(),
    agencyName: text(),
    phone: text(),
    /** Only a trusted verification process may set VERIFIED (SPEC §4). */
    phoneVerificationStatus: phoneVerificationStatusEnum().notNull().default('UNVERIFIED'),
    isPhonePublic: boolean().notNull().default(false),
    isEmailPublic: boolean().notNull().default(false),

    /** Set when an admin deactivates the account; the reason is in the audit log. */
    deactivatedAt: timestamptz(),
    ...timestamps(),
  },
  (table) => [
    index().on(table.role, table.status),
    check(
      'users_deactivated_at_matches_status',
      sql`(${table.status} = 'DEACTIVATED') = (${table.deactivatedAt} IS NOT NULL)`,
    ),
    check(
      'users_active_has_verified_email',
      sql`${table.status} <> 'ACTIVE' OR ${table.emailVerifiedAt} IS NOT NULL`,
    ),
  ],
);

/** Server-side sessions. Only a hash of the session token is stored. */
export const userSessions = pgTable(
  'user_sessions',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text().notNull().unique(),
    expiresAt: timestamptz().notNull(),
    lastSeenAt: timestamptz().notNull().defaultNow(),
    ipAddress: text(),
    userAgent: text(),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (table) => [index().on(table.userId), index().on(table.expiresAt)],
);

export const authTokenTypeEnum = pgEnum('auth_token_type', [
  'EMAIL_VERIFICATION',
  'PASSWORD_RESET',
  'ACCOUNT_SETUP',
  'EMAIL_CHANGE',
]);

/** Single-use tokens sent by email. Only a hash of the token is stored. */
export const authTokens = pgTable(
  'auth_tokens',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: authTokenTypeEnum().notNull(),
    tokenHash: text().notNull().unique(),
    /** The address being verified, for EMAIL_CHANGE tokens only. */
    newEmail: citext(),
    expiresAt: timestamptz().notNull(),
    usedAt: timestamptz(),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (table) => [
    index().on(table.userId, table.type),
    check(
      'auth_tokens_new_email_only_for_email_change',
      sql`(${table.type} = 'EMAIL_CHANGE') = (${table.newEmail} IS NOT NULL)`,
    ),
  ],
);
