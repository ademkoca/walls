import { FOR_PROFESSIONALS_PATH, type PublicListingCard } from '@walls/shared';
import { buttonVariants } from '@walls/ui/components/button';
import { ArrowRightIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CityLinks } from '@/components/home/city-links';
import { HeroBackdrop } from '@/components/home/hero-backdrop';
import { HomeFaq } from '@/components/home/home-faq';
import { HomeSearch } from '@/components/home/home-search';
import { HomeStats } from '@/components/home/home-stats';
import { HowItWorks } from '@/components/home/how-it-works';
import { PropertyTypeLinks } from '@/components/home/property-type-links';
import { SeoLinks } from '@/components/home/seo-links';
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

/**
 * Home page (SPEC §16): a hero with rotating photos and the two main calls to action, the
 * search with platform totals, property-type shortcuts, featured listings, the call to agents,
 * latest listings, the call to sellers, and popular searches.
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
        className="relative isolate overflow-hidden bg-sidebar text-sidebar-foreground"
      >
        <HeroBackdrop />
        {/* Darkens the photos so the text stays readable: evenly on phones, where the text spans
            the width, and from the left on wider screens. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-sidebar/60 md:bg-transparent md:bg-linear-to-r md:from-sidebar/85 md:via-sidebar/60 md:to-sidebar/10"
        />
        <div className="relative mx-auto flex min-h-[30rem] max-w-7xl flex-col items-start justify-center gap-6 px-4 py-20 sm:min-h-[34rem] sm:px-6 lg:min-h-[40rem] lg:px-8">
          <h1
            id="home-title"
            className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            {t('title')}
          </h1>
          <p className="max-w-2xl text-lg text-sidebar-foreground/85">{t('subtitle')}</p>
          <div className="flex w-full flex-col gap-3 pt-2 sm:w-auto sm:flex-row">
            <Link href="/properties" className={buttonVariants({ size: 'xl' })}>
              {t('browse')}
              <ArrowRightIcon data-icon="inline-end" aria-hidden />
            </Link>
            {/* The hero's light text would otherwise carry over onto the light button. */}
            <Link
              href="/register"
              className={buttonVariants({
                size: 'xl',
                variant: 'outline',
                className: 'text-foreground',
              })}
            >
              {t('advertise')}
            </Link>
          </div>
        </div>
      </section>

      <div className="border-b bg-muted/40">
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
          <HomeSearch />
          <HomeStats stats={home.stats} />
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-16 px-4 py-16 sm:px-6 lg:px-8">
        <PropertyTypeLinks />
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
          className="flex flex-col gap-6 rounded-xl bg-sidebar p-6 text-sidebar-foreground sm:p-10 md:flex-row md:items-center md:justify-between"
        >
          <div className="max-w-2xl space-y-2">
            <h2 id="agent-banner" className="text-2xl font-semibold tracking-tight">
              {t('agentBanner.title')}
            </h2>
            <p className="text-sidebar-foreground/85">{t('agentBanner.text')}</p>
          </div>
          <Link
            href={FOR_PROFESSIONALS_PATH}
            className={buttonVariants({ size: 'xl', className: 'shrink-0' })}
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
          <p className="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
            {t('noListings')}
          </p>
        )}

        <HowItWorks />

        <section className="flex flex-col gap-6 rounded-xl border bg-card p-6 sm:p-10 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">{t('advertiseTitle')}</h2>
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
