'use client';

import type { Role } from '@walls/shared';
import { Button } from '@walls/ui/components/button';
import { Separator } from '@walls/ui/components/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@walls/ui/components/sheet';
import { LogOutIcon, MenuIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useLogout } from '../layout/use-logout';
import { DashboardNav, type NavCounts } from './dashboard-nav';

/** The dashboard sections and logout in a drawer, below the desktop sidebar's breakpoint. */
export function DashboardMobileNav({ role, counts }: { role: Role; counts: NavCounts }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const logout = useLogout(close);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" />}>
        <MenuIcon />
        <span className="sr-only">{t('nav.openMenu')}</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 max-w-[85vw] bg-sidebar text-sidebar-foreground">
        <SheetHeader>
          <SheetTitle>{t('dashboard.nav.label')}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-2 overflow-y-auto px-4 pb-6">
          <DashboardNav role={role} counts={counts} onNavigate={close} />
          <Separator className="my-2" />
          <Button variant="outline" onClick={() => void logout()}>
            <LogOutIcon />
            {t('nav.logout')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
