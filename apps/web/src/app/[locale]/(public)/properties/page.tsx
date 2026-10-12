import { buttonVariants } from '@walls/ui/components/button';
import {
  type ListingSearch,
  hasListingFilters,
  listingSearchToQuery,
  parseListingSearch,
} from '@walls/validation';
import { ChevronLeftIcon, ChevronRightIcon, SearchXIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { ListingGrid } from '@/components/public/listing-card';
import { MobileFilters } from '@/components/search/mobile-filters';
import { SearchFilters } from '@/components/search/search-filters';
import { SortSelect } from '@/components/search/sort-select';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { Link } from '@/i18n/navigation';
import { searchListings } from '@/lib/api/public';
import { intlLocale } from '@/lib/intl-locale';
import { getPricing } from '@/lib/pricing';
import { localizedAlternates } from '@/lib/seo';

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<'/[locale]/properties'>): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const t = await getTranslations({ locale, namespace: 'search' });
  const search = parseListingSearch(await searchParams);
  const page = search.page > 1 ? { page: String(search.page) } : undefined;
  return {
    title: t('title'),
    description: t('description'),
    alternates: localizedAlternates(locale, '/properties', page),
    // Every filter combination is its own URL; only the plain list is indexed.
    ...(hasListingFilters(search) ? { robots: { index: false, follow: true } } : {}),
  };
}

/** The number of filters set, shown on the mobile "Filters" button. */
function activeFilterCount(search: ListingSearch): number {
  const { sort: _sort, page: _page, currency: _currency, amenities, ...rest } = search;
  return (
    Object.values(rest).filter((value) => value !== undefined).length + (amenities?.length ?? 0)
  );
}

/** Public property search (SPEC §16–17): every filter, the sort and the page are in the URL. */
export default async function PropertiesPage({
  params,
  searchParams,
}: PageProps<'/[locale]/properties'>) {
  await resolveLocale(params);
  const search = parseListingSearch(await searchParams);
  const [t, locale, pricing, result] = await Promise.all([
    getTranslations('search'),
    getLocale(),
    getPricing(),
    searchListings(search),
  ]);
  // Price bounds keep the currency they were entered in; new ones use the visitor's.
  const hasPriceBound = search.minPrice !== undefined || search.maxPrice !== undefined;
  const priceCurrency = (hasPriceBound && search.currency) || pricing.currency;
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const filtered = hasListingFilters(search);
  const rateDate = pricing.rate
    ? new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: 'long' }).format(
        new Date(pricing.rate.fetchedAt),
      )
    : null;
  const pageHref = (page: number) => ({
    pathname: '/properties',
    query: listingSearchToQuery({ ...search, page }),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          {/* A new search (e.g. "Clear filters") starts the form again from the URL. */}
          <SearchFilters
            key={JSON.stringify(listingSearchToQuery(search))}
            search={search}
            priceCurrency={priceCurrency}
          />
        </aside>

        <section className="min-w-0 space-y-6" aria-labelledby="search-results">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <MobileFilters
                search={search}
                priceCurrency={priceCurrency}
                activeCount={activeFilterCount(search)}
              />
              <h2 id="search-results" className="font-medium" aria-live="polite">
                {t('resultCount', { count: result.total })}
              </h2>
            </div>
            <SortSelect search={search} />
          </div>

          {result.items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-card px-6 py-16 text-center">
              <SearchXIcon className="size-8 text-muted-foreground" aria-hidden />
              <p className="font-medium">{t('emptyTitle')}</p>
              <p className="max-w-sm text-sm text-muted-foreground">{t('emptyDescription')}</p>
              {filtered && (
                <Link href="/properties" className={buttonVariants({ variant: 'outline' })}>
                  {t('clear')}
                </Link>
              )}
            </div>
          ) : (
            <ListingGrid listings={result.items} pricing={pricing} />
          )}

          {pages > 1 && (
            <nav className="flex items-center justify-between gap-2" aria-label={t('pagination')}>
              {search.page > 1 ? (
                <Link
                  href={pageHref(search.page - 1)}
                  rel="prev"
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  <ChevronLeftIcon data-icon="inline-start" />
                  {t('previous')}
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-muted-foreground">
                {t('pageOf', { page: search.page, pages })}
              </span>
              {result.hasMore ? (
                <Link
                  href={pageHref(search.page + 1)}
                  rel="next"
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  {t('next')}
                  <ChevronRightIcon data-icon="inline-end" />
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}

          {rateDate && (
            <p className="text-xs text-muted-foreground">{t('rateNote', { date: rateDate })}</p>
          )}
        </section>
      </div>
    </div>
  );
}
