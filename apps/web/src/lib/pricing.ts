import 'server-only';
import { cookies } from 'next/headers';
import { getExchangeRate } from './api/public';
import { CURRENCY_COOKIE, type Pricing, parseCurrency } from './currency';

/** Reads the visitor's currency choice; pages that call this render per request. */
export async function getPricing(): Promise<Pricing> {
  const [cookieStore, rate] = await Promise.all([cookies(), getExchangeRate()]);
  return { currency: parseCurrency(cookieStore.get(CURRENCY_COOKIE)?.value), rate };
}
