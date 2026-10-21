import { FOR_PROFESSIONALS_PATH } from '@walls/shared';
import { getTranslations } from 'next-intl/server';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { AuthCard } from '@/components/auth/auth-card';
import { RegisterForm } from '@/components/auth/register-form';
import { Link, redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/api/server';
import { DEFAULT_AFTER_LOGIN } from '@/lib/routes';
import { privatePageMetadata } from '@/lib/metadata';

export async function generateMetadata({ params }: PageProps<'/[locale]/register'>) {
  return privatePageMetadata(await metadataLocale(params), 'register');
}

export default async function RegisterPage({ params }: PageProps<'/[locale]/register'>) {
  const locale = await resolveLocale(params);
  if (await getCurrentUser()) redirect({ href: DEFAULT_AFTER_LOGIN, locale });
  const t = await getTranslations('auth.register');
  const linkClass =
    'font-medium text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground';

  return (
    <AuthCard
      title={t('title')}
      description={t('description')}
      footer={
        <>
          <p>
            {t('haveAccount')}{' '}
            <Link href="/login" className={linkClass}>
              {t('login')}
            </Link>
          </p>
          <p>
            {t('agentPrompt')}{' '}
            <Link href={FOR_PROFESSIONALS_PATH} className={linkClass}>
              {t('agentLink')}
            </Link>
          </p>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
