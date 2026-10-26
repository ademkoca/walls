import { FOR_PROFESSIONALS_PATH, PARTNERS_PATH } from '@walls/shared';
import { brand } from '@walls/ui/brand';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Logo } from '../brand/logo';

const linkClass = 'text-sm text-muted-foreground hover:text-foreground';

export async function SiteFooter() {
  const t = await getTranslations();
  const year = new Date().getFullYear();
  return (
    <footer className="surface-ink">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[2fr_1fr_1fr] lg:px-8">
        <div className="space-y-4">
          <Logo tone="inverse" className="w-40" />
          <p className="max-w-sm text-sm text-muted-foreground">{t('metadata.description')}</p>
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
              <Link href={PARTNERS_PATH} className={linkClass}>
                {t('nav.partners')}
              </Link>
            </li>
            <li>
              <Link href={FOR_PROFESSIONALS_PATH} className={linkClass}>
                {t('nav.forProfessionals')}
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
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-foreground/70 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>{t('footer.rights', { year, brand: brand.name })}</p>
          <nav aria-label={t('footer.legal')}>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              <li>
                <Link href="/privacy" className="hover:text-foreground">
                  {t('footer.privacy')}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-foreground">
                  {t('footer.terms')}
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
