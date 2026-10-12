import { sellerTypeForRole } from '@walls/shared';
import { buttonVariants } from '@walls/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@walls/ui/components/card';
import { getTranslations } from 'next-intl/server';
import { resolveLocale } from '@/i18n/locale-param';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/api/server';

export default async function DashboardPage({ params }: PageProps<'/[locale]/dashboard'>) {
  await resolveLocale(params);
  const t = await getTranslations();
  // The layout has already redirected anonymous visitors; this read is deduplicated.
  const user = await getCurrentUser();
  if (!user) return null;
  const advertises = sellerTypeForRole(user.role) !== null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t('dashboard.welcome', { name: user.displayName })}
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.signedInAs', { role: t(`roles.${user.role}`) })}</CardTitle>
          <CardDescription>{t('dashboard.comingSoon')}</CardDescription>
        </CardHeader>
        {advertises && (
          <CardContent>
            <Link href="/dashboard/listings" className={buttonVariants()}>
              {t('listings.title')}
            </Link>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
