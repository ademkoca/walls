import { type Currency, type RentalPeriod, TransactionType } from '../enums';

/** A listing either has a fixed price or "price on request" — never both (SPEC §11). */
export const PriceMode = {
  FIXED: 'FIXED',
  ON_REQUEST: 'ON_REQUEST',
} as const;
export type PriceMode = (typeof PriceMode)[keyof typeof PriceMode];

export type Price =
  | { mode: typeof PriceMode.ON_REQUEST }
  | {
      mode: typeof PriceMode.FIXED;
      /** Integer minor units of `currency`; the authoritative stored value. */
      amountMinor: number;
      currency: Currency;
      /** Required for rent listings, absent for sale listings. */
      period: RentalPeriod | null;
      negotiable: boolean;
    };

export const PriceIssue = {
  AMOUNT_NOT_POSITIVE: 'AMOUNT_NOT_POSITIVE',
  PERIOD_REQUIRED_FOR_RENT: 'PERIOD_REQUIRED_FOR_RENT',
  PERIOD_NOT_ALLOWED_FOR_SALE: 'PERIOD_NOT_ALLOWED_FOR_SALE',
} as const;
export type PriceIssue = (typeof PriceIssue)[keyof typeof PriceIssue];

/** Checks a price against the listing's transaction type. "On request" is always valid. */
export function checkPrice(price: Price, transactionType: TransactionType): PriceIssue[] {
  if (price.mode === PriceMode.ON_REQUEST) return [];

  const issues: PriceIssue[] = [];
  if (!Number.isSafeInteger(price.amountMinor) || price.amountMinor <= 0) {
    issues.push(PriceIssue.AMOUNT_NOT_POSITIVE);
  }
  if (transactionType === TransactionType.RENT && price.period === null) {
    issues.push(PriceIssue.PERIOD_REQUIRED_FOR_RENT);
  }
  if (transactionType === TransactionType.SALE && price.period !== null) {
    issues.push(PriceIssue.PERIOD_NOT_ALLOWED_FOR_SALE);
  }
  return issues;
}
