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
import { SellerTypeBadge } from '@/components/profiles/seller-type-badge';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { Link } from '@/i18n/navigation';
import { dashboardData } from '@/lib/api/dashboard-data';
import { getAgentApplications } from '@/lib/api/server';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/agent-applications'>): Promise<Metadata> {
  const t = await getTranslations({
    locale: await metadataLocale(params),
    namespace: 'agentApplications',
  });
  return { title: t('title') };
}

/** Agent applications waiting for review, and past decisions (Admins and Super Admins). */
export default async function AgentApplicationsPage({
  params,
  searchParams,
}: PageProps<'/[locale]/dashboard/agent-applications'>) {
  await resolveLocale(params);
  const search = await searchParams;
  const t = await getTranslations('agentApplications');
  const format = await getFormatter();
  const status = reviewStatusParam(search.status);
  const page = pageParam(search.page);
  const result = await dashboardData(
    getAgentApplications({ status, page }),
    '/dashboard/agent-applications',
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-4xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>
      <ReviewStatusTabs
        pathname="/dashboard/agent-applications"
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
                <TableHead>{t('columns.name')}</TableHead>
                <TableHead>{t('columns.type')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('columns.email')}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('columns.agency')}</TableHead>
                <TableHead>{t('columns.files')}</TableHead>
                <TableHead>{t('columns.submitted')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((application) => (
                <TableRow key={application.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/agent-applications/${application.id}`}
                      className="font-medium hover:underline"
                    >
                      {application.fullName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <SellerTypeBadge sellerType={application.sellerType} />
                  </TableCell>
                  <TableCell className="hidden max-w-64 truncate text-muted-foreground md:table-cell">
                    {application.email}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {application.agencyName ?? '—'}
                  </TableCell>
                  <TableCell>{application.fileCount}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {format.dateTime(new Date(application.createdAt), { dateStyle: 'medium' })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Pager
        pathname="/dashboard/agent-applications"
        query={{ status }}
        page={page}
        hasMore={result.hasMore}
      />
    </div>
  );
}
