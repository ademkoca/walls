'use client';

import { Button, buttonVariants } from '@walls/ui/components/button';
import { Separator } from '@walls/ui/components/separator';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@walls/ui/components/sheet';
import { MenuIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { Link } from '@/i18n/navigation';
import { useSession } from '../session/session-provider';
import { LanguageSwitcher } from './language-switcher';
import { MAIN_NAV } from './nav-items';

/** Navigation drawer for small screens. */
export function MobileNav() {
  const t = useTranslations('nav');
  const { session } = useSession();
  const linkClass = 'block rounded-md px-3 py-2.5 text-base font-medium hover:bg-muted';

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
        <MenuIcon />
        <span className="sr-only">{t('openMenu')}</span>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 max-w-[85vw]">
        <SheetHeader>
          <SheetTitle>{t('mainLabel')}</SheetTitle>
        </SheetHeader>
        <nav aria-label={t('mainLabel')} className="flex flex-col gap-1 px-4">
          {[...MAIN_NAV, { href: '/for-agents', labelKey: 'forAgents' } as const].map((item) => (
            <SheetClose key={item.href} render={<Link href={item.href} className={linkClass} />}>
              {t(item.labelKey)}
            </SheetClose>
          ))}
        </nav>
        <Separator className="my-2" />
        <div className="flex flex-col gap-2 px-4">
          {session.status === 'authenticated' ? (
            <SheetClose render={<Link href="/dashboard" className={buttonVariants()} />}>
              {t('dashboard')}
            </SheetClose>
          ) : (
            <>
              <SheetClose render={<Link href="/register" className={buttonVariants()} />}>
                {t('register')}
              </SheetClose>
              <SheetClose
                render={<Link href="/login" className={buttonVariants({ variant: 'outline' })} />}
              >
                {t('login')}
              </SheetClose>
            </>
          )}
        </div>
        <div className="mt-auto px-4 pb-6">
          <Suspense>
            <LanguageSwitcher />
          </Suspense>
        </div>
      </SheetContent>
    </Sheet>
  );
}
