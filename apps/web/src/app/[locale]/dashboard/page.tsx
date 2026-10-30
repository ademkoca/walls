import { advertisesListings, isReviewer } from '@walls/shared';
import { buttonVariants } from '@walls/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@walls/ui/components/card';
import { getTranslations } from 'next-intl/server';
import { PlatformStats } from '@/components/analytics/platform-stats';
import { resolveLocale } from '@/i18n/locale-param';
import { Link } from '@/i18n/navigation';
import { dashboardData } from '@/lib/api/dashboard-data';
import { getCurrentUser, getInquiryCounts, getPlatformAnalytics } from '@/lib/api/server';

export default async function DashboardPage({ params }: PageProps<'/[locale]/dashboard'>) {
  await resolveLocale(params);
  const t = await getTranslations();
  const user = await dashboardData(getCurrentUser(), '/dashboard');
  const advertises = advertisesListings(user);
  const [inquiries, platform] = await Promise.all([
    getInquiryCounts(),
    isReviewer(user) ? getPlatformAnalytics() : null,
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-4xl font-bold">{t('dashboard.welcome', { name: user.displayName })}</h1>
        <p className="text-muted-foreground">
          {t('dashboard.signedInAs', {
            role: user.sellerType ? t(`accountKinds.${user.sellerType}`) : t(`roles.${user.role}`),
          })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('inquiries.title')}</CardTitle>
            <CardDescription>
              {t('dashboard.newInquiries', { count: inquiries?.new ?? 0 })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/inquiries" className={buttonVariants({ variant: 'outline' })}>
              {t('dashboard.openInquiries')}
            </Link>
          </CardContent>
        </Card>
        {advertises && (
          <Card>
            <CardHeader>
              <CardTitle>{t('listings.title')}</CardTitle>
              <CardDescription>{t('listings.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/listings" className={buttonVariants()}>
                {t('listings.title')}
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {platform && (
        <section className="space-y-3" aria-labelledby="platform-stats">
          <h2 id="platform-stats" className="text-lg font-semibold">
            {t('dashboard.platformTitle')}
          </h2>
          <PlatformStats analytics={platform} />
        </section>
      )}
    </div>
  );
}
