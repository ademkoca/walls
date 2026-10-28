import { brand } from '@walls/ui/brand';
import '@walls/ui/globals.css';
import { Toaster } from '@walls/ui/components/sonner';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BrowserSetup } from '@/components/layout/browser-setup';
import { DemoSiteBanner } from '@/components/layout/demo-site-banner';
import { routing } from '@/i18n/routing';
import { openGraph } from '@/lib/seo';
import { fontVariables } from '../fonts';

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
    openGraph: await openGraph(locale),
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} className={fontVariables}>
      <body className="min-h-dvh">
        <NextIntlClientProvider>
          <BrowserSetup />
          <DemoSiteBanner />
          {children}
          <Toaster position="top-center" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
