'use client';

import { FOR_PROFESSIONALS_PATH } from '@walls/shared';
import { Button, buttonVariants } from '@walls/ui/components/button';
import { Separator } from '@walls/ui/components/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@walls/ui/components/sheet';
import { MenuIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useSession } from '../session/session-provider';
import { CurrencySwitcher } from './currency-switcher';
import { LanguageSwitcher } from './language-switcher';
import { MAIN_NAV } from './nav-items';

/** Navigation drawer for small screens. */
export function MobileNav() {
  const t = useTranslations('nav');
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const linkClass = 'block rounded-md px-3 py-2.5 text-base font-medium hover:bg-muted';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
        <MenuIcon />
        <span className="sr-only">{t('openMenu')}</span>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 max-w-[85vw]">
        <SheetHeader>
          <SheetTitle>{t('mainLabel')}</SheetTitle>
        </SheetHeader>
        <nav aria-label={t('mainLabel')} className="flex flex-col gap-1 px-4">
          {[
            ...MAIN_NAV,
            { href: FOR_PROFESSIONALS_PATH, labelKey: 'forProfessionals' } as const,
          ].map((item) => (
            <Link key={item.href} href={item.href} className={linkClass} onClick={close}>
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>
        <Separator className="my-2" />
        <div className="flex flex-col gap-2 px-4">
          {session.status === 'authenticated' ? (
            <Link href="/dashboard" className={buttonVariants()} onClick={close}>
              {t('dashboard')}
            </Link>
          ) : (
            <>
              <Link href="/register" className={buttonVariants()} onClick={close}>
                {t('register')}
              </Link>
              <Link
                href="/login"
                className={buttonVariants({ variant: 'outline' })}
                onClick={close}
              >
                {t('login')}
              </Link>
            </>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between gap-4 px-4 pb-6">
          <Suspense>
            <LanguageSwitcher />
          </Suspense>
          <CurrencySwitcher />
        </div>
      </SheetContent>
    </Sheet>
  );
}
