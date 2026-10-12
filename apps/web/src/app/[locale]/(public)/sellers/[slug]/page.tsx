import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicProfileView } from '@/components/public/public-profile-view';
import { resolveLocale } from '@/i18n/locale-param';
import { getPublicProfile } from '@/lib/api/public';

const DESCRIPTION_LENGTH = 160;

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/sellers/[slug]'>): Promise<Metadata> {
  const page = await getPublicProfile('sellers', (await params).slug);
  if (!page) return {};
  const { displayName, bio, avatarUrl } = page.profile;
  return {
    title: displayName,
    ...(bio ? { description: bio.slice(0, DESCRIPTION_LENGTH) } : {}),
    ...(avatarUrl ? { openGraph: { images: [avatarUrl] } } : {}),
  };
}

/** Public private-seller profile (SPEC §19). */
export default async function SellerProfilePage({ params }: PageProps<'/[locale]/sellers/[slug]'>) {
  await resolveLocale(params);
  const page = await getPublicProfile('sellers', (await params).slug);
  if (!page) notFound();
  return <PublicProfileView page={page} />;
}
