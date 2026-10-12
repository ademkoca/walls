import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { ComingSoon } from '@/components/layout/coming-soon';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/properties'>): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const t = await getTranslations({ locale, namespace: 'nav' });
  return { title: t('properties') };
}

export default async function PropertiesPage({ params }: PageProps<'/[locale]/properties'>) {
  await resolveLocale(params);
  const t = await getTranslations('nav');
  return <ComingSoon title={t('properties')} />;
}
