import { FOR_PROFESSIONALS_PATH, type PublicListingCard } from '@walls/shared';
import { buttonVariants } from '@walls/ui/components/button';
import { ArrowRightIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CityLinks } from '@/components/home/city-links';
import { FloorPlan } from '@/components/home/floor-plan';
import { HomeFaq } from '@/components/home/home-faq';
import { HomeSearch } from '@/components/home/home-search';
import { HowItWorks } from '@/components/home/how-it-works';
import { SeoLinks } from '@/components/home/seo-links';
import { ListingGrid } from '@/components/public/listing-card';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { Link } from '@/i18n/navigation';
import { getPublicHome } from '@/lib/api/public';
import type { Pricing } from '@/lib/currency';
import { getPricing } from '@/lib/pricing';
import { localizedAlternates, openGraph } from '@/lib/seo';

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const alternates = localizedAlternates(locale, '/');
  return { alternates, openGraph: await openGraph(locale, { url: alternates.canonical }) };
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
        <h2 id={id} className="text-4xl">
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

/**
 * Home page (SPEC §16): the floor plan (headline, platform totals on its dimension line, a room
 * per property type and the search in its hallway), city shortcuts, featured listings, the call
 * to agents, latest listings, the call to sellers, and popular searches.
 */
export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  await resolveLocale(params);
  const [t, home, pricing] = await Promise.all([
    getTranslations('home'),
    getPublicHome(),
    getPricing(),
  ]);

  return (
    <>
      <section
        aria-labelledby="home-title"
        className="mx-auto max-w-7xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8 lg:px-8"
      >
        <FloorPlan
          stats={home.stats}
          intro={
            <div className="flex h-full flex-col items-start gap-5">
              <h1
                id="home-title"
                className="max-w-xl text-5xl text-balance text-primary sm:text-6xl lg:text-7xl"
              >
                {t('title')}
              </h1>
              <p className="max-w-[46ch] text-base text-muted-foreground sm:text-lg">
                {t('subtitle')}
              </p>
              <Link
                href="/register"
                className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold underline decoration-1 underline-offset-4 hover:decoration-2"
              >
                {t('advertise')}
                <ArrowRightIcon className="size-4" aria-hidden />
              </Link>
            </div>
          }
          hallway={<HomeSearch />}
        />
      </section>

      <div className="mx-auto max-w-7xl space-y-16 px-4 py-16 sm:px-6 lg:px-8">
        <CityLinks />
        {home.featured.length > 0 && (
          <ListingSection
            id="featured-listings"
            title={t('featuredTitle')}
            listings={home.featured}
            pricing={pricing}
          />
        )}

        <section
          aria-labelledby="agent-banner"
          className="flex flex-col gap-6 border-4 border-foreground bg-card p-6 sm:p-10 md:flex-row md:items-center md:justify-between"
        >
          <div className="max-w-2xl space-y-2">
            <h2 id="agent-banner" className="text-4xl">
              {t('agentBanner.title')}
            </h2>
            <p className="text-muted-foreground">{t('agentBanner.text')}</p>
          </div>
          <Link
            href={FOR_PROFESSIONALS_PATH}
            className={buttonVariants({ size: 'xl', variant: 'outline', className: 'shrink-0' })}
          >
            {t('agentBanner.action')}
            <ArrowRightIcon data-icon="inline-end" aria-hidden />
          </Link>
        </section>

        {home.latest.length > 0 ? (
          <ListingSection
            id="latest-listings"
            title={t('latestTitle')}
            listings={home.latest}
            pricing={pricing}
          />
        ) : (
          <p className="border border-dashed border-foreground bg-card px-6 py-12 text-center text-sm text-muted-foreground">
            {t('noListings')}
          </p>
        )}

        <HowItWorks />

        <section className="flex flex-col gap-6 border-4 border-foreground bg-card p-6 sm:p-10 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-4xl">{t('advertiseTitle')}</h2>
            <p className="text-muted-foreground">{t('advertiseText')}</p>
          </div>
          <Link href="/register" className={buttonVariants({ size: 'xl', className: 'shrink-0' })}>
            {t('advertise')}
          </Link>
        </section>

        <HomeFaq />

        <SeoLinks />
      </div>
    </>
  );
}
