import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { ComingSoon } from '@/components/layout/coming-soon';
import { localizedAlternates } from '@/lib/seo';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/about'>): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const t = await getTranslations({ locale, namespace: 'nav' });
  return { title: t('about'), alternates: localizedAlternates(locale, '/about') };
}

export default async function AboutPage({ params }: PageProps<'/[locale]/about'>) {
  await resolveLocale(params);
  const t = await getTranslations('nav');
  return <ComingSoon title={t('about')} />;
}
