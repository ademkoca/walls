import { isReviewer, keepsSentInquiries } from '@walls/shared';
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
import { InquiryStatusTabs, inquiryStatusParam } from '@/components/inquiries/inquiry-status-tabs';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { Link } from '@/i18n/navigation';
import { dashboardData } from '@/lib/api/dashboard-data';
import { getCurrentUser, getInquiries } from '@/lib/api/server';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/inquiries'>): Promise<Metadata> {
  const t = await getTranslations({ locale: await metadataLocale(params), namespace: 'inquiries' });
  return { title: t('title') };
}

/** Inquiries the user received or can read; every inquiry for Admins (SPEC §20). */
export default async function InquiriesPage({
  params,
  searchParams,
}: PageProps<'/[locale]/dashboard/inquiries'>) {
  await resolveLocale(params);
  const search = await searchParams;
  const status = inquiryStatusParam(search.status);
  const page = pageParam(search.page);
  const [t, format, user, result] = await Promise.all([
    getTranslations('inquiries'),
    getFormatter(),
    dashboardData(getCurrentUser(), '/dashboard/inquiries'),
    dashboardData(getInquiries({ status, page }), '/dashboard/inquiries'),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-4xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">
          {isReviewer(user) ? t('descriptionAdmin') : t('description')}
        </p>
      </div>
      <InquiryStatusTabs
        active={status}
        label={t('title')}
        showSent={keepsSentInquiries(user.role)}
      />

      {result.items.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          {t(`empty.${status}`)}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.visitor')}</TableHead>
                <TableHead>{t('columns.listing')}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('columns.message')}</TableHead>
                <TableHead>{t('columns.received')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((inquiry) => (
                <TableRow key={inquiry.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/inquiries/${inquiry.id}`}
                      className="font-medium hover:underline"
                    >
                      {inquiry.visitorName}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-56 truncate">
                    {inquiry.listing.title ?? t('untitled')}
                  </TableCell>
                  <TableCell className="hidden max-w-md truncate text-muted-foreground lg:table-cell">
                    {inquiry.preview}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {format.dateTime(new Date(inquiry.createdAt), {
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
        pathname="/dashboard/inquiries"
        query={{ status }}
        page={page}
        hasMore={result.hasMore}
      />
    </div>
  );
}
