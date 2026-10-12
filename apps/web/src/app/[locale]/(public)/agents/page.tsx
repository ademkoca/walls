import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { ComingSoon } from '@/components/layout/coming-soon';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/agents'>): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const t = await getTranslations({ locale, namespace: 'nav' });
  return { title: t('agents') };
}

export default async function AgentsPage({ params }: PageProps<'/[locale]/agents'>) {
  await resolveLocale(params);
  const t = await getTranslations('nav');
  return <ComingSoon title={t('agents')} />;
}
