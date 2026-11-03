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
  authProviderEnum,
  citext,
  reviewStatusEnum,
  id,
  localeEnum,
  phoneVerificationStatusEnum,
  roleEnum,
  sellerTypeEnum,
  timestamps,
  timestamptz,
  userStatusEnum,
} from './columns';

export const users = pgTable(
  'users',
  {
    id: id(),
    email: citext().notNull().unique(),
    /** Null for accounts that have not completed setup, and for accounts that sign in only with Google. */
    passwordHash: text(),
    role: roleEnum().notNull(),
    /**
     * The kind of advertiser (SPEC §5): PRIVATE_SELLER for private sellers; agent, agency or
     * investor for professionals (all with the REAL_ESTATE_AGENT role); null for admins.
     */
    sellerType: sellerTypeEnum(),
    status: userStatusEnum().notNull(),
    emailVerifiedAt: timestamptz(),
    /** Language of emails sent to the user. */
    preferredLocale: localeEnum().notNull().default('sr'),

    // Public profile (SPEC §19).
    displayName: text().notNull(),
    /** Stable public profile URL segment, e.g. /partners/marko-markovic. */
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
      'users_seller_type_matches_role',
      sql`CASE ${table.role}
        WHEN 'PRIVATE_SELLER' THEN ${table.sellerType} IS NOT DISTINCT FROM 'PRIVATE_SELLER'
        WHEN 'REAL_ESTATE_AGENT' THEN COALESCE(${table.sellerType} IN ('REAL_ESTATE_AGENT', 'AGENCY', 'INVESTOR'), false)
        ELSE ${table.sellerType} IS NULL
      END`,
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
    /**
     * When the user last confirmed who they are with Google in this session; accounts
     * without a password do this before changing their email (SPEC §3.1).
     */
    reauthenticatedAt: timestamptz(),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (table) => [index().on(table.userId), index().on(table.expiresAt)],
);

/**
 * External accounts a user signs in with (SPEC §3.1): at most one per provider and user, and
 * each external account belongs to one user. Matched by the provider's permanent user ID,
 * never by email, so changing either email keeps the connection.
 */
export const userIdentities = pgTable(
  'user_identities',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: authProviderEnum().notNull(),
    /** The provider's permanent user ID (Google's `sub` claim). */
    providerUserId: text().notNull(),
    /** The external account's email when it was connected; informational only. */
    email: citext().notNull(),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_identities_provider_user').on(table.provider, table.providerUserId),
    uniqueIndex('user_identities_one_per_provider').on(table.userId, table.provider),
  ],
);

export const authTokenTypeEnum = pgEnum('auth_token_type', [
  'EMAIL_VERIFICATION',
  'PASSWORD_RESET',
  'ACCOUNT_SETUP',
  'EMAIL_CHANGE',
  'GOOGLE_LINK',
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
    /** The external account to connect, for GOOGLE_LINK tokens only. */
    provider: authProviderEnum(),
    providerUserId: text(),
    providerEmail: citext(),
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
    check(
      'auth_tokens_identity_only_for_google_link',
      sql`(${table.type} = 'GOOGLE_LINK') = (${table.provider} IS NOT NULL)
        AND (${table.provider} IS NULL) = (${table.providerUserId} IS NULL)
        AND (${table.provider} IS NULL) = (${table.providerEmail} IS NULL)`,
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
