import { type ListingStatus } from '@walls/shared';
import { Badge } from '@walls/ui/components/badge';
import { useTranslations } from 'next-intl';

const VARIANT: Record<ListingStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  DRAFT: 'outline',
  PENDING_REVIEW: 'secondary',
  PUBLISHED: 'default',
  REJECTED: 'destructive',
  SOLD: 'secondary',
  RENTED: 'secondary',
  ARCHIVED: 'outline',
};

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  const t = useTranslations('enums.listingStatus');
  return <Badge variant={VARIANT[status]}>{t(status)}</Badge>;
}
