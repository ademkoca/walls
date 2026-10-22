import type { AppLocale } from '@/i18n/routing';

/**
 * The Intl locale for formatting. Plain `sr` formats month and day names in Cyrillic, but
 * the site is Serbian Latin only (SPEC §31), so Serbian uses `sr-Latn`. next-intl's
 * formatter uses the routing locale, so use this wherever names (not numbers) are printed.
 */
export function intlLocale(locale: AppLocale): string {
  return locale === 'sr' ? 'sr-Latn' : locale;
}

/**
 * Serbian month names in the genitive. Intl only knows the nominative ("oktobar"), but a date
 * or "od" + month needs the genitive: "15. oktobra 2026.", "Na Walls od oktobra 2026.".
 */
const SERBIAN_GENITIVE_MONTHS: Readonly<Record<string, string>> = {
  januar: 'januara',
  februar: 'februara',
  mart: 'marta',
  april: 'aprila',
  maj: 'maja',
  jun: 'juna',
  jul: 'jula',
  avgust: 'avgusta',
  septembar: 'septembra',
  oktobar: 'oktobra',
  novembar: 'novembra',
  decembar: 'decembra',
};

/**
 * Formats a date for running text, in Latin script and, in Serbian, with the month name in
 * the genitive. Use it instead of next-intl's `format.dateTime` whenever month names are
 * printed (`dateStyle: 'long'`, `month: 'long'`); numeric styles are fine either way.
 */
export function formatDate(
  locale: AppLocale,
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), options)
    .formatToParts(new Date(date))
    .map((part) =>
      locale === 'sr' && part.type === 'month'
        ? (SERBIAN_GENITIVE_MONTHS[part.value] ?? part.value)
        : part.value,
    )
    .join('');
}
