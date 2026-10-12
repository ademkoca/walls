import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { metadataLocale } from '@/i18n/locale-param';
import { Suspense } from 'react';
import { Logo } from '@/components/brand/logo';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { MAIN_CONTENT_ID, SkipLink } from '@/components/layout/skip-link';
import { UserMenu } from '@/components/layout/user-menu';
import { Link, redirect } from '@/i18n/navigation';
import { isReviewer } from '@walls/shared';
import { getCurrentUser, getReviewQueueCounts } from '@/lib/api/server';

export async function generateMetadata({
  params,
}: LayoutProps<'/[locale]/dashboard'>): Promise<Metadata> {
  const t = await getTranslations({ locale: await metadataLocale(params), namespace: 'dashboard' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * Dashboard shell (desktop-first, tablet-compatible). Signed-out visitors are redirected
 * to login on the server; every dashboard API call is still authorized by the API.
 */
export default async function DashboardLayout({
  children,
  params,
}: LayoutProps<'/[locale]/dashboard'>) {
  const locale = await metadataLocale(params);
  const user = await getCurrentUser();
  if (!user) {
    // Throws a redirect; the return only narrows the type.
    redirect({ href: { pathname: '/login', query: { next: '/dashboard' } }, locale });
    return null;
  }

  // Waiting items for the reviewer navigation; refreshed on every dashboard navigation.
  const counts = isReviewer(user) ? await getReviewQueueCounts() : null;

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <SkipLink />
      <aside className="bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0">
        <div className="flex flex-col gap-4 px-4 py-4 lg:gap-8 lg:py-6">
          <Link
            href="/dashboard"
            className="rounded focus-visible:ring-3 focus-visible:ring-sidebar-ring/60 focus-visible:outline-none"
          >
            <Logo tone="inverse" className="w-32" />
          </Link>
          <DashboardNav role={user.role} counts={counts} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-end gap-4 border-b bg-card px-4 sm:px-6 lg:px-8">
          <Suspense>
            <LanguageSwitcher />
          </Suspense>
          <UserMenu user={user} />
        </header>
        <main id={MAIN_CONTENT_ID} className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
