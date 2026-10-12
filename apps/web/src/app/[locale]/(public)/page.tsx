import type { PublicListingCard } from '@walls/shared';
import { buttonVariants } from '@walls/ui/components/button';
import { ArrowRightIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { HomeSearch } from '@/components/home/home-search';
import { ListingGrid } from '@/components/public/listing-card';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { Link } from '@/i18n/navigation';
import { getPublicHome } from '@/lib/api/public';
import type { Pricing } from '@/lib/currency';
import { getPricing } from '@/lib/pricing';
import { localizedAlternates } from '@/lib/seo';

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  return { alternates: localizedAlternates(await metadataLocale(params), '/') };
}

async function ListingSection({
  id,
  title,
  listings,
  pricing,
}: {
  id: string;
  title: string;
  listings: PublicListingCard[];
  pricing: Pricing;
}) {
  const t = await getTranslations('home');
  return (
    <section className="space-y-6" aria-labelledby={id}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id={id} className="text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        <Link
          href="/properties"
          className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
        >
          {t('seeAll')}
          <ArrowRightIcon className="size-4" aria-hidden />
        </Link>
      </div>
      <ListingGrid listings={listings} pricing={pricing} />
    </section>
  );
}

/** Home page (SPEC §16): search, featured and latest listings, and calls to action. */
export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  await resolveLocale(params);
  const [t, tNav, home, pricing] = await Promise.all([
    getTranslations('home'),
    getTranslations('nav'),
    getPublicHome(),
    getPricing(),
  ]);

  return (
    <>
      <section className="border-b bg-muted/40">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {t('title')}
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">{t('subtitle')}</p>
          <HomeSearch />
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-16 px-4 py-16 sm:px-6 lg:px-8">
        {home.featured.length > 0 && (
          <ListingSection
            id="featured-listings"
            title={t('featuredTitle')}
            listings={home.featured}
            pricing={pricing}
          />
        )}
        {home.latest.length > 0 ? (
          <ListingSection
            id="latest-listings"
            title={t('latestTitle')}
            listings={home.latest}
            pricing={pricing}
          />
        ) : (
          <p className="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
            {t('noListings')}
          </p>
        )}

        <section className="flex flex-col gap-6 rounded-xl border bg-card p-6 sm:p-10 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">{t('advertiseTitle')}</h2>
            <p className="text-muted-foreground">{t('advertiseText')}</p>
            <p className="text-muted-foreground">{t('agentsText')}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link href="/register" className={buttonVariants({ size: 'lg' })}>
              {t('advertise')}
            </Link>
            <Link href="/for-agents" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
              {tNav('forAgents')}
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
