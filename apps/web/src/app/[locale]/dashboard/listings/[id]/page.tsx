import { isReviewer } from '@walls/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ListingAnalyticsCard } from '@/components/analytics/listing-analytics-card';
import { ListingEditor } from '@/components/listings/editor/listing-editor';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import {
  NotAccessibleError,
  getCurrentUser,
  getListing,
  getListingAnalytics,
} from '@/lib/api/server';

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
  const [listing, user] = await Promise.all([loadListing(id), getCurrentUser()]);
  // The dashboard layout already redirects signed-out visitors.
  if (!listing || !user) return null;
  // Views and inquiries exist once the listing has been public (SPEC §23).
  const analytics = listing.publishedAt ? await getListingAnalytics(id) : null;

  return (
    <ListingEditor
      key={`${listing.id}-${listing.updatedAt}`}
      initialListing={listing}
      viewerIsReviewer={isReviewer(user)}
      insights={analytics && <ListingAnalyticsCard analytics={analytics} />}
    />
  );
}
