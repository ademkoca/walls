import type { Page } from '@walls/shared';

/** Rows per page in administration lists. */
export const ADMIN_PAGE_SIZE = 50;

/** Query bounds for one page; one extra row is fetched to tell whether more exist. */
export function pageBounds(page: number, size = ADMIN_PAGE_SIZE) {
  return { limit: size + 1, offset: (page - 1) * size };
}

/** Trims the extra row fetched to detect a next page. */
export function toPage<Row, Item>(
  rows: Row[],
  page: number,
  map: (row: Row) => Item,
  size = ADMIN_PAGE_SIZE,
): Page<Item> {
  return { items: rows.slice(0, size).map(map), page, hasMore: rows.length > size };
}
