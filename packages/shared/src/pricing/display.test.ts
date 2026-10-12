import { describe, expect, it } from 'vitest';
import type { PriceView } from '../api/listings';
import { toDisplayPrice } from './display';

const RATE = { base: 'EUR', quote: 'RSD', rate: '117.3693' } as const;
const SALE: PriceView = {
  mode: 'FIXED',
  amount: 145000,
  currency: 'EUR',
  period: null,
  negotiable: true,
};

describe('display price (SPEC §12)', () => {
  it('converts to the display currency and keeps the stored price as the original', () => {
    expect(toDisplayPrice(SALE, 'RSD', RATE)).toEqual({
      mode: 'FIXED',
      amount: 17018548.5,
      currency: 'RSD',
      period: null,
      negotiable: true,
      original: { amount: 145000, currency: 'EUR' },
    });
  });

  it('converts in the other direction of the rate, keeping the rental period', () => {
    const rent: PriceView = { ...SALE, amount: 60000, currency: 'RSD', period: 'MONTH' };
    expect(toDisplayPrice(rent, 'EUR', RATE)).toMatchObject({
      amount: 511.21,
      currency: 'EUR',
      period: 'MONTH',
      original: { amount: 60000, currency: 'RSD' },
    });
  });

  it('shows the stored price when it is already in the display currency or no rate is known', () => {
    expect(toDisplayPrice(SALE, 'EUR', RATE)).toEqual({ ...SALE, original: null });
    expect(toDisplayPrice(SALE, 'RSD', null)).toEqual({ ...SALE, original: null });
  });

  it('leaves "price on request" alone', () => {
    expect(toDisplayPrice({ mode: 'ON_REQUEST' }, 'RSD', RATE)).toEqual({ mode: 'ON_REQUEST' });
  });
});
