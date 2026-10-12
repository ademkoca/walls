import type { InquiryStatus } from '@walls/shared';
import { Badge } from '@walls/ui/components/badge';
import { useTranslations } from 'next-intl';

const VARIANT: Record<InquiryStatus, 'default' | 'secondary' | 'outline'> = {
  NEW: 'default',
  CONTACTED: 'secondary',
  CLOSED: 'outline',
};

export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  const t = useTranslations('enums.inquiryStatus');
  return <Badge variant={VARIANT[status]}>{t(status)}</Badge>;
}
