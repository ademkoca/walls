import { hasAgencyName } from '@walls/shared';
import { Alert, AlertDescription, AlertTitle } from '@walls/ui/components/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@walls/ui/components/card';
import { ArrowLeftIcon, CircleAlertIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { AgentApplicationActions } from '@/components/admin/agent-application-actions';
import { ProofFileList } from '@/components/admin/proof-file-list';
import { ReviewStatusBadge } from '@/components/admin/review-status-badge';
import { SellerTypeBadge } from '@/components/profiles/seller-type-badge';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { Link } from '@/i18n/navigation';
import { NotAccessibleError, getAgentApplication } from '@/lib/api/server';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/agent-applications/[id]'>): Promise<Metadata> {
  const t = await getTranslations({
    locale: await metadataLocale(params),
    namespace: 'agentApplications',
  });
  return { title: t('title') };
}

async function loadApplication(id: string) {
  try {
    return await getAgentApplication(id);
  } catch (error) {
    if (error instanceof NotAccessibleError) notFound();
    throw error;
  }
}

/** One application: details, private proof files, and the review decision (SPEC §2.1). */
export default async function AgentApplicationPage({
  params,
}: PageProps<'/[locale]/dashboard/agent-applications/[id]'>) {
  await resolveLocale(params);
  const { id } = await params;
  const t = await getTranslations('agentApplications');
  const tEnums = await getTranslations('enums');
  const format = await getFormatter();
  const application = await loadApplication(id);
  if (!application) return null;
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href={{ pathname: '/dashboard/agent-applications', query: { status: application.status } }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        {t('backToList')}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{application.fullName}</h1>
          <SellerTypeBadge sellerType={application.sellerType} />
          <ReviewStatusBadge status={application.status} />
        </div>
        {application.canReview && (
          <AgentApplicationActions id={application.id} canApprove={!application.emailInUse} />
        )}
      </div>

      {application.canReview && application.emailInUse && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{t('emailInUse')}</AlertDescription>
        </Alert>
      )}
      {application.rejectionReason && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>{t('rejectionReason')}</AlertTitle>
          <AlertDescription className="whitespace-pre-line">
            {application.rejectionReason}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Detail label={t('details.email')}>{application.email}</Detail>
            <Detail label={t('details.phone')}>{application.phone}</Detail>
            {hasAgencyName(application.sellerType) && (
              <Detail label={t('details.agency')}>
                {application.agencyName ?? t('details.none')}
              </Detail>
            )}
            <Detail label={t('details.language')}>{tEnums(`locale.${application.locale}`)}</Detail>
            <Detail label={t('details.submitted')}>{date(application.createdAt)}</Detail>
            {application.reviewedAt && (
              <Detail label={t('details.reviewedAt')}>{date(application.reviewedAt)}</Detail>
            )}
            {application.reviewedBy && (
              <Detail label={t('details.reviewedBy')}>{application.reviewedBy.displayName}</Detail>
            )}
            {application.resultingUser && (
              <Detail label={t('details.account')}>
                <Link
                  href={`/dashboard/users/${application.resultingUser.id}`}
                  className="hover:underline"
                >
                  {application.resultingUser.displayName}
                </Link>
              </Detail>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('files')}</CardTitle>
          <CardDescription>{t('filesPrivate')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProofFileList applicationId={application.id} files={application.files} />
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{children}</dd>
    </div>
  );
}
