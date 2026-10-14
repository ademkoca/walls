import { publicListingPath } from '@walls/shared';
import { Alert, AlertDescription } from '@walls/ui/components/alert';
import { Badge } from '@walls/ui/components/badge';
import { buttonVariants } from '@walls/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@walls/ui/components/card';
import { ChevronLeftIcon, ExternalLinkIcon, InfoIcon, MailIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { InquiryStatusActions } from '@/components/inquiries/inquiry-status-actions';
import { InquiryStatusBadge } from '@/components/inquiries/inquiry-status-badge';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { Link } from '@/i18n/navigation';
import { NotAccessibleError, getInquiry } from '@/lib/api/server';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/inquiries/[id]'>): Promise<Metadata> {
  const t = await getTranslations({ locale: await metadataLocale(params), namespace: 'inquiries' });
  return { title: t('title') };
}

async function loadInquiry(id: string) {
  try {
    return await getInquiry(id);
  } catch (error) {
    if (error instanceof NotAccessibleError) notFound();
    throw error;
  }
}

/** One inquiry: the visitor's message and contact details, and its status (SPEC §20). */
export default async function InquiryPage({
  params,
}: PageProps<'/[locale]/dashboard/inquiries/[id]'>) {
  await resolveLocale(params);
  const { id } = await params;
  const [t, format, inquiry] = await Promise.all([
    getTranslations('inquiries'),
    getFormatter(),
    loadInquiry(id),
  ]);
  if (!inquiry) return null;
  const title = inquiry.listing.title ?? t('untitled');

  const details: [string, React.ReactNode][] = [
    // Contact links (mail, phone) are for the recipient, who replies; others only read.
    [
      t('email'),
      inquiry.canReply ? (
        <a
          key="email"
          href={`mailto:${inquiry.visitorEmail}`}
          className="break-all hover:underline"
        >
          {inquiry.visitorEmail}
        </a>
      ) : (
        <span key="email" className="break-all">
          {inquiry.visitorEmail}
        </span>
      ),
    ],
    [
      t('phone'),
      !inquiry.visitorPhone ? (
        <span className="text-muted-foreground">{t('noPhone')}</span>
      ) : inquiry.canReply ? (
        <a key="phone" href={`tel:${inquiry.visitorPhone.replace(/[^\d+]/g, '')}`}>
          {inquiry.visitorPhone}
        </a>
      ) : (
        <span key="phone">{inquiry.visitorPhone}</span>
      ),
    ],
    [
      t('received'),
      format.dateTime(new Date(inquiry.createdAt), { dateStyle: 'long', timeStyle: 'short' }),
    ],
    [t('recipient'), inquiry.recipient.displayName],
    ...(inquiry.assignedAgent
      ? ([[t('assignedAgent'), inquiry.assignedAgent.displayName]] as [string, string][])
      : []),
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/dashboard/inquiries"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" aria-hidden />
        {t('backToList')}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{inquiry.visitorName}</h1>
            {inquiry.fromRegisteredUser && (
              <Badge variant="secondary" title={t('registeredUserHint')}>
                {t('registeredUser')}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">{title}</p>
        </div>
        <InquiryStatusBadge status={inquiry.status} />
      </div>

      {!inquiry.canManage && (
        <Alert>
          <InfoIcon />
          <AlertDescription>{t('readOnlyHint')}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('message')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="whitespace-pre-line">{inquiry.message}</p>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label} className="space-y-0.5">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          {!inquiry.canReply && <p className="text-sm text-muted-foreground">{t('replyHint')}</p>}
          <div className="flex flex-wrap gap-2">
            {inquiry.canReply && (
              <a
                href={`mailto:${inquiry.visitorEmail}?subject=${encodeURIComponent(`Re: ${title}`)}`}
                className={buttonVariants({ variant: 'outline' })}
              >
                <MailIcon data-icon="inline-start" />
                {t('reply')}
              </a>
            )}
            <Link
              href={`/dashboard/listings/${inquiry.listing.id}`}
              className={buttonVariants({ variant: 'outline' })}
            >
              {t('openListing')}
            </Link>
            {inquiry.listing.slug && (
              <Link
                href={publicListingPath(inquiry.listing.slug)}
                className={buttonVariants({ variant: 'ghost' })}
              >
                <ExternalLinkIcon data-icon="inline-start" />
                {t('viewListing')}
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {inquiry.canManage && (
        <section className="space-y-3" aria-labelledby="inquiry-status">
          <h2 id="inquiry-status" className="text-lg font-semibold">
            {t('status')}
          </h2>
          <InquiryStatusActions id={inquiry.id} status={inquiry.status} />
        </section>
      )}
    </div>
  );
}
