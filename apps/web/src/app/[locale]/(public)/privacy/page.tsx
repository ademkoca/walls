import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LegalPage, PRIVACY_SECTIONS } from '@/components/legal/legal-page';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { localizedAlternates } from '@/lib/seo';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/privacy'>): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const t = await getTranslations({ locale, namespace: 'legal.privacy' });
  return {
    title: t('title'),
    description: t('metaDescription'),
    alternates: localizedAlternates(locale, '/privacy'),
  };
}

export default async function PrivacyPage({ params }: PageProps<'/[locale]/privacy'>) {
  await resolveLocale(params);
  return <LegalPage document="privacy" sections={PRIVACY_SECTIONS} />;
}
