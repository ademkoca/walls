import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  citext,
  reviewStatusEnum,
  id,
  localeEnum,
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
    /** Language of emails sent to the user. */
    preferredLocale: localeEnum().notNull().default('sr'),

    // Public profile (SPEC §19).
    displayName: text().notNull(),
    /** Stable public profile URL segment, e.g. /agents/marko-markovic. */
    slug: text().notNull().unique(),
    bio: text(),
    /** Provider-agnostic media storage key of the profile picture. */
    avatarStorageKey: text(),
    /** Delivery URL of the profile picture, from the media storage. */
    avatarUrl: text(),
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
      'users_avatar_key_and_url',
      sql`(${table.avatarStorageKey} IS NULL) = (${table.avatarUrl} IS NULL)`,
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

/**
 * An agent's profile change request (SPEC §4): the complete proposed public profile, which
 * replaces the live one when an Admin approves it. At most one is pending per user; further
 * edits update it.
 */
export const profileChangeRequests = pgTable(
  'profile_change_requests',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: reviewStatusEnum().notNull().default('PENDING'),
    displayName: text().notNull(),
    bio: text(),
    agencyName: text(),
    phone: text(),
    isPhonePublic: boolean().notNull(),
    isEmailPublic: boolean().notNull(),
    avatarStorageKey: text(),
    avatarUrl: text(),
    /** A new sign-in email the user has already verified. */
    newEmail: citext(),
    reviewedById: uuid().references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamptz(),
    rejectionReason: text(),
    ...timestamps(),
  },
  (table) => [
    index().on(table.userId, table.createdAt),
    index().on(table.status, table.updatedAt),
    uniqueIndex('profile_change_requests_one_pending_per_user')
      .on(table.userId)
      .where(sql`${table.status} = 'PENDING'`),
    check(
      'profile_change_requests_avatar_key_and_url',
      sql`(${table.avatarStorageKey} IS NULL) = (${table.avatarUrl} IS NULL)`,
    ),
    check(
      'profile_change_requests_review_fields',
      sql`(${table.status} = 'PENDING') = (${table.reviewedAt} IS NULL)`,
    ),
    check(
      'profile_change_requests_rejection_reason',
      sql`(${table.status} = 'REJECTED') = (${table.rejectionReason} IS NOT NULL)`,
    ),
  ],
);
