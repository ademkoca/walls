import type { PriceView } from '../api/listings';
import { Currency } from '../enums';
import { type ExchangeRateQuote, convertMinorUnits, fromMinorUnits, toMinorUnits } from './money';
import { PriceMode } from './price';

/** Prices are shown in EUR until the visitor picks a currency (decision, Phase 8). */
export const DEFAULT_DISPLAY_CURRENCY: Currency = Currency.EUR;

/** A price as shown to a visitor: in their display currency, with the original if converted. */
export type DisplayPrice =
  | { mode: typeof PriceMode.ON_REQUEST }
  | (Extract<PriceView, { mode: typeof PriceMode.FIXED }> & {
      /** The stored price, when `amount` was converted from it. */
      original: { amount: number; currency: Currency } | null;
    });

/**
 * Converts a listing price to the visitor's display currency (SPEC §12). The stored price
 * stays authoritative: it is returned as `original` next to the converted amount. Without
 * a rate the price is shown as stored.
 */
export function toDisplayPrice(
  price: PriceView,
  currency: Currency,
  rate: ExchangeRateQuote | null,
): DisplayPrice {
  if (price.mode === PriceMode.ON_REQUEST) return price;
  if (price.currency === currency || !rate) return { ...price, original: null };
  const converted = convertMinorUnits(
    toMinorUnits(price.amount, price.currency),
    price.currency,
    currency,
    rate,
  );
  return {
    ...price,
    amount: fromMinorUnits(converted, currency),
    currency,
    original: { amount: price.amount, currency: price.currency },
  };
}
