import { describe, expect, it } from 'vitest';
import { analyticsDay, fillDays, lastDays } from './days';

describe('analytics days (SPEC §23)', () => {
  it('uses the calendar day in Serbia', () => {
    // 23:30 UTC on 12 October is already 13 October in Belgrade (UTC+2 in summer time).
    expect(analyticsDay(new Date('2026-10-12T23:30:00Z'))).toBe('2026-10-13');
    expect(analyticsDay(new Date('2026-01-15T22:59:00Z'))).toBe('2026-01-15');
  });

  it('lists the last days oldest first, across months and the clock change', () => {
    expect(lastDays(3, new Date('2026-03-01T10:00:00Z'))).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
    ]);
    expect(lastDays(2, new Date('2026-10-25T12:00:00Z'))).toEqual(['2026-10-24', '2026-10-25']);
  });

  it('fills days without counts with zero', () => {
    expect(
      fillDays(['2026-10-11', '2026-10-12', '2026-10-13'], [{ day: '2026-10-12', value: 4 }]),
    ).toEqual([
      { day: '2026-10-11', value: 0 },
      { day: '2026-10-12', value: 4 },
      { day: '2026-10-13', value: 0 },
    ]);
  });
});
