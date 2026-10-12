import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ListingEditor } from '@/components/listings/editor/listing-editor';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { NotAccessibleError, getListing } from '@/lib/api/server';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/listings/[id]'>): Promise<Metadata> {
  const t = await getTranslations({ locale: await metadataLocale(params), namespace: 'listings' });
  return { title: t('title') };
}

/** Loads the listing on the server; the API decides whether the user may see it. */
async function loadListing(id: string) {
  try {
    return await getListing(id);
  } catch (error) {
    if (error instanceof NotAccessibleError) notFound();
    throw error;
  }
}

export default async function ListingEditorPage({
  params,
}: PageProps<'/[locale]/dashboard/listings/[id]'>) {
  await resolveLocale(params);
  const { id } = await params;
  const listing = await loadListing(id);
  // The dashboard layout already redirects signed-out visitors.
  if (!listing) return null;

  return <ListingEditor key={listing.id} initialListing={listing} />;
}
