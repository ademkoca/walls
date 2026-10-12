import { brand } from '@walls/ui/brand';
import '@walls/ui/globals.css';
import { Toaster } from '@walls/ui/components/sonner';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { uiFont } from '../fonts';

const OPEN_GRAPH_LOCALES = { sr: 'sr_RS', en: 'en_US' } as const;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'metadata' });
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? brand.siteUrl),
    title: {
      default: t('title', { brand: brand.name }),
      template: t('titleTemplate', { brand: brand.name }),
    },
    description: t('description'),
    applicationName: brand.name,
    openGraph: { siteName: brand.name, locale: OPEN_GRAPH_LOCALES[locale], type: 'website' },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} className={uiFont.variable}>
      <body className="min-h-dvh">
        <NextIntlClientProvider>
          {children}
          <Toaster position="top-center" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
