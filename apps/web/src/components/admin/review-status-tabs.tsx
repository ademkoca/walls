import { ReviewStatus, enumValues } from '@walls/shared';
import { cn } from '@walls/ui/lib/utils';
import { Link } from '@/i18n/navigation';

/** Waiting / approved / rejected tabs of a review queue, kept in `?status=`. */
export function ReviewStatusTabs({
  pathname,
  active,
  label,
  tabLabel,
}: {
  pathname: '/dashboard/agent-applications' | '/dashboard/profile-changes';
  active: ReviewStatus;
  label: string;
  tabLabel: (status: ReviewStatus) => string;
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1 border-b">
      {enumValues(ReviewStatus).map((status) => (
        <Link
          key={status}
          href={{ pathname, query: { status } }}
          aria-current={status === active ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            status === active
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {tabLabel(status)}
        </Link>
      ))}
    </nav>
  );
}

/** Reads `?status=`, defaulting to the waiting items. */
export function reviewStatusParam(value: string | string[] | undefined): ReviewStatus {
  return enumValues(ReviewStatus).find((status) => status === value) ?? ReviewStatus.PENDING;
}
