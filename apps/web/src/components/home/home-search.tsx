'use client';

import {
  type PropertyType,
  PropertyType as PropertyTypes,
  TransactionType,
  enumValues,
} from '@walls/shared';
import { Button } from '@walls/ui/components/button';
import { Input } from '@walls/ui/components/input';
import { Label } from '@walls/ui/components/label';
import { cn } from '@walls/ui/lib/utils';
import { listingSearchToQuery, parseListingSearch } from '@walls/validation';
import { SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { FilterSelect } from '../search/filter-select';
import { usePlanSelection } from './plan-selection';

/**
 * The home page search (SPEC §16): buy or rent, where, and what; opens the results. It sits in
 * the floor plan's hallway, which draws its walls, so the form has no frame of its own.
 */
export function HomeSearch() {
  const t = useTranslations('home');
  const tEnums = useTranslations('enums');
  const router = useRouter();
  const id = useId();
  const [transactionType, setTransactionType] = useState<TransactionType>(TransactionType.SALE);
  const [location, setLocation] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType | ''>('');
  const plan = usePlanSelection();

  // Light up the chosen type's room in the floor plan around the search.
  function chooseType(type: PropertyType | '') {
    setPropertyType(type);
    plan?.setSelected(type);
  }

  function search(event: React.FormEvent) {
    event.preventDefault();
    const query = parseListingSearch({ transactionType, location, propertyType });
    router.push({ pathname: '/properties', query: listingSearchToQuery(query) });
  }

  return (
    <form
      role="search"
      aria-label={t('searchLabel')}
      onSubmit={search}
      className="grid w-full gap-3 lg:grid-cols-[auto_minmax(0,1fr)_14rem_auto] lg:items-stretch"
    >
      <div
        role="group"
        aria-label={t('transactionTypeLabel')}
        className="flex border border-foreground lg:h-12"
      >
        {[
          { value: TransactionType.SALE, label: t('buy') },
          { value: TransactionType.RENT, label: t('rent') },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={transactionType === option.value}
            onClick={() => setTransactionType(option.value)}
            className={cn(
              'flex-1 px-5 py-2.5 text-sm font-semibold focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:flex-none',
              transactionType === option.value
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="contents">
        <div className="space-y-1">
          <Label htmlFor={`${id}-location`} className="sr-only">
            {t('locationLabel')}
          </Label>
          <Input
            id={`${id}-location`}
            value={location}
            placeholder={t('locationPlaceholder')}
            onChange={(event) => setLocation(event.target.value)}
            className="h-12 text-base md:text-base"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-type`} className="sr-only">
            {t('propertyTypeLabel')}
          </Label>
          <FilterSelect
            id={`${id}-type`}
            value={propertyType}
            onChange={chooseType}
            anyLabel={t('anyType')}
            triggerClassName="data-[size=default]:h-12 text-base"
            options={enumValues(PropertyTypes).map((value) => ({
              value,
              label: tEnums(`propertyType.${value}`),
            }))}
          />
        </div>
        <Button type="submit" size="xl">
          <SearchIcon data-icon="inline-start" />
          {t('search')}
        </Button>
      </div>
    </form>
  );
}
