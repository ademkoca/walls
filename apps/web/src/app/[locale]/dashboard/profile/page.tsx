import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProfileEditor } from '@/components/profiles/profile-editor';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { dashboardData } from '@/lib/api/dashboard-data';
import { getMyProfile } from '@/lib/api/server';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/profile'>): Promise<Metadata> {
  const t = await getTranslations({ locale: await metadataLocale(params), namespace: 'profile' });
  return { title: t('title') };
}

/** Sellers' and agents' own profile; other roles have no public profile (404). */
export default async function ProfilePage({ params }: PageProps<'/[locale]/dashboard/profile'>) {
  await resolveLocale(params);
  const profile = await dashboardData(getMyProfile(), '/dashboard/profile');
  return (
    <ProfileEditor key={profile.changeRequest?.updatedAt ?? 'live'} initialProfile={profile} />
  );
}
