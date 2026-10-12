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

/** The home page search (SPEC §16): buy or rent, where, and what; opens the results. */
export function HomeSearch() {
  const t = useTranslations('home');
  const tEnums = useTranslations('enums');
  const router = useRouter();
  const id = useId();
  const [transactionType, setTransactionType] = useState<TransactionType>(TransactionType.SALE);
  const [location, setLocation] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType | ''>('');

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
      className="w-full max-w-4xl space-y-3 rounded-xl border bg-card p-4 sm:p-5"
    >
      <div role="group" aria-label={t('transactionTypeLabel')} className="flex gap-2">
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
              'rounded-md px-4 py-1.5 text-sm font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              transactionType === option.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem_auto]">
        <div className="space-y-1">
          <Label htmlFor={`${id}-location`} className="sr-only">
            {t('locationLabel')}
          </Label>
          <Input
            id={`${id}-location`}
            value={location}
            placeholder={t('locationPlaceholder')}
            onChange={(event) => setLocation(event.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-type`} className="sr-only">
            {t('propertyTypeLabel')}
          </Label>
          <FilterSelect
            id={`${id}-type`}
            value={propertyType}
            onChange={setPropertyType}
            anyLabel={t('anyType')}
            options={enumValues(PropertyTypes).map((value) => ({
              value,
              label: tEnums(`propertyType.${value}`),
            }))}
          />
        </div>
        <Button type="submit" size="lg" className="h-10">
          <SearchIcon data-icon="inline-start" />
          {t('search')}
        </Button>
      </div>
    </form>
  );
}
