import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { metadataLocale } from '@/i18n/locale-param';
import { Suspense } from 'react';
import { Logo } from '@/components/brand/logo';
import { DashboardMobileNav } from '@/components/dashboard/dashboard-mobile-nav';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { MAIN_CONTENT_ID, SkipLink } from '@/components/layout/skip-link';
import { UserMenu } from '@/components/layout/user-menu';
import { Link, redirect } from '@/i18n/navigation';
import { isReviewer } from '@walls/shared';
import { getCurrentUser, getInquiryCounts, getReviewQueueCounts } from '@/lib/api/server';

export async function generateMetadata({
  params,
}: LayoutProps<'/[locale]/dashboard'>): Promise<Metadata> {
  const t = await getTranslations({ locale: await metadataLocale(params), namespace: 'dashboard' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * Dashboard shell (desktop-first, tablet-compatible): a sidebar on large screens, a menu
 * drawer below that. Signed-out visitors are redirected to login on the server; every
 * dashboard API call is still authorized by the API.
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

  // Items needing attention, for the navigation; refreshed on every dashboard navigation.
  const [review, inquiries] = await Promise.all([
    isReviewer(user) ? getReviewQueueCounts() : null,
    getInquiryCounts(),
  ]);
  const counts = { review, inquiries };

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <SkipLink />
      <aside className="hidden border-r-4 border-sidebar-border bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:block lg:h-dvh lg:w-64 lg:shrink-0">
        <div className="flex flex-col gap-8 px-4 py-6">
          <Link
            href="/dashboard"
            className="rounded transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-sidebar-ring/60 focus-visible:outline-none"
          >
            <Logo className="w-32" />
          </Link>
          <DashboardNav role={user.role} counts={counts} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-2 border-b bg-card px-4 sm:px-6 lg:px-8">
          <DashboardMobileNav role={user.role} counts={counts} />
          <Link
            href="/dashboard"
            className="rounded transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:hidden"
          >
            <Logo className="w-24" />
          </Link>
          <div className="ml-auto flex items-center gap-4">
            <Suspense>
              <LanguageSwitcher />
            </Suspense>
            <UserMenu user={user} />
          </div>
        </header>
        <main id={MAIN_CONTENT_ID} className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
