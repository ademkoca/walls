import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { type AppLocale, routing } from './routing';

/**
 * Reads the `[locale]` route parameter, rejects unknown locales with a 404 and enables
 * static rendering for that locale. Call at the top of every page and layout.
 */
export async function resolveLocale(params: Promise<{ locale: string }>): Promise<AppLocale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return locale;
}

/** Like `resolveLocale`, for generateMetadata (no request-locale side effect needed). */
export async function metadataLocale(params: Promise<{ locale: string }>): Promise<AppLocale> {
  const { locale } = await params;
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}
