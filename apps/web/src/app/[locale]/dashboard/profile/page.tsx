import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ProfileEditor } from '@/components/profiles/profile-editor';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { NotAccessibleError, getMyProfile } from '@/lib/api/server';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/profile'>): Promise<Metadata> {
  const t = await getTranslations({ locale: await metadataLocale(params), namespace: 'profile' });
  return { title: t('title') };
}

/** Sellers' and agents' own profile; other roles have no public profile (404). */
export default async function ProfilePage({ params }: PageProps<'/[locale]/dashboard/profile'>) {
  await resolveLocale(params);
  let profile;
  try {
    profile = await getMyProfile();
  } catch (error) {
    if (error instanceof NotAccessibleError) notFound();
    throw error;
  }
  if (!profile) return null;
  return (
    <ProfileEditor key={profile.changeRequest?.updatedAt ?? 'live'} initialProfile={profile} />
  );
}
