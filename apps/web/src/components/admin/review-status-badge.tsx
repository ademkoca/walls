import type { ReviewStatus } from '@walls/shared';
import { Badge } from '@walls/ui/components/badge';
import { useTranslations } from 'next-intl';

const VARIANT: Record<ReviewStatus, 'default' | 'secondary' | 'destructive'> = {
  PENDING: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const t = useTranslations('enums.reviewStatus');
  return <Badge variant={VARIANT[status]}>{t(status)}</Badge>;
}
