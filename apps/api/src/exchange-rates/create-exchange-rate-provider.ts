import type { Config } from '../config';
import type { Logger } from '../logger';
import { type ExchangeRateProvider, FixedExchangeRateProvider } from './exchange-rate-provider';
import { NbsExchangeRateProvider } from './nbs-exchange-rate-provider';

/** The NBS middle rate (always in production — enforced by config), or a fixed rate. */
export function createExchangeRateProvider(config: Config, logger: Logger): ExchangeRateProvider {
  if (config.exchangeRates.provider === 'nbs') return new NbsExchangeRateProvider();
  logger.warn(
    { eurRsd: config.exchangeRates.eurRsd },
    'EXCHANGE_RATE_PROVIDER is "fixed": prices are converted at a set rate',
  );
  return new FixedExchangeRateProvider(config.exchangeRates.eurRsd);
}
