import { getTranslations } from 'next-intl/server';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { AuthCard } from '@/components/auth/auth-card';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { Link } from '@/i18n/navigation';
import { privatePageMetadata } from '@/lib/metadata';

export async function generateMetadata({ params }: PageProps<'/[locale]/forgot-password'>) {
  return privatePageMetadata(await metadataLocale(params), 'forgotPassword');
}

export default async function ForgotPasswordPage({
  params,
}: PageProps<'/[locale]/forgot-password'>) {
  await resolveLocale(params);
  const t = await getTranslations('auth.forgotPassword');
  return (
    <AuthCard
      title={t('title')}
      description={t('description')}
      footer={
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          {t('backToLogin')}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
