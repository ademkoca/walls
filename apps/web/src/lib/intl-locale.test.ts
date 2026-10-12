import { describe, expect, it } from 'vitest';
import { intlLocale } from './intl-locale';

describe('intlLocale', () => {
  it('formats Serbian month names in Latin script', () => {
    const october = new Date(Date.UTC(2026, 9, 12));
    const month = new Intl.DateTimeFormat(intlLocale('sr'), {
      month: 'long',
      timeZone: 'UTC',
    }).format(october);
    expect(month).toBe('oktobar');
  });
});
