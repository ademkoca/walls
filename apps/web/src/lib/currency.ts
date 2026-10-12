import {
  Currency,
  DEFAULT_DISPLAY_CURRENCY,
  type ExchangeRateView,
  enumValues,
} from '@walls/shared';

/**
 * The visitor's display currency is remembered in this preference cookie (decision,
 * Phase 8). It only changes how prices are shown; the language stays in the URL.
 */
export const CURRENCY_COOKIE = 'walls_currency';
/** One year, in seconds. */
export const CURRENCY_COOKIE_MAX_AGE = 31_536_000;

const CURRENCIES: readonly string[] = enumValues(Currency);

export function parseCurrency(value: string | undefined | null): Currency {
  return value && CURRENCIES.includes(value) ? (value as Currency) : DEFAULT_DISPLAY_CURRENCY;
}

/** How to show prices on a page: the visitor's currency and the rate to convert with. */
export interface Pricing {
  currency: Currency;
  rate: ExchangeRateView | null;
}
