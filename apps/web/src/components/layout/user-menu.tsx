'use client';

import type { CurrentUser } from '@walls/shared';
import { Avatar, AvatarFallback } from '@walls/ui/components/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@walls/ui/components/dropdown-menu';
import { LayoutDashboardIcon, LogOutIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Link, useRouter } from '@/i18n/navigation';
import { authApi } from '@/lib/api/auth';
import { useErrorMessage } from '@/lib/use-error-message';

const MAX_INITIALS = 2;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_INITIALS)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

/** Account menu for a signed-in user: dashboard link and logout. */
export function UserMenu({ user, onLoggedOut }: { user: CurrentUser; onLoggedOut?: () => void }) {
  const t = useTranslations('nav');
  const router = useRouter();
  const errorMessage = useErrorMessage();

  async function logout() {
    try {
      await authApi.logout();
      onLoggedOut?.();
      router.push('/');
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('accountMenu')}
        className="rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Avatar>
          <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
            {initials(user.displayName)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {/* Base UI requires a group label to live inside a group. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate font-semibold text-foreground">{user.displayName}</span>
            <span className="block truncate font-normal text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/dashboard" />}>
          <LayoutDashboardIcon />
          {t('dashboard')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void logout()}>
          <LogOutIcon />
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
