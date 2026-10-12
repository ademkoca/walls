import { getTranslations } from 'next-intl/server';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { AuthCard } from '@/components/auth/auth-card';
import { SetPasswordForm } from '@/components/auth/set-password-form';
import { privatePageMetadata, queryParam } from '@/lib/metadata';

export async function generateMetadata({ params }: PageProps<'/[locale]/reset-password'>) {
  return privatePageMetadata(await metadataLocale(params), 'resetPassword');
}

export default async function ResetPasswordPage({
  params,
  searchParams,
}: PageProps<'/[locale]/reset-password'>) {
  await resolveLocale(params);
  const t = await getTranslations('auth.resetPassword');
  return (
    <AuthCard title={t('title')} description={t('description')}>
      <SetPasswordForm mode="reset" token={queryParam((await searchParams).token)} />
    </AuthCard>
  );
}
