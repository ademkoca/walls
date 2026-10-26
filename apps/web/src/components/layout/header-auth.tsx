'use client';

import { buttonVariants } from '@walls/ui/components/button';
import { Skeleton } from '@walls/ui/components/skeleton';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useSession } from '../session/session-provider';
import { UserMenu } from './user-menu';

/** Login/register buttons, or the account menu once signed in. */
export function HeaderAuth() {
  const t = useTranslations('nav');
  const { session, refresh } = useSession();

  if (session.status === 'loading') return <Skeleton className="size-8" />;
  if (session.status === 'authenticated') {
    return <UserMenu user={session.user} onLoggedOut={() => void refresh()} />;
  }
  return (
    <div className="flex items-center gap-2">
      <Link href="/login" className={buttonVariants({ variant: 'ghost' })}>
        {t('login')}
      </Link>
      <Link href="/register" className={buttonVariants({ variant: 'outline' })}>
        {t('register')}
      </Link>
    </div>
  );
}
