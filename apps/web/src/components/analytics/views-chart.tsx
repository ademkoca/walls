import type { DailyCount } from '@walls/shared';
import { getLocale, getTranslations } from 'next-intl/server';
import { intlLocale } from '@/lib/intl-locale';

/**
 * Views per day as a simple bar chart (SPEC §23). Screen readers get the total; each bar
 * names its day and count on hover.
 */
export async function ViewsChart({ days }: { days: DailyCount[] }) {
  const t = await getTranslations('analytics');
  const dayFormat = new Intl.DateTimeFormat(intlLocale(await getLocale()), {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const total = days.reduce((sum, day) => sum + day.value, 0);
  const highest = Math.max(1, ...days.map((day) => day.value));
  const label = (day: DailyCount) =>
    t('dayViews', { date: dayFormat.format(new Date(day.day)), count: day.value });

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-medium">
        {t('chartTitle', { days: days.length })}
      </figcaption>
      <div
        role="img"
        aria-label={t('chartLabel', { total, days: days.length })}
        className="flex h-28 items-end gap-0.5 border-b"
      >
        {days.map((day) => (
          <div
            key={day.day}
            title={label(day)}
            className="flex-1 bg-chart-1 hover:bg-chart-1/80"
            style={{ height: `${(day.value / highest) * 100}%`, minHeight: day.value ? 2 : 0 }}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground" aria-hidden>
        <span>{days[0] && dayFormat.format(new Date(days[0].day))}</span>
        <span>{days.at(-1) && dayFormat.format(new Date(days.at(-1)!.day))}</span>
      </div>
    </figure>
  );
}
