import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { ComingSoon } from '@/components/layout/coming-soon';
import { localizedAlternates } from '@/lib/seo';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/contact'>): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const t = await getTranslations({ locale, namespace: 'nav' });
  return { title: t('contact'), alternates: localizedAlternates(locale, '/contact') };
}

export default async function ContactPage({ params }: PageProps<'/[locale]/contact'>) {
  await resolveLocale(params);
  const t = await getTranslations('nav');
  return <ComingSoon title={t('contact')} />;
}
