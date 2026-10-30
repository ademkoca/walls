import { buttonVariants } from '@walls/ui/components/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@walls/ui/components/card';
import { ArrowLeftIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { AuditTable } from '@/components/admin/audit-table';
import { ProofFileList } from '@/components/admin/proof-file-list';
import { UserAccountActions } from '@/components/admin/user-account-actions';
import { UserStatusBadge } from '@/components/admin/user-status-badge';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { Link } from '@/i18n/navigation';
import { dashboardData } from '@/lib/api/dashboard-data';
import { getAuditLog, getUser } from '@/lib/api/server';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/users/[id]'>): Promise<Metadata> {
  const t = await getTranslations({ locale: await metadataLocale(params), namespace: 'users' });
  return { title: t('title') };
}

export default async function UserPage({ params }: PageProps<'/[locale]/dashboard/users/[id]'>) {
  await resolveLocale(params);
  const { id } = await params;
  const t = await getTranslations('users');
  const tEnums = await getTranslations('enums');
  const format = await getFormatter();
  const page = `/dashboard/users/${id}`;
  const [user, history] = await Promise.all([
    dashboardData(getUser(id), page),
    dashboardData(getAuditLog({ entityType: 'USER', entityId: id }), page),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/dashboard/users"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        {t('backToList')}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{user.displayName}</h1>
          <UserStatusBadge status={user.status} />
        </div>
        <div className="flex gap-2">
          <UserAccountActions user={user} />
        </div>
      </div>

      <Card>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Detail label={t('columns.email')}>{user.email}</Detail>
            <Detail label={t('columns.role')}>{tEnums(`role.${user.role}`)}</Detail>
            {user.sellerType && (
              <Detail label={t('columns.type')}>{tEnums(`sellerType.${user.sellerType}`)}</Detail>
            )}
            <Detail label={t('details.emailVerified')}>
              {user.emailVerified ? t('details.yes') : t('details.no')}
            </Detail>
            <Detail label={t('details.listings')}>{user.listingCount}</Detail>
            <Detail label={t('details.joined')}>
              {format.dateTime(new Date(user.createdAt), { dateStyle: 'medium' })}
            </Detail>
            {user.deactivatedAt && (
              <Detail label={t('details.deactivatedAt')}>
                {format.dateTime(new Date(user.deactivatedAt), { dateStyle: 'medium' })}
              </Detail>
            )}
          </dl>
        </CardContent>
      </Card>

      {user.agentApplication && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('agentApplication.title')}</CardTitle>
            <CardDescription>
              {user.agentApplication.reviewedAt
                ? t('agentApplication.approvedOn', {
                    date: format.dateTime(new Date(user.agentApplication.reviewedAt), {
                      dateStyle: 'medium',
                    }),
                  })
                : null}{' '}
              {t('agentApplication.private')}
            </CardDescription>
            <CardAction>
              <Link
                href={`/dashboard/agent-applications/${user.agentApplication.id}`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                {t('agentApplication.view')}
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ProofFileList
              applicationId={user.agentApplication.id}
              files={user.agentApplication.files}
            />
          </CardContent>
        </Card>
      )}

      {history.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('history')}</CardTitle>
          </CardHeader>
          <CardContent>
            <AuditTable entries={history.items} showEntity={false} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
