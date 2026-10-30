import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@walls/ui/components/table';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Pager, pageParam } from '@/components/admin/pager';
import { ReviewStatusTabs, reviewStatusParam } from '@/components/admin/review-status-tabs';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { Link } from '@/i18n/navigation';
import { dashboardData } from '@/lib/api/dashboard-data';
import { getProfileChanges } from '@/lib/api/server';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/profile-changes'>): Promise<Metadata> {
  const t = await getTranslations({
    locale: await metadataLocale(params),
    namespace: 'profileChanges',
  });
  return { title: t('title') };
}

/** Agents' profile change requests (Admins and Super Admins). */
export default async function ProfileChangesPage({
  params,
  searchParams,
}: PageProps<'/[locale]/dashboard/profile-changes'>) {
  await resolveLocale(params);
  const search = await searchParams;
  const t = await getTranslations('profileChanges');
  const format = await getFormatter();
  const status = reviewStatusParam(search.status);
  const page = pageParam(search.page);
  const result = await dashboardData(
    getProfileChanges({ status, page }),
    '/dashboard/profile-changes',
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-4xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>
      <ReviewStatusTabs
        pathname="/dashboard/profile-changes"
        active={status}
        label={t('title')}
        tabLabel={(tab) => t(`tabs.${tab}`)}
      />

      {result.items.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          {t('empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.agent')}</TableHead>
                <TableHead>{t('columns.changes')}</TableHead>
                <TableHead>{t('columns.updated')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/profile-changes/${request.id}`}
                      className="font-medium hover:underline"
                    >
                      {request.user.displayName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{request.user.email}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {request.changes.map((field) => t(`fields.${field}`)).join(', ') ||
                      t('emptyValue')}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {format.dateTime(new Date(request.updatedAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Pager
        pathname="/dashboard/profile-changes"
        query={{ status }}
        page={page}
        hasMore={result.hasMore}
      />
    </div>
  );
}
