'use client';

import { cn } from '@walls/ui/lib/utils';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

/**
 * Switches between Serbian and English on the same page, keeping the query string (so
 * emailed links with tokens survive a language switch). Render inside <Suspense>.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations('language');
  const locale = useLocale();
  const pathname = usePathname();
  const query = Object.fromEntries(useSearchParams().entries());

  return (
    <nav aria-label={t('label')} className={cn('flex items-center text-sm', className)}>
      {routing.locales.map((target, index) => (
        <span key={target} className="flex items-center">
          {index > 0 && (
            <span aria-hidden className="px-1.5 text-muted-foreground">
              /
            </span>
          )}
          <Link
            href={{ pathname, query }}
            locale={target}
            lang={target}
            aria-current={target === locale ? 'true' : undefined}
            title={t(target)}
            className={cn(
              'rounded px-1 py-0.5 font-medium uppercase underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              target === locale ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {target}
          </Link>
        </span>
      ))}
    </nav>
  );
}
