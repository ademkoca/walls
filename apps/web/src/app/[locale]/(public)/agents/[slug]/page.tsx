import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicProfileView } from '@/components/public/public-profile-view';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { getPublicProfile } from '@/lib/api/public';
import { getPricing } from '@/lib/pricing';
import { localizedAlternates } from '@/lib/seo';

const DESCRIPTION_LENGTH = 160;

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/agents/[slug]'>): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, metadataLocale(params)]);
  const page = await getPublicProfile('agents', slug);
  if (!page) return {};
  const { displayName, bio, avatarUrl } = page.profile;
  return {
    title: displayName,
    alternates: localizedAlternates(locale, `/agents/${slug}`),
    ...(bio ? { description: bio.slice(0, DESCRIPTION_LENGTH) } : {}),
    ...(avatarUrl ? { openGraph: { images: [avatarUrl] } } : {}),
  };
}

/** Public agent profile (SPEC §19). */
export default async function AgentProfilePage({ params }: PageProps<'/[locale]/agents/[slug]'>) {
  await resolveLocale(params);
  const [page, pricing] = await Promise.all([
    getPublicProfile('agents', (await params).slug),
    getPricing(),
  ]);
  if (!page) notFound();
  return <PublicProfileView page={page} pricing={pricing} />;
}
