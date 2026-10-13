/** Response header that asks search engines not to index a page or follow its links. */
export const NOINDEX_HEADER = { key: 'X-Robots-Tag', value: 'noindex, nofollow' };

/**
 * Whether search engines may index the site. `SITE_INDEXING=off` keeps a preview deployment
 * (e.g. preview.walls.rs) out of search results; unset or `on` allows indexing. Read at build
 * time, so changing it needs a new build. Any other value fails the build, so a typo cannot
 * silently leave a preview indexable.
 */
export function isSiteIndexable(value: string | undefined = process.env.SITE_INDEXING): boolean {
  if (value === undefined || value === '' || value === 'on') return true;
  if (value === 'off') return false;
  throw new Error(`SITE_INDEXING must be "on" or "off", not "${value}"`);
}
