import { type UserStatus } from '@walls/shared';
import { Badge } from '@walls/ui/components/badge';
import { useTranslations } from 'next-intl';

const VARIANT: Record<UserStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  ACTIVE: 'outline',
  PENDING_VERIFICATION: 'secondary',
  PENDING_SETUP: 'secondary',
  DEACTIVATED: 'destructive',
};

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const t = useTranslations('enums.userStatus');
  return <Badge variant={VARIANT[status]}>{t(status)}</Badge>;
}
