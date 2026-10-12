import { type DbExecutor, exchangeRates } from '@walls/database';
import type { Currency } from '@walls/shared';
import { and, desc, eq } from 'drizzle-orm';

export type ExchangeRateRow = typeof exchangeRates.$inferSelect;

/** The most recently retrieved rate for a currency pair. */
export async function findLatestRate(
  db: DbExecutor,
  base: Currency,
  quote: Currency,
): Promise<ExchangeRateRow | undefined> {
  const [row] = await db
    .select()
    .from(exchangeRates)
    .where(and(eq(exchangeRates.base, base), eq(exchangeRates.quote, quote)))
    .orderBy(desc(exchangeRates.fetchedAt))
    .limit(1);
  return row;
}

export async function insertRate(
  db: DbExecutor,
  values: typeof exchangeRates.$inferInsert,
): Promise<void> {
  await db.insert(exchangeRates).values(values);
}
