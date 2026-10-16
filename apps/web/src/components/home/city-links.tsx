import { MapPinIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { CITIES } from './cities';

/** Quick links into search by city, below the property-type tiles (SPEC §16/§17). */
export async function CityLinks() {
  const t = await getTranslations('home');

  return (
    <section aria-labelledby="browse-by-city" className="space-y-6">
      <h2 id="browse-by-city" className="text-2xl font-semibold tracking-tight">
        {t('browseByCityTitle')}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {CITIES.map(({ key, location }) => (
          <li key={key}>
            <Link
              href={{ pathname: '/properties', query: { location } }}
              className="flex flex-col items-center gap-2 rounded-xl border bg-card px-4 py-6 text-center text-sm font-medium transition-colors hover:bg-muted"
            >
              <MapPinIcon className="size-6 text-primary" aria-hidden />
              {t(`cities.${key}`)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
