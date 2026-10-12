import type { AppLocale } from '@/i18n/routing';

/**
 * The Intl locale for formatting. Plain `sr` formats month and day names in Cyrillic, but
 * the site is Serbian Latin only (SPEC §31), so Serbian uses `sr-Latn`. next-intl's
 * formatter uses the routing locale, so use this wherever names (not numbers) are printed.
 */
export function intlLocale(locale: AppLocale): string {
  return locale === 'sr' ? 'sr-Latn' : locale;
}
