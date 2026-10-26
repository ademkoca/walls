import type { PublicListingCard } from '@walls/shared';
import { Badge } from '@walls/ui/components/badge';
import { ImageIcon, MapPinIcon } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { Pricing } from '@/lib/currency';
import { SellerTypeBadge } from '../profiles/seller-type-badge';
import { PriceTag } from './price-tag';

/** A published listing in public lists. English pages fall back to the Serbian title. */
export function ListingCard({
  listing,
  pricing,
}: {
  listing: PublicListingCard;
  pricing: Pricing;
}) {
  const t = useTranslations('listingCard');
  const tEnums = useTranslations('enums');
  const locale = useLocale();
  const format = useFormatter();
  const title = (locale === 'en' && listing.title.en) || listing.title.sr;
  const place = [listing.neighborhood, listing.municipality, listing.city]
    .filter(Boolean)
    .join(', ');
  const area = listing.floorArea ?? listing.plotArea;

  return (
    <article className="group h-full overflow-hidden border border-foreground bg-card">
      <Link
        href={`/properties/${listing.slug}`}
        className="flex h-full flex-col focus-visible:outline-none"
      >
        <div className="relative aspect-[4/3] bg-muted">
          {listing.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.coverImageUrl}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageIcon className="size-8" aria-hidden />
              <span className="sr-only">{t('noImage')}</span>
            </div>
          )}
          <Badge variant="accent" className="absolute top-3 left-3">
            {tEnums(`transactionType.${listing.transactionType}`)}
          </Badge>
          <SellerTypeBadge sellerType={listing.sellerType} className="absolute top-3 right-3" />
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="line-clamp-2 font-semibold group-hover:underline group-focus-visible:underline">
            {title}
          </h3>
          {place && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPinIcon className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{place}</span>
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {[
              tEnums(`propertyType.${listing.propertyType}`),
              area !== null ? t('area', { area: format.number(area) }) : null,
              listing.bedrooms !== null ? t('bedrooms', { count: listing.bedrooms }) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="mt-auto pt-1">
            <PriceTag price={listing.price} pricing={pricing} className="text-lg font-semibold" />
          </div>
        </div>
      </Link>
    </article>
  );
}

/** A responsive grid of listing cards. */
export function ListingGrid({
  listings,
  pricing,
}: {
  listings: PublicListingCard[];
  pricing: Pricing;
}) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing) => (
        <li key={listing.id}>
          <ListingCard listing={listing} pricing={pricing} />
        </li>
      ))}
    </ul>
  );
}
