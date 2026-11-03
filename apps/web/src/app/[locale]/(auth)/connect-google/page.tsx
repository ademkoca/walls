import { getTranslations } from 'next-intl/server';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { AuthCard } from '@/components/auth/auth-card';
import { ConnectGoogleForm } from '@/components/auth/connect-google-form';
import { privatePageMetadata, queryParam } from '@/lib/metadata';

export async function generateMetadata({ params }: PageProps<'/[locale]/connect-google'>) {
  return privatePageMetadata(await metadataLocale(params), 'connectGoogle');
}

/** Opened from the link that connects a Google account to an existing account (SPEC §3.1). */
export default async function ConnectGooglePage({
  params,
  searchParams,
}: PageProps<'/[locale]/connect-google'>) {
  await resolveLocale(params);
  const t = await getTranslations('auth.connectGoogle');
  return (
    <AuthCard title={t('title')} description={t('description')}>
      <ConnectGoogleForm token={queryParam((await searchParams).token)} />
    </AuthCard>
  );
}
