import { PARTNERS_PATH } from '@walls/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicProfileView } from '@/components/public/public-profile-view';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { getPublicProfile } from '@/lib/api/public';
import { getPricing } from '@/lib/pricing';
import { localizedAlternates, openGraph, previewImage } from '@/lib/seo';

const DESCRIPTION_LENGTH = 160;

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/partners/[slug]'>): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, metadataLocale(params)]);
  const page = await getPublicProfile('partners', slug);
  if (!page) return {};
  const { displayName, bio, avatarUrl } = page.profile;
  const alternates = localizedAlternates(locale, `${PARTNERS_PATH}/${slug}`);
  // The profile picture cropped for link previews (the API may not send it yet), or the
  // site's logo card when there is no picture.
  const image =
    page.linkPreviewImage ?? (avatarUrl ? { url: avatarUrl, width: null, height: null } : null);
  return {
    title: displayName,
    alternates,
    ...(bio ? { description: bio.slice(0, DESCRIPTION_LENGTH) } : {}),
    openGraph: await openGraph(locale, {
      url: alternates.canonical,
      ...(image ? { images: [previewImage(image, displayName)] } : {}),
    }),
    // A square picture shows whole in the small card, not cropped to a wide one.
    ...(image ? { twitter: { card: 'summary' } } : {}),
  };
}

/** Public profile of an agent, agency or investor (SPEC §19). */
export default async function PartnerProfilePage({
  params,
}: PageProps<'/[locale]/partners/[slug]'>) {
  await resolveLocale(params);
  const [page, pricing] = await Promise.all([
    getPublicProfile('partners', (await params).slug),
    getPricing(),
  ]);
  if (!page) notFound();
  return <PublicProfileView page={page} pricing={pricing} />;
}
