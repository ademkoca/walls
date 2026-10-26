import { FOR_PROFESSIONALS_PATH } from '@walls/shared';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { Link } from '@/i18n/navigation';
import { Logo } from '../brand/logo';
import { CurrencySwitcher } from './currency-switcher';
import { HeaderAuth } from './header-auth';
import { LanguageSwitcher } from './language-switcher';
import { MainNav } from './main-nav';
import { MobileNav } from './mobile-nav';

export async function SiteHeader() {
  const t = await getTranslations('nav');
  return (
    <header className="sticky top-0 z-40 border-b border-foreground bg-background">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:gap-8 lg:px-8">
        <Link
          href="/"
          className="shrink-0 rounded transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Logo className="w-32 sm:w-36" priority />
        </Link>
        <MainNav />
        <div className="ml-auto flex items-center gap-3">
          <Link
            href={FOR_PROFESSIONALS_PATH}
            className="hidden text-sm font-medium text-muted-foreground hover:text-foreground lg:block"
          >
            {t('forProfessionals')}
          </Link>
          <CurrencySwitcher className="hidden sm:flex" />
          <Suspense>
            <LanguageSwitcher className="hidden sm:flex" />
          </Suspense>
          <div className="hidden md:block">
            <HeaderAuth />
          </div>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
