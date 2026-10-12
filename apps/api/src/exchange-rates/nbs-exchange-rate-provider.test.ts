import { describe, expect, it } from 'vitest';
import { NbsExchangeRateProvider } from './nbs-exchange-rate-provider';

/** A recorded response of the rate list service. */
const TODAY = {
  code: 'EUR',
  date: '2026-10-12',
  date_from: '2026-10-12',
  number: 194,
  parity: 1,
  cash_buy: 116.5477,
  cash_sell: 118.1909,
  exchange_buy: 117.0172,
  exchange_middle: 117.3693,
  exchange_sell: 117.7214,
};

const respond =
  (body: unknown, status = 200): typeof fetch =>
  () =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('NBS exchange rate provider', () => {
  it('reads the middle rate as an exact decimal string', async () => {
    const provider = new NbsExchangeRateProvider('https://rates.test', respond(TODAY));
    await expect(provider.fetchEurRsd()).resolves.toEqual({
      base: 'EUR',
      quote: 'RSD',
      rate: '117.3693',
    });
  });

  it('fails on an HTTP error or an unexpected response, so the stored rate stays', async () => {
    await expect(
      new NbsExchangeRateProvider('https://rates.test', respond({}, 503)).fetchEurRsd(),
    ).rejects.toThrow(/503/);
    await expect(
      new NbsExchangeRateProvider(
        'https://rates.test',
        respond({ ...TODAY, exchange_middle: 0 }),
      ).fetchEurRsd(),
    ).rejects.toThrow();
  });
});
