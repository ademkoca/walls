'use client';

import {
  AMENITIES,
  type Amenity,
  type Currency,
  type PropertyType,
  ROOM_FILTER_OPTIONS,
  type TransactionType,
  amenitiesFor,
  enumValues,
  PropertyType as PropertyTypes,
  TransactionType as TransactionTypes,
} from '@walls/shared';
import { Button } from '@walls/ui/components/button';
import { Checkbox } from '@walls/ui/components/checkbox';
import { Field, FieldLabel, FieldLegend, FieldSet } from '@walls/ui/components/field';
import { Input } from '@walls/ui/components/input';
import { Label } from '@walls/ui/components/label';
import { type ListingSearch, listingSearchToQuery, parseListingSearch } from '@walls/validation';
import { SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { FilterSelect } from './filter-select';

const text = (value: number | string | undefined) => (value === undefined ? '' : String(value));

/** The filter form's values, as typed; '' is "no filter". */
interface FilterValues {
  q: string;
  location: string;
  transactionType: TransactionType | '';
  propertyType: PropertyType | '';
  minPrice: string;
  maxPrice: string;
  minArea: string;
  maxArea: string;
  bedrooms: string;
  bathrooms: string;
  amenities: Amenity[];
}

function initialValues(search: ListingSearch): FilterValues {
  return {
    q: text(search.q),
    location: text(search.location),
    transactionType: search.transactionType ?? '',
    propertyType: search.propertyType ?? '',
    minPrice: text(search.minPrice),
    maxPrice: text(search.maxPrice),
    minArea: text(search.minArea),
    maxArea: text(search.maxArea),
    bedrooms: text(search.bedrooms),
    bathrooms: text(search.bathrooms),
    amenities: search.amenities ?? [],
  };
}

/**
 * Search filters (SPEC §17). Applying them navigates to a URL that holds the whole search,
 * so results can be shared and bookmarked; the page validates it with the shared schema.
 * Price bounds are in `priceCurrency`.
 */
export function SearchFilters({
  search,
  priceCurrency,
  onApplied,
}: {
  search: ListingSearch;
  priceCurrency: Currency;
  onApplied?: () => void;
}) {
  const t = useTranslations('search');
  const tEnums = useTranslations('enums');
  const router = useRouter();
  const id = useId();
  const [values, setValues] = useState(() => initialValues(search));
  const set = <K extends keyof FilterValues>(key: K, value: FilterValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  // Only the features that apply to the chosen property type (all without one).
  const amenityOptions = values.propertyType ? amenitiesFor(values.propertyType) : AMENITIES;
  const roomOptions = ROOM_FILTER_OPTIONS.map((count) => ({
    value: String(count),
    label: t('atLeast', { count }),
  }));

  function apply(event: React.FormEvent) {
    event.preventDefault();
    const amenities = values.amenities.filter((code) => amenityOptions.includes(code));
    const next = parseListingSearch({
      ...values,
      amenities: amenities.join(','),
      currency: priceCurrency,
      sort: search.sort,
    });
    router.push({ pathname: '/properties', query: listingSearchToQuery(next) });
    onApplied?.();
  }

  const field = (name: string) => `${id}-${name}`;

  return (
    <form onSubmit={apply} className="space-y-5" role="search" aria-label={t('filters')}>
      <Field>
        <FieldLabel htmlFor={field('q')}>{t('keyword')}</FieldLabel>
        <Input
          id={field('q')}
          type="search"
          value={values.q}
          placeholder={t('keywordPlaceholder')}
          onChange={(event) => set('q', event.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={field('location')}>{t('location')}</FieldLabel>
        <Input
          id={field('location')}
          value={values.location}
          placeholder={t('locationPlaceholder')}
          onChange={(event) => set('location', event.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={field('transactionType')}>{t('transactionType')}</FieldLabel>
        <FilterSelect
          id={field('transactionType')}
          value={values.transactionType}
          onChange={(value) => set('transactionType', value)}
          anyLabel={t('any')}
          options={enumValues(TransactionTypes).map((value) => ({
            value,
            label: tEnums(`transactionType.${value}`),
          }))}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={field('propertyType')}>{t('propertyType')}</FieldLabel>
        <FilterSelect
          id={field('propertyType')}
          value={values.propertyType}
          onChange={(value) => set('propertyType', value)}
          anyLabel={t('any')}
          options={enumValues(PropertyTypes).map((value) => ({
            value,
            label: tEnums(`propertyType.${value}`),
          }))}
        />
      </Field>
      <RangeFields
        legend={t('price', { currency: priceCurrency })}
        min={{ id: field('minPrice'), label: t('minPrice'), value: values.minPrice }}
        max={{ id: field('maxPrice'), label: t('maxPrice'), value: values.maxPrice }}
        onMin={(value) => set('minPrice', value)}
        onMax={(value) => set('maxPrice', value)}
      />
      <RangeFields
        legend={t('area')}
        min={{ id: field('minArea'), label: t('minArea'), value: values.minArea }}
        max={{ id: field('maxArea'), label: t('maxArea'), value: values.maxArea }}
        onMin={(value) => set('minArea', value)}
        onMax={(value) => set('maxArea', value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor={field('bedrooms')}>{t('bedrooms')}</FieldLabel>
          <FilterSelect
            id={field('bedrooms')}
            value={values.bedrooms}
            onChange={(value) => set('bedrooms', value)}
            anyLabel={t('any')}
            options={roomOptions}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={field('bathrooms')}>{t('bathrooms')}</FieldLabel>
          <FilterSelect
            id={field('bathrooms')}
            value={values.bathrooms}
            onChange={(value) => set('bathrooms', value)}
            anyLabel={t('any')}
            options={roomOptions}
          />
        </Field>
      </div>
      <FieldSet>
        <FieldLegend variant="label">{t('amenities')}</FieldLegend>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-1">
          {amenityOptions.map((code) => (
            <li key={code}>
              <Label className="flex items-center gap-2 font-normal">
                <Checkbox
                  checked={values.amenities.includes(code)}
                  onCheckedChange={(checked) =>
                    set(
                      'amenities',
                      checked
                        ? [...values.amenities, code]
                        : values.amenities.filter((value) => value !== code),
                    )
                  }
                />
                {tEnums(`amenity.${code}`)}
              </Label>
            </li>
          ))}
        </ul>
      </FieldSet>
      <div className="flex flex-col gap-2">
        <Button type="submit">
          <SearchIcon data-icon="inline-start" />
          {t('apply')}
        </Button>
        <Link
          href="/properties"
          onClick={onApplied}
          className="text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t('clear')}
        </Link>
      </div>
    </form>
  );
}

interface RangeInput {
  id: string;
  label: string;
  value: string;
}

function RangeFields({
  legend,
  min,
  max,
  onMin,
  onMax,
}: {
  legend: string;
  min: RangeInput;
  max: RangeInput;
  onMin: (value: string) => void;
  onMax: (value: string) => void;
}) {
  const t = useTranslations('search');
  return (
    <FieldSet>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <div className="grid grid-cols-2 gap-3">
        {[
          { input: min, onChange: onMin, placeholder: t('min') },
          { input: max, onChange: onMax, placeholder: t('max') },
        ].map(({ input, onChange, placeholder }) => (
          <Input
            key={input.id}
            id={input.id}
            aria-label={input.label}
            type="number"
            inputMode="numeric"
            min={0}
            value={input.value}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        ))}
      </div>
    </FieldSet>
  );
}
