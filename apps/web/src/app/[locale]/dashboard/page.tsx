import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@walls/ui/components/card';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/api/server';

export default async function DashboardPage() {
  const t = await getTranslations();
  // The layout has already redirected anonymous visitors; this read is deduplicated.
  const user = await getCurrentUser();
  if (!user) return null;

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
        <CardContent />
      </Card>
    </div>
  );
}
