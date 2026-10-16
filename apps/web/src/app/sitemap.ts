import { publicListingPath, publicProfilePath, Role } from '@walls/shared';
import type { MetadataRoute } from 'next';
import { getPathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { getSitemapEntries } from '@/lib/api/public';
import { absoluteUrl } from '@/lib/seo';

// Lists the current listings and profiles, so it is built per request, never at build time.
export const dynamic = 'force-dynamic';

const STATIC_PAGES = [
  '/',
  '/properties',
  '/agents',
  '/for-agents',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
];

/** Every language version of a page, each listing the others as alternates (SPEC §32). */
function localizedEntries(href: string, lastModified?: string): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    routing.locales.map((locale) => [locale, absoluteUrl(getPathname({ locale, href }))]),
  );
  return routing.locales.map((locale) => ({
    url: languages[locale]!,
    ...(lastModified ? { lastModified } : {}),
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { listings, agents, sellers } = await getSitemapEntries();
  return [
    ...STATIC_PAGES.flatMap((href) => localizedEntries(href)),
    ...listings.flatMap((entry) =>
      localizedEntries(publicListingPath(entry.slug), entry.updatedAt),
    ),
    ...agents.flatMap((entry) =>
      localizedEntries(publicProfilePath(Role.REAL_ESTATE_AGENT, entry.slug)!, entry.updatedAt),
    ),
    ...sellers.flatMap((entry) =>
      localizedEntries(publicProfilePath(Role.PRIVATE_SELLER, entry.slug)!, entry.updatedAt),
    ),
  ];
}
