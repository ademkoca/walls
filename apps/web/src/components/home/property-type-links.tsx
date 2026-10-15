import { PropertyType, enumValues } from '@walls/shared';
import {
  Briefcase,
  Building2,
  CarFront,
  Castle,
  Grid2x2,
  Home as HomeIcon,
  LandPlot,
  Store,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

const ICONS: Record<PropertyType, LucideIcon> = {
  APARTMENT: Building2,
  HOUSE: HomeIcon,
  VILLA: Castle,
  OFFICE: Briefcase,
  RETAIL: Store,
  WAREHOUSE: Warehouse,
  LAND: LandPlot,
  GARAGE: CarFront,
  OTHER: Grid2x2,
};

/** Quick links into search by property type, below the hero (SPEC §16/§17). */
export async function PropertyTypeLinks() {
  const [t, tEnums] = await Promise.all([getTranslations('home'), getTranslations('enums')]);

  return (
    <section aria-labelledby="browse-by-type" className="space-y-6">
      <h2 id="browse-by-type" className="text-2xl font-semibold tracking-tight">
        {t('browseByTypeTitle')}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {enumValues(PropertyType).map((value) => {
          const Icon = ICONS[value];
          return (
            <li key={value}>
              <Link
                href={{ pathname: '/properties', query: { propertyType: value } }}
                className="flex flex-col items-center gap-2 rounded-xl border bg-card px-4 py-6 text-center text-sm font-medium transition-colors hover:bg-muted"
              >
                <Icon className="size-6 text-primary" aria-hidden />
                {tEnums(`propertyType.${value}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
