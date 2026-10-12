import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Building2Icon } from 'lucide-react';
import { ListingsTable } from '@/components/listings/listings-table';
import { NewListingButton } from '@/components/listings/new-listing-button';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { getMyListings } from '@/lib/api/server';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/listings'>): Promise<Metadata> {
  const t = await getTranslations({ locale: await metadataLocale(params), namespace: 'listings' });
  return { title: t('title') };
}

export default async function ListingsPage({ params }: PageProps<'/[locale]/dashboard/listings'>) {
  await resolveLocale(params);
  const t = await getTranslations('listings');
  const listings = (await getMyListings()) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
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
