import { getTranslations } from 'next-intl/server';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { AuthCard } from '@/components/auth/auth-card';
import { GoogleSignupChoice } from '@/components/auth/google-signup-choice';
import { DemoSiteNotice } from '@/components/layout/demo-site-notice';
import { privatePageMetadata } from '@/lib/metadata';

export async function generateMetadata({ params }: PageProps<'/[locale]/continue-with-google'>) {
  return privatePageMetadata(await metadataLocale(params), 'continueWithGoogle');
}

/** Where a Google account without a Walls account lands (SPEC §3.1). */
export default async function ContinueWithGooglePage({
  params,
}: PageProps<'/[locale]/continue-with-google'>) {
  await resolveLocale(params);
  const t = await getTranslations('auth.continueWithGoogle');
  return (
    <AuthCard title={t('title')}>
      <div className="space-y-6">
        <DemoSiteNotice />
        <GoogleSignupChoice />
      </div>
    </AuthCard>
  );
}
