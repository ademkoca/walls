import { Currency } from '@walls/shared';
import { z } from 'zod';
import type { ExchangeRateProvider, ProviderRate } from './exchange-rate-provider';

/**
 * Today's EUR rate list entry. kurs.resenje.org is a free service (no key) that republishes
 * the National Bank of Serbia's official exchange rate list (decision, Phase 8).
 */
export const NBS_EUR_RATE_URL = 'https://kurs.resenje.org/api/v1/currencies/eur/rates/today';
const REQUEST_TIMEOUT_MS = 10_000;

const responseSchema = z.object({
  code: z.literal('EUR'),
  /** Units of the foreign currency the rate is for; 1 for EUR. */
  parity: z.literal(1),
  exchange_middle: z.number().positive(),
});

/** The NBS middle rate ("srednji kurs"), the rate Serbian property prices conventionally use. */
export class NbsExchangeRateProvider implements ExchangeRateProvider {
  readonly name = 'nbs';

  constructor(
    private readonly url = NBS_EUR_RATE_URL,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async fetchEurRsd(): Promise<ProviderRate> {
    const response = await this.fetchImpl(this.url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`NBS rate request failed with HTTP ${response.status}`);
    const body = responseSchema.parse(await response.json());
    // JSON numbers print in their shortest exact form, e.g. 117.3693.
    return { base: Currency.EUR, quote: Currency.RSD, rate: String(body.exchange_middle) };
  }
}
