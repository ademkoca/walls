import { getTranslations } from 'next-intl/server';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { AuthCard } from '@/components/auth/auth-card';
import { LoginForm } from '@/components/auth/login-form';
import { DEFAULT_AFTER_LOGIN } from '@/lib/routes';
import { Link, redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/api/server';
import { privatePageMetadata, queryParam } from '@/lib/metadata';
import { safeRedirectPath } from '@/lib/safe-redirect';

export async function generateMetadata({ params }: PageProps<'/[locale]/login'>) {
  return privatePageMetadata(await metadataLocale(params), 'login');
}

export default async function LoginPage({ params, searchParams }: PageProps<'/[locale]/login'>) {
  const locale = await resolveLocale(params);
  const next = queryParam((await searchParams).next) ?? undefined;
  if (await getCurrentUser()) {
    redirect({ href: safeRedirectPath(next, DEFAULT_AFTER_LOGIN), locale });
  }
  const t = await getTranslations('auth.login');

  return (
    <AuthCard
      title={t('title')}
      description={t('description')}
      footer={
        <p>
          {t('noAccount')}{' '}
          <Link
            href="/register"
            className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground"
          >
            {t('register')}
          </Link>
        </p>
      }
    >
      <LoginForm {...(next ? { next } : {})} />
    </AuthCard>
  );
}
