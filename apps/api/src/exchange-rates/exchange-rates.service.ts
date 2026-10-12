import type { Database } from '@walls/database';
import { Currency, type ExchangeRateView } from '@walls/shared';
import type { Logger } from '../logger';
import type { ExchangeRateProvider } from './exchange-rate-provider';
import { findLatestRate, insertRate } from './exchange-rates.repository';

const HOUR_MS = 3_600_000;
/** A stored rate is refreshed once it is this old: about twice a day (SPEC §12). */
export const RATE_MAX_AGE_MS = 12 * HOUR_MS;
/** How often the API checks whether the rate is due for a refresh. */
export const RATE_CHECK_INTERVAL_MS = HOUR_MS;

/** "117.3693000000" (as stored) → "117.3693". */
function trimDecimal(value: string): string {
  return value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;
}

/**
 * EUR/RSD exchange rates (SPEC §12). Rates are fetched from the provider in the background
 * and stored with their retrieval time; page views only read the stored rate. If a refresh
 * fails, the last stored rate stays in use.
 */
export class ExchangeRatesService {
  constructor(
    private readonly db: Database,
    private readonly provider: ExchangeRateProvider,
    private readonly logger: Logger,
  ) {}

  /** The latest stored EUR → RSD rate, or null before the first successful refresh. */
  async current(): Promise<ExchangeRateView | null> {
    const row = await findLatestRate(this.db, Currency.EUR, Currency.RSD);
    if (!row) return null;
    return {
      base: row.base,
      quote: row.quote,
      rate: trimDecimal(row.rate),
      provider: row.provider,
      fetchedAt: row.fetchedAt.toISOString(),
    };
  }

  /** Fetches and stores a new rate when the stored one is missing or too old. */
  async refreshIfStale(now = new Date()): Promise<boolean> {
    const latest = await findLatestRate(this.db, Currency.EUR, Currency.RSD);
    if (latest && now.getTime() - latest.fetchedAt.getTime() < RATE_MAX_AGE_MS) return false;
    const fetched = await this.provider.fetchEurRsd();
    await insertRate(this.db, { ...fetched, provider: this.provider.name, fetchedAt: now });
    this.logger.info(
      { provider: this.provider.name, rate: fetched.rate },
      'Exchange rate refreshed',
    );
    return true;
  }
}

/** Refreshes the rate now and then every `intervalMs` when it is due. Returns a stop function. */
export function startExchangeRateRefresher(
  service: ExchangeRatesService,
  logger: Logger,
  intervalMs = RATE_CHECK_INTERVAL_MS,
): () => void {
  let running = false;
  const check = () => {
    if (running) return;
    running = true;
    service
      .refreshIfStale()
      .catch((error: unknown) =>
        logger.warn({ err: error }, 'Exchange rate refresh failed; keeping the stored rate'),
      )
      .finally(() => {
        running = false;
      });
  };
  check();
  const timer = setInterval(check, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
