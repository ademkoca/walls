import { Alert, AlertDescription, AlertTitle } from '@walls/ui/components/alert';
import { buttonVariants } from '@walls/ui/components/button';
import { ArrowLeftIcon, CircleAlertIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProfileChangeActions } from '@/components/admin/profile-change-actions';
import { ProfileComparison } from '@/components/admin/profile-comparison';
import { ReviewStatusBadge } from '@/components/admin/review-status-badge';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { Link } from '@/i18n/navigation';
import { dashboardData } from '@/lib/api/dashboard-data';
import { getProfileChange } from '@/lib/api/server';
import { QuotedText } from '@/components/dashboard/quoted-text';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/profile-changes/[id]'>): Promise<Metadata> {
  const t = await getTranslations({
    locale: await metadataLocale(params),
    namespace: 'profileChanges',
  });
  return { title: t('title') };
}

/** One agent's proposed profile next to the live one, with approve / reject (SPEC §4). */
export default async function ProfileChangePage({
  params,
}: PageProps<'/[locale]/dashboard/profile-changes/[id]'>) {
  await resolveLocale(params);
  const { id } = await params;
  const t = await getTranslations('profileChanges');
  const request = await dashboardData(getProfileChange(id), `/dashboard/profile-changes/${id}`);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href={{ pathname: '/dashboard/profile-changes', query: { status: request.status } }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        {t('backToList')}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {request.user.displayName}
            </h1>
            <ReviewStatusBadge status={request.status} />
          </div>
          {request.reviewedBy && (
            <p className="text-sm text-muted-foreground">
              {t('reviewedBy', { name: request.reviewedBy.displayName })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/users/${request.user.id}`}
            className={buttonVariants({ variant: 'ghost' })}
          >
            {t('viewUser')}
          </Link>
          {request.canReview && <ProfileChangeActions id={request.id} />}
        </div>
      </div>

      {request.rejectionReason && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>{t('rejectionReason')}</AlertTitle>
          <AlertDescription>
            <QuotedText text={request.rejectionReason} />
          </AlertDescription>
        </Alert>
      )}

      <ProfileComparison
        live={request.live}
        proposed={request.proposed}
        liveEmail={request.user.email}
        newEmail={request.newEmail}
        changes={request.changes}
      />
    </div>
  );
}
