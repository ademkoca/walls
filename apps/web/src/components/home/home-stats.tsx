import type { PublicHome } from '@walls/shared';
import { brand } from '@walls/ui/brand';
import { getFormatter, getTranslations } from 'next-intl/server';

/** Platform totals under the home page search; a zero count is left out rather than shown. */
export async function HomeStats({ stats }: { stats: PublicHome['stats'] | undefined }) {
  // Netlify deploys the web app before Render deploys the API, so for a while after a release
  // the API may not send stats yet.
  if (!stats) return null;
  const [t, format] = await Promise.all([getTranslations('home.stats'), getFormatter()]);
  const items = [
    { key: 'listings', count: stats.listings },
    { key: 'cities', count: stats.cities },
    { key: 'partners', count: stats.partners },
  ] as const;
  const shown = items.filter((item) => item.count > 0);
  if (shown.length === 0) return null;

  return (
    <dl aria-label={t('label', { brand: brand.name })} className="flex flex-wrap gap-x-10 gap-y-4">
      {shown.map(({ key, count }) => (
        <div key={key} className="flex flex-col-reverse">
          <dt className="text-sm text-muted-foreground">{t(key, { count })}</dt>
          <dd className="text-2xl font-semibold tracking-tight">{format.number(count)}</dd>
        </div>
      ))}
    </dl>
  );
}
