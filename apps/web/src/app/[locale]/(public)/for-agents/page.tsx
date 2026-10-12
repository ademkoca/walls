import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { ComingSoon } from '@/components/layout/coming-soon';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/for-agents'>): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const t = await getTranslations({ locale, namespace: 'nav' });
  return { title: t('forAgents') };
}

export default async function ForAgentsPage({ params }: PageProps<'/[locale]/for-agents'>) {
  await resolveLocale(params);
  const t = await getTranslations('nav');
  return <ComingSoon title={t('forAgents')} />;
}
