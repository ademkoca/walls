import { getTranslations } from 'next-intl/server';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { AuthCard } from '@/components/auth/auth-card';
import { VerifyEmailForm } from '@/components/auth/verify-email-form';
import { privatePageMetadata, queryParam } from '@/lib/metadata';

export async function generateMetadata({ params }: PageProps<'/[locale]/verify-email'>) {
  return privatePageMetadata(await metadataLocale(params), 'verifyEmail');
}

export default async function VerifyEmailPage({
  params,
  searchParams,
}: PageProps<'/[locale]/verify-email'>) {
  await resolveLocale(params);
  const t = await getTranslations('auth.verifyEmail');
  return (
    <AuthCard title={t('title')} description={t('description')}>
      <VerifyEmailForm token={queryParam((await searchParams).token)} />
    </AuthCard>
  );
}
