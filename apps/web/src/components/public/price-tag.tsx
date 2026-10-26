import {
  type Currency,
  PriceMode,
  type PriceView,
  type RentalPeriod,
  toDisplayPrice,
} from '@walls/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { cn } from '@walls/ui/lib/utils';
import type { Pricing } from '@/lib/currency';

/** Formats an amount with its currency and, for rentals, the period ("600 € / month"). */
export function usePriceFormat() {
  const t = useTranslations('listingCard');
  const format = useFormatter();
  return (amount: number, currency: Currency, period: RentalPeriod | null) => {
    const value = format.number(amount, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    });
    return period ? t('perPeriod', { price: value, period: t(`period.${period}`) }) : value;
  };
}

/**
 * A listing price in the visitor's currency (SPEC §12). A converted price is marked as
 * approximate and the price as listed is shown with it.
 */
export function PriceTag({
  price,
  pricing,
  className,
}: {
  price: PriceView;
  pricing: Pricing;
  className?: string;
}) {
  const t = useTranslations('listingCard');
  const formatPrice = usePriceFormat();
  const display = toDisplayPrice(price, pricing.currency, pricing.rate);
  if (display.mode === PriceMode.ON_REQUEST) {
    return <p className={cn('font-mono', className)}>{t('priceOnRequest')}</p>;
  }
  const amount = formatPrice(display.amount, display.currency, display.period);
  return (
    <div>
      <p className={cn('font-mono tabular-nums', className)}>
        {display.original ? t('approximately', { price: amount }) : amount}
      </p>
      {display.original && (
        <p className="text-sm text-muted-foreground">
          {t('original', {
            price: formatPrice(display.original.amount, display.original.currency, display.period),
          })}
        </p>
      )}
    </div>
  );
}
