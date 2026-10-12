import type { MetadataRoute } from 'next';
import { getPathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { absoluteUrl } from '@/lib/seo';

/** Crawlers may index the public site, not the dashboard or the API (SPEC §32). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        ...routing.locales.map((locale) => getPathname({ locale, href: '/dashboard' })),
      ],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
