'use client';

import {
  type InquiryCounts,
  type ReviewQueueCounts,
  type Role,
  hasPublicProfile,
  isReviewer,
} from '@walls/shared';
import { cn } from '@walls/ui/lib/utils';
import {
  BriefcaseBusinessIcon,
  Building2Icon,
  ExternalLinkIcon,
  HistoryIcon,
  InboxIcon,
  LayoutDashboardIcon,
  UserPenIcon,
  UserRoundIcon,
  UsersIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

const reviewer = (role: Role) => isReviewer({ role });

/** Items needing attention, shown as badges: review queues (Admins) and new inquiries. */
export interface NavCounts {
  review: ReviewQueueCounts | null;
  inquiries: InquiryCounts | null;
}

/**
 * Dashboard sections. `show` mirrors the API's permissions so users only see sections they
 * can use; the API still authorizes every request. `waiting` picks the count of items that
 * need attention.
 */
const DASHBOARD_NAV: readonly {
  href: string;
  labelKey:
    | 'overview'
    | 'listings'
    | 'reviewListings'
    | 'agentApplications'
    | 'profileChanges'
    | 'users'
    | 'auditLog'
    | 'profile'
    | 'inquiries';
  icon: typeof UsersIcon;
  show: (role: Role) => boolean;
  waiting?: (counts: NavCounts) => number;
}[] = [
  { href: '/dashboard', labelKey: 'overview', icon: LayoutDashboardIcon, show: () => true },
  {
    href: '/dashboard/listings',
    labelKey: 'listings',
    icon: Building2Icon,
    // Private sellers and professionals advertise listings (canCreateListing).
    show: hasPublicProfile,
  },
  {
    href: '/dashboard/listings',
    labelKey: 'reviewListings',
    icon: Building2Icon,
    show: reviewer,
    waiting: ({ review }) => (review ? review.listings + review.listingRevisions : 0),
  },
  {
    href: '/dashboard/inquiries',
    labelKey: 'inquiries',
    icon: InboxIcon,
    // Advertisers and agents receive inquiries; Admins manage all of them (SPEC §20).
    show: () => true,
    waiting: ({ inquiries }) => inquiries?.new ?? 0,
  },
  {
    href: '/dashboard/agent-applications',
    labelKey: 'agentApplications',
    icon: BriefcaseBusinessIcon,
    show: reviewer,
    waiting: ({ review }) => review?.agentApplications ?? 0,
  },
  {
    href: '/dashboard/profile-changes',
    labelKey: 'profileChanges',
    icon: UserPenIcon,
    show: reviewer,
    waiting: ({ review }) => review?.profileChanges ?? 0,
  },
  { href: '/dashboard/users', labelKey: 'users', icon: UsersIcon, show: reviewer },
  { href: '/dashboard/audit-log', labelKey: 'auditLog', icon: HistoryIcon, show: reviewer },
  {
    href: '/dashboard/profile',
    labelKey: 'profile',
    icon: UserRoundIcon,
    show: hasPublicProfile,
  },
];

export function DashboardNav({ role, counts }: { role: Role; counts: NavCounts }) {
  const t = useTranslations('dashboard.nav');
  const pathname = usePathname();
  const itemClass =
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-sidebar-ring/60 focus-visible:outline-none [&_svg]:size-4';

  return (
    <nav aria-label={t('label')} className="flex flex-row gap-1 lg:flex-col">
      {DASHBOARD_NAV.filter((item) => item.show(role)).map(
        ({ href, labelKey, icon: Icon, waiting }) => {
          const active =
            href === '/dashboard'
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
          const count = waiting ? waiting(counts) : 0;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                itemClass,
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <Icon />
              <span className="flex-1">{t(labelKey)}</span>
              {count > 0 && (
                <span
                  className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground"
                  aria-label={t('waiting', { count })}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        },
      )}
      <Link
        href="/"
        className={cn(itemClass, 'text-sidebar-foreground/80 hover:bg-sidebar-accent lg:mt-4')}
      >
        <ExternalLinkIcon />
        {t('viewSite')}
      </Link>
    </nav>
  );
}
