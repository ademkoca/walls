import { ListingStatus, isReviewer } from '@walls/shared';
import { cn } from '@walls/ui/lib/utils';
import { Building2Icon } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ListingsTable } from '@/components/listings/listings-table';
import { NewListingButton } from '@/components/listings/new-listing-button';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { Link } from '@/i18n/navigation';
import { getCurrentUser, getListings } from '@/lib/api/server';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/listings'>): Promise<Metadata> {
  const t = await getTranslations({ locale: await metadataLocale(params), namespace: 'listings' });
  return { title: t('title') };
}

/** Review-queue groups for Admins and Super Admins; the first is the default. */
const REVIEW_TABS = [
  { key: 'pendingReview', query: { status: ListingStatus.PENDING_REVIEW } },
  { key: 'pendingEdits', query: { pendingRevision: true } },
  { key: 'published', query: { status: ListingStatus.PUBLISHED } },
  { key: 'all', query: {} },
] as const;

export default async function ListingsPage({
  params,
  searchParams,
}: PageProps<'/[locale]/dashboard/listings'>) {
  await resolveLocale(params);
  const user = await getCurrentUser();
  if (!user) return null;
  return isReviewer(user) ? <ReviewListings tab={(await searchParams).tab} /> : <MyListings />;
}

async function MyListings() {
  const t = await getTranslations('listings');
  const listings = (await getListings()) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <NewListingButton />
      </div>

      {listings.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-card px-6 py-16 text-center">
          <Building2Icon className="size-8 text-muted-foreground" aria-hidden />
          <h2 className="text-lg font-semibold">{t('emptyTitle')}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{t('emptyDescription')}</p>
          <NewListingButton />
        </div>
      ) : (
        <ListingsTable listings={listings} />
      )}
    </div>
  );
}

async function ReviewListings({ tab }: { tab: string | string[] | undefined }) {
  const t = await getTranslations('listingsReview');
  const active = REVIEW_TABS.find((candidate) => candidate.key === tab) ?? REVIEW_TABS[0];
  const listings = (await getListings(active.query)) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-4xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <nav aria-label={t('title')} className="flex flex-wrap gap-1 border-b">
        {REVIEW_TABS.map(({ key }) => (
          <Link
            key={key}
            href={{ pathname: '/dashboard/listings', query: { tab: key } }}
            aria-current={key === active.key ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              key === active.key
                ? 'border-emphasis text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`tabs.${key}`)}
          </Link>
        ))}
      </nav>

      {listings.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          {t('empty')}
        </p>
      ) : (
        <ListingsTable listings={listings} showCreator />
      )}
    </div>
  );
}
