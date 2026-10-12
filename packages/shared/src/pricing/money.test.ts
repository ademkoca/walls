import { describe, expect, it } from 'vitest';
import { Currency } from '../enums';
import { type ExchangeRate, convertMinorUnits, fromMinorUnits, toMinorUnits } from './money';

const eurToRsd: ExchangeRate = {
  base: Currency.EUR,
  quote: Currency.RSD,
  rate: '117.1734',
  fetchedAt: new Date('2026-10-12T06:00:00Z'),
};

describe('minor units', () => {
  it('converts major to minor units without floating-point drift', () => {
    expect(toMinorUnits(1200.55, Currency.EUR)).toBe(120_055);
    expect(toMinorUnits(0.1 + 0.2, Currency.EUR)).toBe(30);
    expect(fromMinorUnits(120_055, Currency.EUR)).toBe(1200.55);
  });

  it('rejects non-finite amounts', () => {
    expect(() => toMinorUnits(Number.NaN, Currency.EUR)).toThrow(RangeError);
    expect(() => toMinorUnits(Number.POSITIVE_INFINITY, Currency.EUR)).toThrow(RangeError);
  });
});

describe('currency conversion (SPEC §12)', () => {
  it('converts EUR to RSD exactly', () => {
    // 250,000.00 EUR × 117.1734 = 29,293,350.00 RSD
    expect(convertMinorUnits(25_000_000, Currency.EUR, Currency.RSD, eurToRsd)).toBe(2_929_335_000);
  });

  it('converts RSD to EUR using the inverse rate, rounding half up', () => {
    // 1,000.00 RSD ÷ 117.1734 = 8.5343... EUR → 8.53 EUR
    expect(convertMinorUnits(100_000, Currency.RSD, Currency.EUR, eurToRsd)).toBe(853);
    // 0.01 RSD ÷ 2 = 0.005 EUR, exactly half a cent → rounds up to 0.01 EUR
    expect(convertMinorUnits(1, Currency.RSD, Currency.EUR, { ...eurToRsd, rate: '2' })).toBe(1);
    // 0.01 RSD ÷ 200 = 0.00005 EUR → rounds down to 0
    expect(convertMinorUnits(1, Currency.RSD, Currency.EUR, { ...eurToRsd, rate: '200' })).toBe(0);
  });

  it('returns the original amount when the currency is unchanged', () => {
    expect(convertMinorUnits(12_345, Currency.EUR, Currency.EUR, eurToRsd)).toBe(12_345);
  });

  it('round-trips a typical rent within one minor unit', () => {
    const rsd = convertMinorUnits(120_000, Currency.EUR, Currency.RSD, eurToRsd);
    expect(convertMinorUnits(rsd, Currency.RSD, Currency.EUR, eurToRsd)).toBe(120_000);
  });

  it.each(['0', '-1', 'abc', '1e3', ''])('rejects the invalid rate %j', (rate) => {
    expect(() => convertMinorUnits(100, Currency.EUR, Currency.RSD, { ...eurToRsd, rate })).toThrow(
      RangeError,
    );
  });

  it('rejects a rate that does not cover the currency pair', () => {
    const eurToEur = { ...eurToRsd, quote: Currency.EUR };
    expect(() => convertMinorUnits(100, Currency.RSD, Currency.EUR, eurToEur)).toThrow(RangeError);
  });
});
