import { PropertyType, TransactionType } from '@walls/shared';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { CITIES } from './cities';

type TypeKey =
  'apartment' | 'house' | 'villa' | 'office' | 'retail' | 'warehouse' | 'land' | 'garage';

const TYPES: { key: TypeKey; propertyType: PropertyType }[] = [
  { key: 'apartment', propertyType: PropertyType.APARTMENT },
  { key: 'house', propertyType: PropertyType.HOUSE },
  { key: 'villa', propertyType: PropertyType.VILLA },
  { key: 'office', propertyType: PropertyType.OFFICE },
  { key: 'retail', propertyType: PropertyType.RETAIL },
  { key: 'warehouse', propertyType: PropertyType.WAREHOUSE },
  { key: 'land', propertyType: PropertyType.LAND },
  { key: 'garage', propertyType: PropertyType.GARAGE },
];

const RENT_CITIES = CITIES.slice(0, 3);

type CityLinkKey = 'apartmentSaleIn' | 'apartmentRentIn' | 'houseSaleIn' | 'houseRentIn';

interface PresetLink {
  id: string;
  label: string;
  query: Record<string, string>;
}

/**
 * Preset searches by transaction, property type and city, for internal linking and long-tail
 * SEO (SPEC §32). Each is only a shortcut into the existing search.
 */
export async function SeoLinks() {
  const t = await getTranslations('home');

  const byType = (transactionType: TransactionType): PresetLink[] =>
    TYPES.map(({ key, propertyType }) => ({
      id: `${key}-${transactionType}`,
      label: t(
        transactionType === TransactionType.SALE ? `seoLinks.${key}Sale` : `seoLinks.${key}Rent`,
      ),
      query: { propertyType, transactionType },
    }));

  const byCity = (
    propertyType: PropertyType,
    transactionType: TransactionType,
    cities: typeof CITIES,
    labelKey: CityLinkKey,
  ): PresetLink[] =>
    cities.map(({ key, location }) => ({
      id: `${propertyType}-${transactionType}-${key}`,
      label: t(`seoLinks.${labelKey}`, { city: t(`cities.${key}`) }),
      query: { propertyType, transactionType, location },
    }));

  const columns = [
    { id: 'sale', title: t('seoColumns.sale'), links: byType(TransactionType.SALE) },
    { id: 'rent', title: t('seoColumns.rent'), links: byType(TransactionType.RENT) },
    {
      id: 'apartments',
      title: t('seoColumns.apartments'),
      links: [
        ...byCity(PropertyType.APARTMENT, TransactionType.SALE, CITIES, 'apartmentSaleIn'),
        ...byCity(PropertyType.APARTMENT, TransactionType.RENT, RENT_CITIES, 'apartmentRentIn'),
      ],
    },
    {
      id: 'houses',
      title: t('seoColumns.houses'),
      links: [
        ...byCity(PropertyType.HOUSE, TransactionType.SALE, CITIES, 'houseSaleIn'),
        ...byCity(PropertyType.HOUSE, TransactionType.RENT, RENT_CITIES, 'houseRentIn'),
      ],
    },
  ];

  return (
    <section aria-labelledby="seo-links" className="space-y-6">
      <h2 id="seo-links" className="text-lg font-semibold tracking-tight text-muted-foreground">
        {t('seoLinksTitle')}
      </h2>
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
        {columns.map((column) => (
          <div key={column.id} className="space-y-3">
            <h3 id={`seo-links-${column.id}`} className="text-sm font-semibold">
              {column.title}
            </h3>
            <ul aria-labelledby={`seo-links-${column.id}`} className="space-y-2 text-sm">
              {column.links.map((link) => (
                <li key={link.id}>
                  <Link
                    href={{ pathname: '/properties', query: link.query }}
                    className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
