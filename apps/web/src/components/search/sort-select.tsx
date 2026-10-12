'use client';

import { ListingSort, enumValues } from '@walls/shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@walls/ui/components/select';
import { Label } from '@walls/ui/components/label';
import { type ListingSearch, listingSearchToQuery } from '@walls/validation';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { useRouter } from '@/i18n/navigation';

/** Changes the sort order of the results, starting again from the first page. */
export function SortSelect({ search }: { search: ListingSearch }) {
  const t = useTranslations('search');
  const router = useRouter();
  const id = useId();
  const items = enumValues(ListingSort).map((value) => ({
    value,
    label: t(`sortOptions.${value}`),
  }));

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="shrink-0 text-sm text-muted-foreground">
        {t('sort')}
      </Label>
      <Select
        items={items}
        value={search.sort}
        onValueChange={(sort) => {
          if (!sort) return;
          router.push({
            pathname: '/properties',
            query: listingSearchToQuery({ ...search, sort, page: 1 }),
          });
        }}
      >
        <SelectTrigger id={id} className="w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
