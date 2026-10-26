import {
  type Amenity,
  PriceMode,
  type PublicListingDetail,
  publicListingPath,
} from '@walls/shared';
import { Badge } from '@walls/ui/components/badge';
import { buttonVariants } from '@walls/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@walls/ui/components/card';
import { CheckIcon, ChevronLeftIcon, MailIcon, MapPinIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { AdvertiserCard } from '@/components/listing/advertiser-card';
import { InquiryForm } from '@/components/listing/inquiry-form';
import { ListingGallery } from '@/components/listing/listing-gallery';
import { ListingMap } from '@/components/listing/listing-map';
import { ViewReporter } from '@/components/listing/view-reporter';
import { PriceTag } from '@/components/public/price-tag';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { Link, getPathname } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { getPublicListing } from '@/lib/api/public';
import { formatDate } from '@/lib/intl-locale';
import { getPricing } from '@/lib/pricing';
import { absoluteUrl, jsonLd, localizedAlternates, openGraph, previewImage } from '@/lib/seo';

const DESCRIPTION_LENGTH = 160;

/** English pages fall back to the Serbian text (SPEC §31). */
function localized(text: { sr: string; en: string | null }, locale: AppLocale): string {
  return (locale === 'en' && text.en) || text.sr;
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/properties/[slug]'>): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, metadataLocale(params)]);
  const listing = await getPublicListing(slug);
  if (!listing) return {};
  const title = localized(listing.title, locale);
  const description = localized(listing.description, locale).slice(0, DESCRIPTION_LENGTH);
  // The cover cropped for link previews; the API may not send it yet, then the cover itself.
  const image = listing.linkPreviewImage ?? listing.images[0];
  const alternates = localizedAlternates(locale, publicListingPath(slug));
  return {
    title,
    description,
    alternates,
    openGraph: await openGraph(locale, {
      title,
      description,
      url: alternates.canonical,
      ...(image ? { images: [previewImage(image, title)] } : {}),
    }),
  };
}

/** schema.org data for search engines; the address only when it is public (SPEC §13, §32). */
function structuredData(listing: PublicListingDetail, locale: AppLocale) {
  const { location, price } = listing;
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: localized(listing.title, locale),
    description: localized(listing.description, locale),
    url: absoluteUrl(getPathname({ locale, href: publicListingPath(listing.slug) })),
    datePosted: listing.publishedAt,
    image: listing.images.map((image) => absoluteUrl(image.url)),
    ...(price.mode === PriceMode.FIXED
      ? { offers: { '@type': 'Offer', price: price.amount, priceCurrency: price.currency } }
      : {}),
    contentLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressCountry: location.country,
        addressLocality: location.city,
        ...(location.municipality ? { addressRegion: location.municipality } : {}),
        ...(location.postalCode ? { postalCode: location.postalCode } : {}),
        ...(location.exact
          ? { streetAddress: `${location.exact.street} ${location.exact.streetNumber}` }
          : {}),
      },
      ...(location.exact
        ? {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: location.exact.latitude,
              longitude: location.exact.longitude,
            },
          }
        : {}),
    },
  };
}

/** The public page of a published listing (SPEC §16). */
export default async function ListingPage({ params }: PageProps<'/[locale]/properties/[slug]'>) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const [listing, pricing, t, tEnums, tInquiry, format] = await Promise.all([
    getPublicListing(slug),
    getPricing(),
    getTranslations('listing'),
    getTranslations('enums'),
    getTranslations('inquiry'),
    getFormatter(),
  ]);
  if (!listing) notFound();

  const title = localized(listing.title, locale);
  const description = localized(listing.description, locale);
  const { location, attributes } = listing;
  const place = [location.neighborhood, location.municipality, location.city]
    .filter(Boolean)
    .join(', ');
  const address = location.exact ? `${location.exact.street} ${location.exact.streetNumber}` : null;
  const area = (value: number) => t('facts.areaValue', { area: format.number(value) });
  const floor = (() => {
    if (attributes.floor === 0) return t('facts.groundFloor');
    // "-1 of 4" reads oddly ("-1 od 4" even more so), so ground and basement floors stand alone.
    if (attributes.floor === null || attributes.floor < 0 || attributes.totalFloors === null) {
      return attributes.floor;
    }
    return t('facts.floorOf', { floor: String(attributes.floor), total: attributes.totalFloors });
  })();
  const facts: [string, string | number | null][] = [
    [t('facts.propertyType'), tEnums(`propertyType.${listing.propertyType}`)],
    [t('facts.transactionType'), tEnums(`transactionType.${listing.transactionType}`)],
    [t('facts.floorArea'), attributes.floorArea === null ? null : area(attributes.floorArea)],
    [t('facts.plotArea'), attributes.plotArea === null ? null : area(attributes.plotArea)],
    [t('facts.bedrooms'), attributes.bedrooms],
    [t('facts.bathrooms'), attributes.bathrooms],
    [t('facts.floor'), floor],
    [t('facts.yearBuilt'), attributes.yearBuilt],
    [t('facts.parkingSpaces'), attributes.parkingSpaces],
    [
      t('facts.heatingType'),
      attributes.heatingType && tEnums(`heatingType.${attributes.heatingType}`),
    ],
    [
      t('facts.furnishedStatus'),
      attributes.furnishedStatus && tEnums(`furnishedStatus.${attributes.furnishedStatus}`),
    ],
  ];
  const publishedOn = formatDate(locale, listing.publishedAt, { dateStyle: 'long' });

  return (
    <article className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        // JSON-LD, escaped by jsonLd() so the text cannot close the script tag.
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData(listing, locale)) }}
      />
      <ViewReporter slug={listing.slug} />
      <Link
        href="/properties"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" aria-hidden />
        {t('backToSearch')}
      </Link>

      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="accent">{tEnums(`transactionType.${listing.transactionType}`)}</Badge>
            <Badge variant="secondary">{tEnums(`propertyType.${listing.propertyType}`)}</Badge>
          </div>
          <h1 className="text-4xl font-bold text-balance sm:text-5xl">{title}</h1>
          <p className="flex items-center gap-1 text-muted-foreground">
            <MapPinIcon className="size-4 shrink-0" aria-hidden />
            {[address, place].filter(Boolean).join(', ')}
          </p>
        </div>
        <div className="shrink-0 space-y-1 md:text-right">
          <p className="sr-only">{t('price')}</p>
          <PriceTag price={listing.price} pricing={pricing} className="text-2xl font-semibold" />
          {listing.price.mode === PriceMode.FIXED && listing.price.negotiable && (
            <Badge variant="outline">{t('negotiable')}</Badge>
          )}
          {/* On narrow screens the form is far down the page. */}
          <a
            href="#inquiry"
            className={buttonVariants({ className: 'mt-2 flex w-full sm:w-auto lg:hidden' })}
          >
            <MailIcon data-icon="inline-start" />
            {tInquiry('contact')}
          </a>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-10">
          <ListingGallery images={listing.images} title={title} />

          <section className="space-y-4" aria-labelledby="listing-facts">
            <h2 id="listing-facts" className="text-2xl font-bold">
              {t('keyFacts')}
            </h2>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {facts
                .filter(([, value]) => value !== null && value !== '')
                .map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b pb-2">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
            </dl>
          </section>

          <section className="space-y-4" aria-labelledby="listing-description">
            <h2 id="listing-description" className="text-2xl font-bold">
              {t('description')}
            </h2>
            {locale === 'en' && !listing.description.en && (
              <p className="text-sm text-muted-foreground" lang="en">
                {t('serbianOnly')}
              </p>
            )}
            <p
              className="max-w-prose whitespace-pre-line"
              lang={locale === 'en' && listing.description.en ? 'en' : 'sr'}
            >
              {description}
            </p>
          </section>

          {listing.amenityCodes.length > 0 && (
            <section className="space-y-4" aria-labelledby="listing-features">
              <h2 id="listing-features" className="text-2xl font-bold">
                {t('features')}
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {listing.amenityCodes.map((code) => (
                  <li key={code} className="flex items-center gap-2">
                    <CheckIcon className="size-4 text-emphasis" aria-hidden />
                    {tEnums(`amenity.${code as Amenity}`)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-4" aria-labelledby="listing-location">
            <h2 id="listing-location" className="text-2xl font-bold">
              {t('location')}
            </h2>
            <p>{[address, place].filter(Boolean).join(', ')}</p>
            <ListingMap
              exact={location.exact}
              approximate={location.approximate}
              label={t('mapLabel')}
            />
            {!location.exact && (
              <p className="text-sm text-muted-foreground">{t('approximateNote')}</p>
            )}
          </section>
        </div>

        <aside className="space-y-4 self-start lg:sticky lg:top-24">
          <Card id="inquiry" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="text-base">{tInquiry('title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {/* An inquiry goes to the assigned agent, or else the advertiser (SPEC §20). */}
              <InquiryForm
                slug={listing.slug}
                recipientName={(listing.assignedAgent ?? listing.advertiser).displayName}
                ownerSlugs={[listing.advertiser.slug, listing.assignedAgent?.slug].filter(
                  (value) => value !== undefined,
                )}
              />
            </CardContent>
          </Card>
          <AdvertiserCard title={t('advertiser')} profile={listing.advertiser} />
          {listing.assignedAgent && (
            <AdvertiserCard
              title={t('assignedAgent', { type: listing.assignedAgent.sellerType })}
              profile={listing.assignedAgent}
            />
          )}
          <p className="text-sm text-muted-foreground">{t('published', { date: publishedOn })}</p>
        </aside>
      </div>
    </article>
  );
}
