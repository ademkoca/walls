import { getTranslations } from 'next-intl/server';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { AuthCard } from '@/components/auth/auth-card';
import { ConfirmEmailForm } from '@/components/auth/confirm-email-form';
import { privatePageMetadata, queryParam } from '@/lib/metadata';

export async function generateMetadata({ params }: PageProps<'/[locale]/confirm-email'>) {
  return privatePageMetadata(await metadataLocale(params), 'confirmEmail');
}

/** Opened from the link emailed to a new sign-in address (SPEC §4). */
export default async function ConfirmEmailPage({
  params,
  searchParams,
}: PageProps<'/[locale]/confirm-email'>) {
  await resolveLocale(params);
  const t = await getTranslations('auth.confirmEmail');
  return (
    <AuthCard title={t('title')} description={t('description')}>
      <ConfirmEmailForm token={queryParam((await searchParams).token)} />
    </AuthCard>
  );
}
