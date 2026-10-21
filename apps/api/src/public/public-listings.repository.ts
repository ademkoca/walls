import {
  type DbExecutor,
  amenities,
  listingMedia,
  listingTexts,
  listings,
  properties,
  propertyAmenities,
  propertyLocations,
  users,
} from '@walls/database';
import { Currency, ListingSort, MediaType, Role, UserStatus, toMinorUnits } from '@walls/shared';
import type { ListingSearch } from '@walls/validation';
import {
  type SQL,
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  isNotNull,
  isNull,
  max,
  or,
  sql,
} from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { type CardRow, cardColumns, creator, publiclyVisible } from './listing-cards';

/** Search words used at most; more add little and make the query slow. */
const MAX_SEARCH_WORDS = 8;
const WORDS = /[\p{L}\p{N}]+/gu;

/**
 * A prefix query over the words of `text`, e.g. "stan vračar" → "stan:* & vračar:*".
 * Serbian has no stemmer in Postgres, so prefixes stand in: "vračar" finds "Vračaru".
 * Only letters and digits survive, so user input cannot inject query syntax.
 */
export function toPrefixQuery(text: string): string | null {
  const words = (text.match(WORDS) ?? []).slice(0, MAX_SEARCH_WORDS);
  return words.length > 0 ? words.map((word) => `${word.toLowerCase()}:*`).join(' & ') : null;
}

/** Escapes LIKE wildcards so user input matches literally. */
const likeLiteral = (text: string) => text.replaceAll(/[\\%_]/g, String.raw`\$&`);

/** Matches a place name in any of the location fields, ignoring case and accents. */
function matchesPlace(place: string): SQL {
  const pattern = `%${likeLiteral(place)}%`;
  const field = (column: AnyPgColumn) =>
    sql`walls_unaccent(${column}) ILIKE walls_unaccent(${pattern})`;
  return or(
    field(propertyLocations.city),
    field(propertyLocations.municipality),
    field(propertyLocations.neighborhood),
  )!;
}

/**
 * The listing's price in minor units of `currency`, converted with the EUR → RSD `rate`;
 * null for "price on request", or when no rate is known yet. Both currencies have two
 * minor digits, so minor units convert like major units.
 */
function priceIn(currency: Currency, rate: string | null): SQL {
  const amount = sql`${listings.priceAmountMinor}::numeric`;
  const converted =
    currency === Currency.EUR
      ? sql`${amount} / ${rate}::numeric`
      : sql`${amount} * ${rate}::numeric`;
  return sql`(CASE WHEN ${listings.priceCurrency} = ${currency} THEN ${amount} ELSE ${converted} END)`;
}

/** Floor area, or plot area for land, as on the listing card. */
const listingArea = sql`coalesce(${properties.floorArea}, ${properties.plotArea})`;

function hasAmenity(code: string): SQL {
  return sql`exists (select 1 from ${propertyAmenities} where ${propertyAmenities.propertyId} = ${properties.id} and ${propertyAmenities.amenityCode} = ${code})`;
}

function textConditions(search: ListingSearch): SQL[] {
  const conditions: SQL[] = [];
  const query = search.q ? toPrefixQuery(search.q) : null;
  if (query) {
    conditions.push(
      sql`exists (select 1 from ${listingTexts} where ${listingTexts.listingId} = ${listings.id} and ${listingTexts.searchVector} @@ to_tsquery('simple', walls_unaccent(${query})))`,
    );
  }
  // "Vračar, Beograd": every part must name the city, municipality or neighbourhood.
  const places = (search.location ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  conditions.push(...places.map(matchesPlace));
  return conditions;
}

function priceConditions(search: ListingSearch, rate: string | null): SQL[] {
  const currency = search.currency ?? Currency.EUR;
  const price = priceIn(currency, rate);
  const conditions: SQL[] = [];
  if (search.minPrice !== undefined) {
    conditions.push(sql`${price} >= ${toMinorUnits(search.minPrice, currency)}`);
  }
  if (search.maxPrice !== undefined) {
    conditions.push(sql`${price} <= ${toMinorUnits(search.maxPrice, currency)}`);
  }
  return conditions;
}

function searchConditions(search: ListingSearch, rate: string | null): SQL {
  const conditions: (SQL | undefined)[] = [
    publiclyVisible,
    ...textConditions(search),
    search.transactionType ? eq(listings.transactionType, search.transactionType) : undefined,
    search.propertyType ? eq(properties.propertyType, search.propertyType) : undefined,
    ...priceConditions(search, rate),
    search.minArea === undefined ? undefined : sql`${listingArea} >= ${search.minArea}`,
    search.maxArea === undefined ? undefined : sql`${listingArea} <= ${search.maxArea}`,
    search.bedrooms === undefined ? undefined : gte(properties.bedrooms, search.bedrooms),
    search.bathrooms === undefined ? undefined : gte(properties.bathrooms, search.bathrooms),
    search.furnishedStatus ? eq(properties.furnishedStatus, search.furnishedStatus) : undefined,
    search.sellerType ? eq(listings.sellerType, search.sellerType) : undefined,
    ...(search.amenities ?? []).map(hasAmenity),
  ];
  return and(...conditions)!;
}

/** Sort order; prices compare in EUR. Listings without a price or area come last. */
function searchOrder(sort: ListingSort, rate: string | null): SQL[] {
  const newest = [desc(listings.publishedAt), asc(listings.id)];
  const price = priceIn(Currency.EUR, rate);
  switch (sort) {
    case ListingSort.PRICE_ASC:
      return [sql`${price} ASC NULLS LAST`, ...newest];
    case ListingSort.PRICE_DESC:
      return [sql`${price} DESC NULLS LAST`, ...newest];
    case ListingSort.AREA_ASC:
      return [sql`${listingArea} ASC NULLS LAST`, ...newest];
    case ListingSort.AREA_DESC:
      return [sql`${listingArea} DESC NULLS LAST`, ...newest];
    case ListingSort.NEWEST:
      return newest;
  }
}

/**
 * One page of the public search (SPEC §17) and the number of matches. `rate` is the current
 * EUR → RSD rate, used to compare prices across currencies.
 */
export async function searchPublicListings(
  db: DbExecutor,
  search: ListingSearch,
  rate: string | null,
  pageSize: number,
): Promise<{ rows: CardRow[]; total: number }> {
  const where = searchConditions(search, rate);
  const [rows, [totals]] = await Promise.all([
    db
      .select(cardColumns)
      .from(listings)
      .innerJoin(creator, eq(creator.id, listings.createdById))
      .innerJoin(properties, eq(properties.id, listings.propertyId))
      .leftJoin(propertyLocations, eq(propertyLocations.propertyId, listings.propertyId))
      .where(where)
      .orderBy(...searchOrder(search.sort, rate))
      .limit(pageSize)
      .offset((search.page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(listings)
      .innerJoin(creator, eq(creator.id, listings.createdById))
      .innerJoin(properties, eq(properties.id, listings.propertyId))
      .leftJoin(propertyLocations, eq(propertyLocations.propertyId, listings.propertyId))
      .where(where),
  ]);
  return { rows, total: totals?.total ?? 0 };
}

/** Featured listings (SPEC §22) whose featuring has not expired, newest first. */
export async function findFeaturedListings(
  db: DbExecutor,
  limit: number,
  now = new Date(),
): Promise<CardRow[]> {
  return db
    .select(cardColumns)
    .from(listings)
    .innerJoin(creator, eq(creator.id, listings.createdById))
    .innerJoin(properties, eq(properties.id, listings.propertyId))
    .leftJoin(propertyLocations, eq(propertyLocations.propertyId, listings.propertyId))
    .where(
      and(
        publiclyVisible,
        eq(listings.isFeatured, true),
        or(isNull(listings.featuredUntil), gt(listings.featuredUntil, now)),
      ),
    )
    .orderBy(desc(listings.publishedAt), asc(listings.id))
    .limit(limit);
}

/**
 * Cities with public listings, and active professionals (agents, agencies, investors), for
 * the home page. Cities are typed in by advertisers, so they are told apart ignoring case and
 * accents.
 */
export async function countHomeStats(
  db: DbExecutor,
): Promise<{ cities: number; partners: number }> {
  const [[cityRow], [partnerRow]] = await Promise.all([
    db
      .select({
        cities: sql<number>`count(distinct lower(walls_unaccent(trim(${propertyLocations.city}))))::int`,
      })
      .from(listings)
      .innerJoin(creator, eq(creator.id, listings.createdById))
      .innerJoin(propertyLocations, eq(propertyLocations.propertyId, listings.propertyId))
      .where(publiclyVisible),
    db
      .select({ partners: count() })
      .from(users)
      .where(and(eq(users.role, Role.REAL_ESTATE_AGENT), eq(users.status, UserStatus.ACTIVE))),
  ]);
  return { cities: cityRow?.cities ?? 0, partners: partnerRow?.partners ?? 0 };
}

/** A published listing by its slug, with its creator; undefined when not public. */
export async function findPublicListing(db: DbExecutor, slug: string) {
  const [row] = await db
    .select({ ...cardColumns, creator })
    .from(listings)
    .innerJoin(creator, eq(creator.id, listings.createdById))
    .innerJoin(properties, eq(properties.id, listings.propertyId))
    .leftJoin(propertyLocations, eq(propertyLocations.propertyId, listings.propertyId))
    .where(and(publiclyVisible, eq(listings.slug, slug)))
    .limit(1);
  if (!row) return undefined;

  const { listing, property } = row;
  const [texts, amenityRows, images, assignedAgent] = await Promise.all([
    db
      .select({
        locale: listingTexts.locale,
        title: listingTexts.title,
        description: listingTexts.description,
      })
      .from(listingTexts)
      .where(eq(listingTexts.listingId, listing.id)),
    db
      .select({ code: propertyAmenities.amenityCode })
      .from(propertyAmenities)
      .innerJoin(amenities, eq(amenities.code, propertyAmenities.amenityCode))
      .where(eq(propertyAmenities.propertyId, property.id))
      .orderBy(asc(amenities.sortOrder)),
    // Only approved images are public; images added by a pending revision wait (SPEC §6).
    db
      .select({ url: listingMedia.url, width: listingMedia.width, height: listingMedia.height })
      .from(listingMedia)
      .where(
        and(
          eq(listingMedia.listingId, listing.id),
          eq(listingMedia.type, MediaType.IMAGE),
          isNotNull(listingMedia.approvedAt),
        ),
      )
      .orderBy(
        desc(listingMedia.isPrimary),
        asc(listingMedia.sortOrder),
        asc(listingMedia.createdAt),
      ),
    listing.assignedAgentId ? findActiveAgent(db, listing.assignedAgentId) : undefined,
  ]);
  return {
    ...row,
    texts,
    amenityCodes: amenityRows.map((amenity) => amenity.code),
    images,
    assignedAgent,
  };
}

async function findActiveAgent(db: DbExecutor, id: string) {
  const [agent] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.id, id),
        eq(users.role, Role.REAL_ESTATE_AGENT),
        eq(users.status, UserStatus.ACTIVE),
      ),
    )
    .limit(1);
  return agent;
}

/**
 * Pages for the sitemap (SPEC §32): public listings, active professionals, and private
 * sellers with at least one public listing (an empty seller page has nothing to find).
 */
export async function findSitemapEntries(db: DbExecutor) {
  const [listingRows, partnerRows, sellerRows] = await Promise.all([
    db
      .select({ slug: listings.slug, updatedAt: listings.updatedAt })
      .from(listings)
      .innerJoin(creator, eq(creator.id, listings.createdById))
      .where(publiclyVisible)
      .orderBy(desc(listings.publishedAt)),
    db
      .select({ slug: users.slug, updatedAt: users.updatedAt })
      .from(users)
      .where(and(eq(users.role, Role.REAL_ESTATE_AGENT), eq(users.status, UserStatus.ACTIVE)))
      .orderBy(asc(users.slug)),
    db
      .select({ slug: creator.slug, updatedAt: max(listings.updatedAt) })
      .from(listings)
      .innerJoin(creator, eq(creator.id, listings.createdById))
      .where(and(publiclyVisible, eq(creator.role, Role.PRIVATE_SELLER)))
      .groupBy(creator.slug)
      .orderBy(asc(creator.slug)),
  ]);
  return { listingRows, partnerRows, sellerRows };
}
