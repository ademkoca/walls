import type { ListingAnalytics } from '@walls/shared';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@walls/ui/components/card';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Stat } from './stat';
import { ViewsChart } from './views-chart';

/** A listing's views and inquiries, for its editors and Admins (SPEC §23). */
export async function ListingAnalyticsCard({ analytics }: { analytics: ListingAnalytics }) {
  const t = await getTranslations('analytics');
  const format = await getFormatter();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('listingTitle')}</CardTitle>
        <CardDescription>{t('hint')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)]">
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-1">
          <Stat label={t('totalViews')} value={format.number(analytics.totalViews)} />
          <Stat label={t('inquiries')} value={format.number(analytics.inquiryCount)} />
        </dl>
        <ViewsChart days={analytics.viewsByDay} />
      </CardContent>
    </Card>
  );
}
