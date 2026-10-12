import { brand } from '@walls/ui/brand';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Logo } from '../brand/logo';

const linkClass = 'text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground';

export async function SiteFooter() {
  const t = await getTranslations();
  const year = new Date().getFullYear();
  return (
    <footer className="bg-sidebar text-sidebar-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[2fr_1fr_1fr] lg:px-8">
        <div className="space-y-4">
          <Logo tone="inverse" className="w-40" />
          <p className="max-w-sm text-sm text-sidebar-foreground/80">{t('metadata.description')}</p>
        </div>
        <nav aria-label={t('footer.explore')} className="space-y-3">
          <h2 className="text-sm font-semibold">{t('footer.explore')}</h2>
          <ul className="space-y-2">
            <li>
              <Link href="/properties" className={linkClass}>
                {t('nav.properties')}
              </Link>
            </li>
            <li>
              <Link href="/agents" className={linkClass}>
                {t('nav.agents')}
              </Link>
            </li>
            <li>
              <Link href="/for-agents" className={linkClass}>
                {t('nav.forAgents')}
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label={t('footer.company')} className="space-y-3">
          <h2 className="text-sm font-semibold">{t('footer.company')}</h2>
          <ul className="space-y-2">
            <li>
              <Link href="/about" className={linkClass}>
                {t('nav.about')}
              </Link>
            </li>
            <li>
              <Link href="/contact" className={linkClass}>
                {t('nav.contact')}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-sidebar-border">
        <p className="mx-auto max-w-7xl px-4 py-6 text-xs text-sidebar-foreground/70 sm:px-6 lg:px-8">
          {t('footer.rights', { year, brand: brand.name })}
        </p>
      </div>
    </footer>
  );
}
