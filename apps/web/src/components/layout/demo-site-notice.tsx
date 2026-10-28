import { Alert, AlertDescription } from '@walls/ui/components/alert';
import { brand } from '@walls/ui/brand';
import { InfoIcon } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { isDemoSite, realSiteUrl } from '@/lib/demo-site';

/**
 * Tells people on the demo and test site's sign-up pages that accounts and applications made
 * there aren't real; renders nothing anywhere else. The forms keep working for testing.
 */
export async function DemoSiteNotice() {
  if (!isDemoSite()) return null;
  const [t, locale] = await Promise.all([getTranslations('demoSite'), getLocale()]);
  return (
    <Alert role="note">
      <InfoIcon />
      <AlertDescription>
        {t('signUpNotice')}{' '}
        <a href={realSiteUrl(locale)} className="font-medium text-foreground">
          {t('link', { brand: brand.name, domain: brand.domain })}
        </a>
      </AlertDescription>
    </Alert>
  );
}
