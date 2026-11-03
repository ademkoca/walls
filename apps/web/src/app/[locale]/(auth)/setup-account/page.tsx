import { GoogleSignInIntent } from '@walls/shared';
import { getTranslations } from 'next-intl/server';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { AuthCard } from '@/components/auth/auth-card';
import { GoogleOutcomeAlert } from '@/components/auth/google-outcome-alert';
import { GoogleSignInButton, SignInMethodDivider } from '@/components/auth/google-sign-in-button';
import { SetPasswordForm } from '@/components/auth/set-password-form';
import { getAuthProviders } from '@/lib/api/server';
import { privatePageMetadata, queryParam } from '@/lib/metadata';

export async function generateMetadata({ params }: PageProps<'/[locale]/setup-account'>) {
  return privatePageMetadata(await metadataLocale(params), 'setupAccount');
}

export default async function SetupAccountPage({
  params,
  searchParams,
}: PageProps<'/[locale]/setup-account'>) {
  await resolveLocale(params);
  const query = await searchParams;
  const token = queryParam(query.token);
  const [t, providers] = await Promise.all([
    getTranslations('auth.setupAccount'),
    getAuthProviders(),
  ]);
  return (
    <AuthCard title={t('title')} description={t('description')}>
      <div className="space-y-6">
        <GoogleOutcomeAlert outcome={queryParam(query.google)} />
        {providers.google && token && (
          <>
            <GoogleSignInButton intent={GoogleSignInIntent.SETUP} token={token} />
            <SignInMethodDivider />
          </>
        )}
        <SetPasswordForm mode="setup" token={token} />
      </div>
    </AuthCard>
  );
}
