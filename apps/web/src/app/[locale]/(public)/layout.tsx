import { resolveLocale } from '@/i18n/locale-param';
import { SessionProvider } from '@/components/session/session-provider';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { MAIN_CONTENT_ID, SkipLink } from '@/components/layout/skip-link';

export default async function PublicLayout({ children, params }: LayoutProps<'/[locale]'>) {
  // Registers the locale so the header and footer can render statically.
  await resolveLocale(params);
  return (
    <SessionProvider>
      <div className="flex min-h-dvh flex-col">
        <SkipLink />
        <SiteHeader />
        <main id={MAIN_CONTENT_ID} className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </div>
    </SessionProvider>
  );
}
