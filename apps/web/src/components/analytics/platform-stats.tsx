import type { PlatformAnalytics } from '@walls/shared';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Stat } from './stat';

/** Platform totals for Admins (SPEC §23). */
export async function PlatformStats({ analytics }: { analytics: PlatformAnalytics }) {
  const t = await getTranslations('analytics');
  const format = await getFormatter();
  const stats: [string, number][] = [
    [t('listings'), analytics.listings.total],
    [t('published'), analytics.listings.published],
    [t('pendingReview'), analytics.listings.pendingReview],
    [t('sold'), analytics.listings.sold],
    [t('rented'), analytics.listings.rented],
    [t('inquiriesTotal'), analytics.inquiries.total],
    [t('inquiriesNew'), analytics.inquiries.new],
    [t('viewsTotal'), analytics.views.total],
    [t('views30'), analytics.views.last30Days],
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map(([label, value]) => (
        <Stat key={label} label={label} value={format.number(value)} />
      ))}
    </dl>
  );
}
