import { brand } from '@walls/ui/brand';
import { getLocale, getTranslations } from 'next-intl/server';
import { isDemoSite, realSiteUrl } from '@/lib/demo-site';

/** Bar above every page of the demo and test site; renders nothing anywhere else. */
export async function DemoSiteBanner() {
  if (!isDemoSite()) return null;
  const [t, locale] = await Promise.all([getTranslations('demoSite'), getLocale()]);
  return (
    <div className="surface-ink border-b border-border px-4 py-2 text-center text-sm">
      <p>
        {t('banner')}{' '}
        <a
          href={realSiteUrl(locale)}
          className="font-semibold whitespace-nowrap text-emphasis underline underline-offset-4"
        >
          {t('link', { brand: brand.name, domain: brand.domain })}
        </a>
      </p>
    </div>
  );
}
