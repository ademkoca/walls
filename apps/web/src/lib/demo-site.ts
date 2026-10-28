import { DEFAULT_LOCALE } from '@walls/shared';
import { brand } from '@walls/ui/brand';

/**
 * Whether this build is the demo and test site (preview.walls.rs), which shows a banner on
 * every page and a notice on the sign-up pages so nobody mistakes it for Walls itself.
 * `NEXT_PUBLIC_DEMO_SITE=on` turns it on; unset or `off` (production) leaves it off. Inlined at
 * build time, so changing it needs a new build. Any other value fails the build, so a typo
 * cannot silently put the banner on, or take it off, the wrong site.
 */
export function isDemoSite(value: string | undefined = process.env.NEXT_PUBLIC_DEMO_SITE): boolean {
  if (value === undefined || value === '' || value === 'off') return false;
  if (value === 'on') return true;
  throw new Error(`NEXT_PUBLIC_DEMO_SITE must be "on" or "off", not "${value}"`);
}

/** The real site's home page in the given language, which the demo site points visitors to. */
export function realSiteUrl(locale: string): string {
  return locale === DEFAULT_LOCALE ? brand.siteUrl : `${brand.siteUrl}/${locale}`;
}
