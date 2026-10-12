'use client';

import { type Role, isReviewer, sellerTypeForRole } from '@walls/shared';
import { cn } from '@walls/ui/lib/utils';
import {
  Building2Icon,
  ExternalLinkIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  UsersIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * Dashboard sections. `show` mirrors the API's permissions so users only see sections they
 * can use; the API still authorizes every request. Later phases add inquiries, reviews and
 * administration.
 */
const DASHBOARD_NAV = [
  { href: '/dashboard', labelKey: 'overview', icon: LayoutDashboardIcon, show: () => true },
  {
    href: '/dashboard/listings',
    labelKey: 'listings',
    icon: Building2Icon,
    // Private sellers and agents advertise listings (canCreateListing).
    show: (role: Role) => sellerTypeForRole(role) !== null,
  },
  {
    href: '/dashboard/listings',
    labelKey: 'reviewListings',
    icon: Building2Icon,
    show: (role: Role) => isReviewer({ role }),
  },
  {
    href: '/dashboard/users',
    labelKey: 'users',
    icon: UsersIcon,
    show: (role: Role) => isReviewer({ role }),
  },
  {
    href: '/dashboard/audit-log',
    labelKey: 'auditLog',
    icon: HistoryIcon,
    show: (role: Role) => isReviewer({ role }),
  },
] as const;

export function DashboardNav({ role }: { role: Role }) {
  const t = useTranslations('dashboard.nav');
  const pathname = usePathname();
  const itemClass =
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-sidebar-ring/60 focus-visible:outline-none [&_svg]:size-4';

  return (
    <nav aria-label={t('label')} className="flex flex-row gap-1 lg:flex-col">
      {DASHBOARD_NAV.filter((item) => item.show(role)).map(({ href, labelKey, icon: Icon }) => {
        const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
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
            {t(labelKey)}
          </Link>
        );
      })}
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
