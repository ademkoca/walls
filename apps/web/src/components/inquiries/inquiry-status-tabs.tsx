import { InquiryStatus, enumValues } from '@walls/shared';
import { cn } from '@walls/ui/lib/utils';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export const SENT_TAB = 'SENT';

/**
 * New / contacted / closed tabs of the received inquiries (kept in `?status=`), plus the
 * "Sent" history for private sellers and agents.
 */
export function InquiryStatusTabs({
  active,
  label,
  showSent,
}: {
  active: InquiryStatus | typeof SENT_TAB;
  label: string;
  showSent: boolean;
}) {
  const t = useTranslations('enums.inquiryStatus');
  const tInquiries = useTranslations('inquiries');
  const tabs = [
    ...enumValues(InquiryStatus).map((status) => ({
      key: status,
      label: t(status),
      href: { pathname: '/dashboard/inquiries', query: { status } },
    })),
    ...(showSent
      ? [{ key: SENT_TAB, label: tInquiries('sentTab'), href: '/dashboard/inquiries/sent' }]
      : []),
  ];
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1 border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            tab.key === active
              ? 'border-emphasis text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/** Reads `?status=`, defaulting to new inquiries. */
export function inquiryStatusParam(value: string | string[] | undefined): InquiryStatus {
  return enumValues(InquiryStatus).find((status) => status === value) ?? InquiryStatus.NEW;
}
