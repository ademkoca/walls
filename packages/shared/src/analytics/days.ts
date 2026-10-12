/**
 * Analytics count days in Serbian time (SPEC §23), so "today" matches what the people
 * reading the numbers see on their calendars.
 */
export const ANALYTICS_TIME_ZONE = 'Europe/Belgrade';

/** Days shown in a listing's "views over time" chart. */
export const VIEWS_CHART_DAYS = 30;

const DAY_MS = 86_400_000;

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: ANALYTICS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar day of `date` in Serbia, as YYYY-MM-DD. */
export function analyticsDay(date: Date): string {
  return dayFormat.format(date);
}

/** The `count` days up to and including the day of `until`, oldest first (YYYY-MM-DD). */
export function lastDays(count: number, until: Date): string[] {
  const [year, month, day] = analyticsDay(until).split('-').map(Number) as [number, number, number];
  const end = Date.UTC(year, month - 1, day);
  return Array.from({ length: count }, (_, index) =>
    new Date(end - (count - 1 - index) * DAY_MS).toISOString().slice(0, 10),
  );
}

/** A daily series with a value for every day in `days`, 0 where nothing was counted. */
export function fillDays(
  days: readonly string[],
  counts: readonly { day: string; value: number }[],
): { day: string; value: number }[] {
  const byDay = new Map(counts.map((entry) => [entry.day, entry.value]));
  return days.map((day) => ({ day, value: byDay.get(day) ?? 0 }));
}
