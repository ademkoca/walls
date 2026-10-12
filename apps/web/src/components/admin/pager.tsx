import { buttonVariants } from '@walls/ui/components/button';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/** Previous/next links for paged admin lists; keeps the other query parameters. */
export async function Pager({
  pathname,
  query,
  page,
  hasMore,
}: {
  pathname: '/dashboard/users' | '/dashboard/audit-log';
  query: Record<string, string>;
  page: number;
  hasMore: boolean;
}) {
  const t = await getTranslations('users');
  if (page <= 1 && !hasMore) return null;
  const href = (target: number) => ({ pathname, query: { ...query, page: String(target) } });
  return (
    <nav className="flex justify-between gap-2" aria-label={t('title')}>
      {page > 1 ? (
        <Link href={href(page - 1)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <ChevronLeftIcon data-icon="inline-start" />
          {t('previous')}
        </Link>
      ) : (
        <span />
      )}
      {hasMore && (
        <Link href={href(page + 1)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          {t('next')}
          <ChevronRightIcon data-icon="inline-end" />
        </Link>
      )}
    </nav>
  );
}

/** Reads a single string search parameter. */
export function param(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** Reads a positive page number, defaulting to 1. */
export function pageParam(value: string | string[] | undefined): number {
  const page = Number(param(value));
  return Number.isInteger(page) && page > 0 ? page : 1;
}
