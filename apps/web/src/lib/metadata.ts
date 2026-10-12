import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';

/** Metadata for account pages: translated title, never indexed by search engines. */
export async function privatePageMetadata(
  locale: AppLocale,
  titleKey:
    | 'login'
    | 'register'
    | 'verifyEmail'
    | 'forgotPassword'
    | 'resetPassword'
    | 'setupAccount'
    | 'confirmEmail',
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t(`${titleKey}.title`), robots: { index: false, follow: false } };
}

/** Reads a single string query parameter. */
export function queryParam(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}
