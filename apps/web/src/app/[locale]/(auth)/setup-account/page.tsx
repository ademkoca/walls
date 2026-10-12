import { getTranslations } from 'next-intl/server';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { AuthCard } from '@/components/auth/auth-card';
import { SetPasswordForm } from '@/components/auth/set-password-form';
import { privatePageMetadata, queryParam } from '@/lib/metadata';

export async function generateMetadata({ params }: PageProps<'/[locale]/setup-account'>) {
  return privatePageMetadata(await metadataLocale(params), 'setupAccount');
}

export default async function SetupAccountPage({
  params,
  searchParams,
}: PageProps<'/[locale]/setup-account'>) {
  await resolveLocale(params);
  const t = await getTranslations('auth.setupAccount');
  return (
    <AuthCard title={t('title')} description={t('description')}>
      <SetPasswordForm mode="setup" token={queryParam((await searchParams).token)} />
    </AuthCard>
  );
}
