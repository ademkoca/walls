import { DEFAULT_LOCALE, Locale, enumValues } from '@walls/shared';
import { defineRouting } from 'next-intl/routing';

/**
 * Serbian (Latin) is served at unprefixed URLs and English under /en (SPEC §31).
 * The URL alone decides the language: no browser-language redirects and no locale
 * cookie, so every URL is stable for visitors and search engines.
 */
export const routing = defineRouting({
  locales: enumValues(Locale),
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'as-needed',
  localeDetection: false,
  localeCookie: false,
});

export type AppLocale = (typeof routing.locales)[number];
