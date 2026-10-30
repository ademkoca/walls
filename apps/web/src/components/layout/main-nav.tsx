'use client';

import { cn } from '@walls/ui/lib/utils';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { MAIN_NAV } from './nav-items';

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop navigation links with the current section highlighted. */
export function MainNav() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  return (
    <nav aria-label={t('mainLabel')} className="hidden items-center gap-1 lg:flex">
      {MAIN_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'px-3 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              active
                ? 'text-foreground shadow-[inset_0_-3px_0_var(--primary)]'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
