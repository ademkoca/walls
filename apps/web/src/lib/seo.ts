import type { LinkPreviewImage } from '@walls/shared';
import { brand } from '@walls/ui/brand';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getPathname } from '@/i18n/navigation';
import { type AppLocale, routing } from '@/i18n/routing';

type OpenGraph = NonNullable<Metadata['openGraph']>;

const OPEN_GRAPH_LOCALES: Record<AppLocale, string> = { sr: 'sr_RS', en: 'en_US' };

/** The logo card in `app/opengraph-image.png`, served at this path. */
const DEFAULT_OPEN_GRAPH_IMAGE = { url: '/opengraph-image.png', width: 1200, height: 630 };

/**
 * Open Graph data for link previews. Next.js replaces a parent's `openGraph` as a whole
 * instead of merging it, so the root layout and every page that sets its own start from
 * this: the site name, the locale, and the logo card unless the page has its own image.
 */
export async function openGraph(locale: AppLocale, page: OpenGraph = {}): Promise<OpenGraph> {
  const t = await getTranslations({ locale, namespace: 'metadata' });
  return {
    siteName: brand.name,
    locale: OPEN_GRAPH_LOCALES[locale],
    type: 'website',
    images: [
      {
        ...DEFAULT_OPEN_GRAPH_IMAGE,
        alt: t('imageAlt', { brand: brand.name, descriptor: brand.descriptor }),
      },
    ],
    ...page,
  };
}

/** A page's own link preview image, with its size when the API knows it. */
export function previewImage(image: LinkPreviewImage, alt: string) {
  const { url, width, height } = image;
  return { url, alt, ...(width && height ? { width, height } : {}) };
}

/**
 * Canonical URL and hreflang alternates of a public page (SPEC §32). Relative URLs are
 * resolved against `metadataBase` (NEXT_PUBLIC_SITE_URL). Serbian is the default
 * (`x-default`) language.
 */
export function localizedAlternates(
  locale: AppLocale,
  href: string,
  query?: Record<string, string>,
): { canonical: string; languages: Record<string, string> } {
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
