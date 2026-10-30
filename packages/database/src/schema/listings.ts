import { sql } from 'drizzle-orm';
import type { ListingContent } from '@walls/shared';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  currencyEnum,
  id,
  listingStatusEnum,
  localeEnum,
  mediaTypeEnum,
  priceModeEnum,
  rentalPeriodEnum,
  reviewStatusEnum,
  sellerTypeEnum,
  timestamps,
  timestamptz,
  transactionTypeEnum,
  tsvector,
} from './columns';
import { properties } from './properties';
import { users } from './users';

/** An offer (sale or rent) concerning a property (SPEC §7). */
export const listings = pgTable(
  'listings',
  {
    id: id(),
    propertyId: uuid()
      .notNull()
      .references(() => properties.id, { onDelete: 'restrict' }),
    /** Immutable; a database trigger rejects changes (SPEC §5). */
    createdById: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    sellerType: sellerTypeEnum().notNull(),
    /** Nullable while the listing is a draft. */
    transactionType: transactionTypeEnum(),
    status: listingStatusEnum().notNull().default('DRAFT'),

    // Price (SPEC §11): fixed price or "on request", never both.
    priceMode: priceModeEnum().notNull().default('ON_REQUEST'),
    /** Integer minor units of `priceCurrency` (e.g. euro cents). */
    priceAmountMinor: bigint({ mode: 'number' }),
    priceCurrency: currencyEnum(),
    pricePeriod: rentalPeriodEnum(),
    priceNegotiable: boolean().notNull().default(false),

    /** Hidden by default to prevent accidental location leakage (SPEC §13). */
    isExactAddressPublic: boolean().notNull().default(false),
    isFeatured: boolean().notNull().default(false),
    featuredUntil: timestamptz(),
    /** Assigned at first publication and never changed afterwards (SPEC §32). */
    slug: text().unique(),
    /** Latest rejection reason; kept when the listing is revised back to draft. */
    rejectionReason: text(),
    /** First publication, used for "newest" sorting. */
    publishedAt: timestamptz(),
    /** Soft delete of a draft by its creator (SPEC §24). */
    deletedAt: timestamptz(),
    ...timestamps(),
  },
  (table) => [
    index().on(table.status, table.transactionType),
    index().on(table.propertyId),
    index().on(table.createdById),
    index('listings_published_at_idx')
      .on(table.publishedAt.desc())
      .where(sql`${table.status} = 'PUBLISHED'`),
    index('listings_featured_idx')
      .on(table.featuredUntil)
      .where(sql`${table.isFeatured} AND ${table.status} = 'PUBLISHED'`),
    // CHECK constraints pass when the expression is NULL, so comparisons on nullable
    // columns are guarded with IS NOT NULL / IS TRUE.
    check(
      'listings_price_shape',
      sql`(${table.priceMode} = 'ON_REQUEST'
            AND ${table.priceAmountMinor} IS NULL AND ${table.priceCurrency} IS NULL
            AND ${table.pricePeriod} IS NULL AND NOT ${table.priceNegotiable})
          OR (${table.priceMode} = 'FIXED'
            AND ${table.priceAmountMinor} IS NOT NULL AND ${table.priceAmountMinor} > 0
            AND ${table.priceCurrency} IS NOT NULL)`,
    ),
    check(
      'listings_rental_period_only_for_rent',
      sql`${table.pricePeriod} IS NULL OR (${table.transactionType} = 'RENT') IS TRUE`,
    ),
    check(
      'listings_rejected_has_reason',
      sql`${table.status} <> 'REJECTED' OR ${table.rejectionReason} IS NOT NULL`,
    ),
    check(
      'listings_published_has_slug',
      sql`${table.status} NOT IN ('PUBLISHED', 'SOLD', 'RENTED', 'ARCHIVED') OR (${table.slug} IS NOT NULL AND ${table.publishedAt} IS NOT NULL)`,
    ),
    check(
      'listings_only_drafts_deleted',
      sql`${table.deletedAt} IS NULL OR ${table.status} = 'DRAFT'`,
    ),
    check(
      'listings_featured_until_requires_featured',
      sql`${table.featuredUntil} IS NULL OR ${table.isFeatured}`,
    ),
  ],
);

/** Title and description per locale; Serbian is required for submission (SPEC §31). */
export const listingTexts = pgTable(
  'listing_texts',
  {
    listingId: uuid()
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    locale: localeEnum().notNull(),
    title: text().notNull(),
    description: text().notNull(),
    /**
     * Keyword search (SPEC §17): words of the title and description without accents. The
     * "simple" configuration has no stemming, so search uses prefix matching instead.
     */
    searchVector: tsvector()
      .notNull()
      .generatedAlwaysAs(sql`to_tsvector('simple', walls_unaccent(title || ' ' || description))`),
    updatedAt: timestamptz()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.listingId, table.locale] }),
    index('listing_texts_search_idx').using('gin', table.searchVector),
  ],
);

/** Listing media as first-class records (SPEC §15). Provider details stay behind `storageKey`. */
export const listingMedia = pgTable(
  'listing_media',
  {
    id: id(),
    listingId: uuid()
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    type: mediaTypeEnum().notNull(),
    storageKey: text().notNull(),
    url: text().notNull(),
    sortOrder: integer().notNull(),
    isPrimary: boolean().notNull().default(false),
    altText: text(),
    /** Measured server-side from the uploaded content. Null for external media (e.g. tours). */
    mimeType: text(),
    bytes: integer(),
    width: integer(),
    height: integer(),
    /** Null until the media passes review; only approved media is shown publicly. */
    approvedAt: timestamptz(),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (table) => [
    index().on(table.listingId, table.sortOrder),
    uniqueIndex('listing_media_one_primary_per_listing')
      .on(table.listingId)
      .where(sql`${table.isPrimary}`),
    check('listing_media_sort_order', sql`${table.sortOrder} >= 0`),
    check('listing_media_bytes', sql`${table.bytes} > 0`),
    check('listing_media_dimensions', sql`${table.width} > 0 AND ${table.height} > 0`),
  ],
);

/** Every lifecycle transition, for history and auditing. */
export const listingStatusHistory = pgTable(
  'listing_status_history',
  {
    id: id(),
    listingId: uuid()
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    /** Null for the initial DRAFT entry. */
    fromStatus: listingStatusEnum(),
    toStatus: listingStatusEnum().notNull(),
    actorId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** Rejection reason, when the transition is a rejection. */
    reason: text(),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (table) => [index().on(table.listingId, table.createdAt)],
);

/** Daily view counts per listing (SPEC §23). */
export const listingViewsDaily = pgTable(
  'listing_views_daily',
  {
    listingId: uuid()
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    day: date({ mode: 'string' }).notNull(),
    views: integer().notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.listingId, table.day] }),
    check('listing_views_daily_views', sql`${table.views} >= 0`),
  ],
);

/**
 * Visitors already counted for a listing on a day, so a visitor counts once per day
 * (decision, Phase 9). `visitorHash` is an HMAC of IP address and browser with a key that
 * changes every day: it cannot be traced back to a person or linked across days. Rows of
 * past days are deleted; only `listing_views_daily` keeps the counts.
 */
export const listingViewVisitors = pgTable(
  'listing_view_visitors',
  {
    listingId: uuid()
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    day: date({ mode: 'string' }).notNull(),
    visitorHash: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.listingId, table.day, table.visitorHash] }),
    index().on(table.day),
  ],
);

/**
 * Major edits of a published listing awaiting review (SPEC §6). The live listing stays
 * relational and unchanged; `content` is the complete proposed version (validated by the
 * API with the shared schemas) and is written into the relational tables on approval.
 * Images added by the revision are `listing_media` rows without `approved_at`; images it
 * removes are listed in `removed_media_ids` and deleted on approval.
 */
export const listingRevisions = pgTable(
  'listing_revisions',
  {
    id: id(),
    listingId: uuid()
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    status: reviewStatusEnum().notNull().default('PENDING'),
    content: jsonb().$type<ListingContent>().notNull(),
    removedMediaIds: uuid()
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    /** The editor who last changed the revision. */
    updatedById: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    reviewedById: uuid().references(() => users.id, { onDelete: 'restrict' }),
    reviewedAt: timestamptz(),
    rejectionReason: text(),
    ...timestamps(),
  },
  (table) => [
    index().on(table.listingId, table.createdAt),
    // At most one open revision per listing.
    uniqueIndex('listing_revisions_one_pending_per_listing')
      .on(table.listingId)
      .where(sql`${table.status} = 'PENDING'`),
    index('listing_revisions_pending_idx')
      .on(table.updatedAt)
      .where(sql`${table.status} = 'PENDING'`),
    check(
      'listing_revisions_rejected_has_reason',
      sql`${table.status} <> 'REJECTED' OR ${table.rejectionReason} IS NOT NULL`,
    ),
    check(
      'listing_revisions_reviewed',
      sql`(${table.status} = 'PENDING') = (${table.reviewedAt} IS NULL)`,
    ),
  ],
);
