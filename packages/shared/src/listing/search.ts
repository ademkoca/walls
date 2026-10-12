/** Sort orders of the public property search (SPEC §17). */
export const ListingSort = {
  NEWEST: 'NEWEST',
  PRICE_ASC: 'PRICE_ASC',
  PRICE_DESC: 'PRICE_DESC',
  AREA_ASC: 'AREA_ASC',
  AREA_DESC: 'AREA_DESC',
} as const;
export type ListingSort = (typeof ListingSort)[keyof typeof ListingSort];

export const DEFAULT_LISTING_SORT: ListingSort = ListingSort.NEWEST;

/** Results per page of the public search (divisible by 2, 3 and 4 columns). */
export const LISTING_SEARCH_PAGE_SIZE = 24;

/** "At least N" choices for the bedroom and bathroom filters. */
export const ROOM_FILTER_OPTIONS = [1, 2, 3, 4, 5] as const;

/** Featured and latest listings on the home page. */
export const HOME_LISTINGS_LIMIT = 8;
