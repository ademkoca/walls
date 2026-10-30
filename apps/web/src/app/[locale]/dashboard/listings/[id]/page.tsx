import { isReviewer } from '@walls/shared';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ListingAnalyticsCard } from '@/components/analytics/listing-analytics-card';
import { ListingEditor } from '@/components/listings/editor/listing-editor';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { dashboardData } from '@/lib/api/dashboard-data';
import { getCurrentUser, getListing, getListingAnalytics } from '@/lib/api/server';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/listings/[id]'>): Promise<Metadata> {
  const t = await getTranslations({ locale: await metadataLocale(params), namespace: 'listings' });
  return { title: t('title') };
}

export default async function ListingEditorPage({
  params,
}: PageProps<'/[locale]/dashboard/listings/[id]'>) {
  await resolveLocale(params);
  const { id } = await params;
  const page = `/dashboard/listings/${id}`;
  // The API decides whether the user may see the listing.
  const [listing, user] = await Promise.all([
    dashboardData(getListing(id), page),
    dashboardData(getCurrentUser(), page),
  ]);
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
