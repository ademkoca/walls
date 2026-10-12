import { Currency } from '@walls/shared';

/** A rate as reported by a provider: 1 `base` = `rate` × `quote`. */
export interface ProviderRate {
  base: Currency;
  quote: Currency;
  /** Positive decimal string, e.g. "117.3693". */
  rate: string;
}

/**
 * Source of exchange rates (SPEC §12). The rest of the API only sees this interface, so the
 * provider can be replaced.
 */
export interface ExchangeRateProvider {
  /** Stored with each rate, e.g. "nbs". */
  readonly name: string;
  /** The current EUR → RSD rate. Throws when the provider cannot be reached. */
  fetchEurRsd(): Promise<ProviderRate>;
}

/** A set rate, for development without network access and for tests. */
export class FixedExchangeRateProvider implements ExchangeRateProvider {
  readonly name = 'fixed';

  constructor(private readonly eurRsd: string) {}

  fetchEurRsd(): Promise<ProviderRate> {
    return Promise.resolve({ base: Currency.EUR, quote: Currency.RSD, rate: this.eurRsd });
  }
}
