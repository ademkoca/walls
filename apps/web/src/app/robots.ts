import type { MetadataRoute } from 'next';
import { getPathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { absoluteUrl } from '@/lib/seo';
import { isSiteIndexable } from '@/lib/site-indexing';

/**
 * Crawlers may index the public site, not the dashboard or the API (SPEC §32). A preview
 * deployment (SITE_INDEXING=off) does not advertise its sitemap; crawling stays allowed so
 * crawlers see the noindex header sent with every response (next.config.ts).
 */
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
    ...(isSiteIndexable() ? { sitemap: absoluteUrl('/sitemap.xml') } : {}),
  };
}
