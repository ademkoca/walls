import { brand } from '@walls/ui/brand';
import type { Metadata } from 'next';
import { getPathname } from '@/i18n/navigation';
import { type AppLocale, routing } from '@/i18n/routing';

/**
 * Canonical URL and hreflang alternates of a public page (SPEC §32). Relative URLs are
 * resolved against `metadataBase` (NEXT_PUBLIC_SITE_URL). Serbian is the default
 * (`x-default`) language.
 */
export function localizedAlternates(
  locale: AppLocale,
  href: string,
  query?: Record<string, string>,
): NonNullable<Metadata['alternates']> {
  const url = (target: AppLocale) =>
    getPathname({ locale: target, href: query ? { pathname: href, query } : href });
  const languages: Record<string, string> = Object.fromEntries(
    routing.locales.map((target) => [target, url(target)]),
  );
  languages['x-default'] = url(routing.defaultLocale);
  return { canonical: url(locale), languages };
}

/** Serializes JSON-LD for a <script> tag, so text cannot close the tag early. */
export function jsonLd(data: object): string {
  return JSON.stringify(data).replaceAll('<', String.raw`<`);
}

/** An absolute URL on this site, for structured data (which needs absolute URLs). */
export function absoluteUrl(path: string): string {
  return new URL(path, process.env.NEXT_PUBLIC_SITE_URL ?? brand.siteUrl).toString();
}
