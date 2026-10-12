import type { Currency } from '../enums';

/** Decimal places of each currency's minor unit (EUR cents, RSD para). */
export const CURRENCY_MINOR_DIGITS: Readonly<Record<Currency, number>> = {
  EUR: 2,
  RSD: 2,
};

/** Converts an amount in major units (e.g. 1200.5 EUR) to integer minor units (120050). */
export function toMinorUnits(amount: number, currency: Currency): number {
  if (!Number.isFinite(amount)) throw new RangeError('Amount must be a finite number');
  const minor = Math.round(amount * 10 ** CURRENCY_MINOR_DIGITS[currency]);
  if (!Number.isSafeInteger(minor)) throw new RangeError('Amount is out of range');
  return minor;
}

export function fromMinorUnits(amountMinor: number, currency: Currency): number {
  return amountMinor / 10 ** CURRENCY_MINOR_DIGITS[currency];
}

/** 1 unit of `base` equals `rate` units of `quote`, as retrieved from the provider at `fetchedAt`. */
export interface ExchangeRate {
  base: Currency;
  quote: Currency;
  /** Positive decimal string, kept as text to avoid floating-point loss (e.g. "117.1734"). */
  rate: string;
  fetchedAt: Date;
}

/** The part of an exchange rate that conversion needs. */
export type ExchangeRateQuote = Pick<ExchangeRate, 'base' | 'quote' | 'rate'>;

const DECIMAL_PATTERN = /^(\d+)(?:\.(\d+))?$/;

/** Parses a positive decimal string into an exact fraction numerator / 10^scale. */
function parseRate(rate: string): { numerator: bigint; denominator: bigint } {
  const match = DECIMAL_PATTERN.exec(rate);
  if (!match) throw new RangeError(`Invalid exchange rate: ${rate}`);
  const [, whole = '', fraction = ''] = match;
  const numerator = BigInt(whole + fraction);
  if (numerator === 0n) throw new RangeError('Exchange rate must be positive');
  return { numerator, denominator: 10n ** BigInt(fraction.length) };
}

/** Divides with rounding half away from zero. */
function divideRounded(numerator: bigint, denominator: bigint): bigint {
  const sign = numerator < 0n !== denominator < 0n ? -1n : 1n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  return sign * ((2n * n + d) / (2n * d));
}

/**
 * Converts an amount between currencies for display. The stored original price is never
 * changed (SPEC §12). Supports converting in either direction of the given rate.
 */
export function convertMinorUnits(
  amountMinor: number,
  from: Currency,
  to: Currency,
  exchangeRate: ExchangeRateQuote,
): number {
  if (!Number.isSafeInteger(amountMinor)) throw new RangeError('Amount must be a safe integer');
  if (from === to) return amountMinor;

  const { numerator, denominator } = parseRate(exchangeRate.rate);
  const digitShift = BigInt(CURRENCY_MINOR_DIGITS[to] - CURRENCY_MINOR_DIGITS[from]);
  const scale = digitShift >= 0n ? 10n ** digitShift : 1n;
  const unscale = digitShift < 0n ? 10n ** -digitShift : 1n;
  const amount = BigInt(amountMinor) * scale;

  let converted: bigint;
  if (from === exchangeRate.base && to === exchangeRate.quote) {
    converted = divideRounded(amount * numerator, denominator * unscale);
  } else if (from === exchangeRate.quote && to === exchangeRate.base) {
    converted = divideRounded(amount * denominator, numerator * unscale);
  } else {
    throw new RangeError(
      `Exchange rate ${exchangeRate.base}/${exchangeRate.quote} cannot convert ${from} to ${to}`,
    );
  }
  return Number(converted);
}
