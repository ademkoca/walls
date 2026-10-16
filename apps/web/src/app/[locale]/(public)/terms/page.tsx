import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LegalPage, TERMS_SECTIONS } from '@/components/legal/legal-page';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { localizedAlternates } from '@/lib/seo';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/terms'>): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const t = await getTranslations({ locale, namespace: 'legal.terms' });
  return {
    title: t('title'),
    description: t('metaDescription'),
    alternates: localizedAlternates(locale, '/terms'),
  };
}

export default async function TermsPage({ params }: PageProps<'/[locale]/terms'>) {
  await resolveLocale(params);
  return <LegalPage document="terms" sections={TERMS_SECTIONS} />;
}
