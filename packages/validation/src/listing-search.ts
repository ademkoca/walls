import {
  AMENITIES,
  Currency,
  DEFAULT_LISTING_SORT,
  ListingSort,
  PropertyType,
  ROOM_FILTER_OPTIONS,
  TransactionType,
  enumValues,
} from '@walls/shared';
import { z } from 'zod';
import { LISTING_INPUT_LIMITS } from './listing';

export const LISTING_SEARCH_LIMITS = {
  textMaxLength: 100,
  /** Price bounds are in the visitor's currency, so they may exceed a stored EUR price. */
  maxPrice: 10_000_000_000_000,
  maxPage: 500,
} as const;

const S = LISTING_SEARCH_LIMITS;
const MAX_ROOMS_FILTER = ROOM_FILTER_OPTIONS.at(-1)!;

const text = z.string().trim().max(S.textMaxLength);
const price = z.coerce.number().positive().max(S.maxPrice);
const area = z.coerce.number().positive().max(LISTING_INPUT_LIMITS.maxAreaM2);
const rooms = z.coerce.number().int().min(1).max(MAX_ROOMS_FILTER);
/** Comma-separated amenity codes, e.g. "ELEVATOR,PARKING"; listings must have all of them. */
const amenities = z
  .string()
  .transform((value) => [...new Set(value.split(',').filter(Boolean))])
  .pipe(z.array(z.enum(AMENITIES)).max(AMENITIES.length));

/**
 * Public property search (SPEC §17). All parameters live in the URL so results can be
 * shared; `minPrice`/`maxPrice` are in `currency` (EUR when absent). Room filters mean
 * "at least".
 */
const listingSearchShape = {
  q: text.optional(),
  location: text.optional(),
  transactionType: z.enum(enumValues(TransactionType)).optional(),
  propertyType: z.enum(enumValues(PropertyType)).optional(),
  minPrice: price.optional(),
  maxPrice: price.optional(),
  currency: z.enum(enumValues(Currency)).optional(),
  minArea: area.optional(),
  maxArea: area.optional(),
  bedrooms: rooms.optional(),
  bathrooms: rooms.optional(),
  amenities: amenities.optional(),
  sort: z.enum(enumValues(ListingSort)).default(DEFAULT_LISTING_SORT),
  page: z.coerce.number().int().min(1).max(S.maxPage).default(1),
};

/** The API's search query: anything invalid is a 400. */
export const listingSearchQuerySchema = z.strictObject(listingSearchShape);
export type ListingSearch = z.output<typeof listingSearchQuerySchema>;

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Reads a search from page URL parameters, dropping invalid or unknown values instead of
 * failing, so a mistyped or outdated link still shows results.
 */
export function parseListingSearch(params: SearchParams): ListingSearch {
  const valid: Record<string, string> = {};
  for (const [key, schema] of Object.entries(listingSearchShape)) {
    const raw = params[key];
    if (typeof raw !== 'string' || raw.trim() === '') continue;
    if (schema.safeParse(raw).success) valid[key] = raw;
  }
  return listingSearchQuerySchema.parse(valid);
}

/**
 * The URL query for a search, without defaults and empty values. The currency is kept only
 * with a price bound, where it gives the bound its meaning.
 */
export function listingSearchToQuery(search: Partial<ListingSearch>): Record<string, string> {
  const hasPrice = search.minPrice !== undefined || search.maxPrice !== undefined;
  const omitted: Partial<Record<string, unknown>> = {
    sort: DEFAULT_LISTING_SORT,
    page: 1,
    ...(hasPrice ? {} : { currency: search.currency }),
  };
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(search)) {
    const text = Array.isArray(value) ? value.join(',') : String(value ?? '');
    if (text !== '' && omitted[key] !== value) query[key] = text;
  }
  return query;
}

/** Whether the search narrows the results (anything beyond sorting and paging). */
export function hasListingFilters(search: ListingSearch): boolean {
  const { sort: _sort, page: _page, currency: _currency, ...filters } = search;
  return Object.values(filters).some(
    (value) => value !== undefined && !(Array.isArray(value) && value.length === 0),
  );
}
