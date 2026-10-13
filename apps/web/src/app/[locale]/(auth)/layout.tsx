import { brand } from '@walls/ui/brand';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { resolveLocale } from '@/i18n/locale-param';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { MAIN_CONTENT_ID } from '@/components/layout/skip-link';

/** Minimal, centred layout for account pages (login, registration, password reset, …). */
export default async function AuthLayout({ children, params }: LayoutProps<'/[locale]'>) {
  await resolveLocale(params);
  const t = await getTranslations('footer');
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-4 pt-8">
        <Link
          href="/"
          className="rounded transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Logo className="w-32" priority />
        </Link>
        <Suspense>
          <LanguageSwitcher />
        </Suspense>
      </header>
      <main
        id={MAIN_CONTENT_ID}
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10"
      >
        {children}
      </main>
      <footer className="pb-8 text-center text-xs text-muted-foreground">
        {t('rights', { year: new Date().getFullYear(), brand: brand.name })}
      </footer>
    </div>
  );
}
