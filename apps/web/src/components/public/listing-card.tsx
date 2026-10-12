import { PriceMode, type PriceView, type PublicListingCard } from '@walls/shared';
import { Badge } from '@walls/ui/components/badge';
import { ImageIcon, MapPinIcon } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

function usePriceLabel() {
  const t = useTranslations('listingCard');
  const format = useFormatter();
  return (price: PriceView) => {
    if (price.mode === PriceMode.ON_REQUEST) return t('priceOnRequest');
    const amount = format.number(price.amount, {
      style: 'currency',
      currency: price.currency,
      maximumFractionDigits: 0,
    });
    return price.period
      ? t('perPeriod', { price: amount, period: t(`period.${price.period}`) })
      : amount;
  };
}

/** A published listing in public lists. English pages fall back to the Serbian title. */
export function ListingCard({ listing }: { listing: PublicListingCard }) {
  const t = useTranslations('listingCard');
  const tEnums = useTranslations('enums');
  const locale = useLocale();
  const format = useFormatter();
  const priceLabel = usePriceLabel();
  const title = (locale === 'en' && listing.title.en) || listing.title.sr;
  const place = [listing.neighborhood, listing.municipality, listing.city]
    .filter(Boolean)
    .join(', ');
  const area = listing.floorArea ?? listing.plotArea;

  return (
    <article className="group overflow-hidden rounded-lg border bg-card">
      <Link href={`/properties/${listing.slug}`} className="block focus-visible:outline-none">
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
          <Badge className="absolute top-3 left-3">
            {tEnums(`transactionType.${listing.transactionType}`)}
          </Badge>
        </div>
        <div className="space-y-2 p-4">
          <p className="text-lg font-semibold">{priceLabel(listing.price)}</p>
          <h3 className="line-clamp-2 font-medium group-hover:underline group-focus-visible:underline">
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
        </div>
      </Link>
    </article>
  );
}
