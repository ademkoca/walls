'use client';

import { cn } from '@walls/ui/lib/utils';
import { ExternalLinkIcon, LayoutDashboardIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

/** Dashboard sections. Later phases add listings, inquiries, reviews and administration. */
const DASHBOARD_NAV = [
  { href: '/dashboard', labelKey: 'overview', icon: LayoutDashboardIcon },
] as const;

export function DashboardNav() {
  const t = useTranslations('dashboard.nav');
  const pathname = usePathname();
  const itemClass =
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-sidebar-ring/60 focus-visible:outline-none [&_svg]:size-4';

  return (
    <nav aria-label={t('label')} className="flex flex-row gap-1 lg:flex-col">
      {DASHBOARD_NAV.map(({ href, labelKey, icon: Icon }) => {
        const active = pathname === href;
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
