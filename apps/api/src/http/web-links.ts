import { DEFAULT_LOCALE, type Locale } from '@walls/shared';

/** Absolute URL of a web app page in the given locale (Serbian unprefixed, others under /<locale>). */
export function webPageUrl(
  origin: string,
  locale: Locale,
  path: string,
  query: Record<string, string> = {},
): string {
  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  const url = new URL(`${prefix}${path}`, origin);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}
