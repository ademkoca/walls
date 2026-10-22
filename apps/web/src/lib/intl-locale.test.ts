import { describe, expect, it } from 'vitest';
import { formatDate, intlLocale } from './intl-locale';

const october = new Date(Date.UTC(2026, 9, 12, 14, 30));

describe('intlLocale', () => {
  it('formats Serbian month names in Latin script', () => {
    const month = new Intl.DateTimeFormat(intlLocale('sr'), {
      month: 'long',
      timeZone: 'UTC',
    }).format(october);
    expect(month).toBe('oktobar');
  });
});

describe('formatDate', () => {
  it('puts Serbian month names in the genitive', () => {
    expect(formatDate('sr', october, { dateStyle: 'long', timeZone: 'UTC' })).toBe(
      '12. oktobra 2026.',
    );
    expect(formatDate('sr', october, { month: 'long', year: 'numeric', timeZone: 'UTC' })).toBe(
      'oktobra 2026.',
    );
    expect(
      formatDate('sr', october, { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' }),
    ).toBe('12. oktobra 2026. 14:30');
  });

  it('has a genitive for every Serbian month', () => {
    for (let month = 0; month < 12; month++) {
      const date = new Date(Date.UTC(2026, month, 1));
      const nominative = new Intl.DateTimeFormat(intlLocale('sr'), {
        month: 'long',
        timeZone: 'UTC',
      }).format(date);
      const genitive = formatDate('sr', date, { month: 'long', timeZone: 'UTC' });
      expect(genitive, nominative).not.toBe(nominative);
      expect(genitive, nominative).toMatch(/a$/);
    }
  });

  it('leaves abbreviated Serbian months and English dates as Intl formats them', () => {
    expect(formatDate('sr', october, { day: 'numeric', month: 'short', timeZone: 'UTC' })).toBe(
      '12. okt',
    );
    expect(formatDate('en', october, { dateStyle: 'long', timeZone: 'UTC' })).toBe(
      'October 12, 2026',
    );
  });
});
