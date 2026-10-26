import { ListingStatus, keepsSentInquiries, publicListingPath } from '@walls/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Pager, pageParam } from '@/components/admin/pager';
import { InquiryStatusTabs, SENT_TAB } from '@/components/inquiries/inquiry-status-tabs';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { Link } from '@/i18n/navigation';
import { getCurrentUser, getSentInquiries } from '@/lib/api/server';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/inquiries/sent'>): Promise<Metadata> {
  const t = await getTranslations({ locale: await metadataLocale(params), namespace: 'inquiries' });
  return { title: t('sentTitle') };
}

/**
 * Inquiries the signed-in private seller or agent sent (decision, Phase 9). The recipient's
 * status is not shown; replies arrive by email.
 */
export default async function SentInquiriesPage({
  params,
  searchParams,
}: PageProps<'/[locale]/dashboard/inquiries/sent'>) {
  await resolveLocale(params);
  const page = pageParam((await searchParams).page);
  const user = await getCurrentUser();
  if (!user) return null;
  if (!keepsSentInquiries(user.role)) notFound();
  const [t, format, result] = await Promise.all([
    getTranslations('inquiries'),
    getFormatter(),
    getSentInquiries(page),
  ]);
  if (!result) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-4xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('sentDescription')}</p>
      </div>
      <InquiryStatusTabs active={SENT_TAB} label={t('title')} showSent />

      {result.items.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          {t('sentEmpty')}
        </p>
      ) : (
        <ul className="space-y-4">
          {result.items.map((inquiry) => {
            const title = inquiry.listing.title ?? t('untitled');
            const isPublic =
              inquiry.listing.slug !== null && inquiry.listing.status === ListingStatus.PUBLISHED;
            return (
              <li key={inquiry.id} className="space-y-3 rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    {isPublic ? (
                      <Link
                        href={publicListingPath(inquiry.listing.slug!)}
                        className="font-medium hover:underline"
                      >
                        {title}
                      </Link>
                    ) : (
                      <span className="font-medium">{title}</span>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {t('sentTo', { name: inquiry.recipientName })}
                    </p>
                  </div>
                  <time
                    dateTime={inquiry.createdAt}
                    className="text-sm whitespace-nowrap text-muted-foreground"
                  >
                    {format.dateTime(new Date(inquiry.createdAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </time>
                </div>
                <p className="whitespace-pre-line">{inquiry.message}</p>
              </li>
            );
          })}
        </ul>
      )}

      <Pager pathname="/dashboard/inquiries/sent" query={{}} page={page} hasMore={result.hasMore} />
    </div>
  );
}
