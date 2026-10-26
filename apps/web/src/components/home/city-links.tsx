import { ArrowUpRightIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { CITIES } from './cities';

/** Quick links into search by city, under the floor plan (SPEC §16/§17): a plain index of names. */
export async function CityLinks() {
  const t = await getTranslations('home');

  return (
    <section aria-labelledby="browse-by-city" className="space-y-6">
      <h2 id="browse-by-city" className="text-4xl">
        {t('browseByCityTitle')}
      </h2>
      <ul className="flex flex-wrap gap-x-10 gap-y-4 border-t border-foreground pt-6">
        {CITIES.map(({ key, location }) => (
          <li key={key}>
            <Link
              href={{ pathname: '/properties', query: { location } }}
              className="group inline-flex items-start gap-1 text-2xl font-extrabold tracking-tight decoration-primary decoration-2 underline-offset-8 hover:underline focus-visible:underline focus-visible:outline-none sm:text-3xl"
            >
              {t(`cities.${key}`)}
              <ArrowUpRightIcon
                className="size-5 text-muted-foreground transition-colors group-hover:text-primary"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
