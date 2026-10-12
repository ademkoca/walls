'use client';

import type { Currency } from '@walls/shared';
import { Button } from '@walls/ui/components/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@walls/ui/components/sheet';
import type { ListingSearch } from '@walls/validation';
import { SlidersHorizontalIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { SearchFilters } from './search-filters';

/** The search filters in a drawer, for screens too narrow for the sidebar. */
export function MobileFilters({
  search,
  priceCurrency,
  activeCount,
}: {
  search: ListingSearch;
  priceCurrency: Currency;
  activeCount: number;
}) {
  const t = useTranslations('search');
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" className="lg:hidden" />}>
        <SlidersHorizontalIcon data-icon="inline-start" />
        {t('filters')}
        {activeCount > 0 && <span className="text-muted-foreground">({activeCount})</span>}
      </SheetTrigger>
      <SheetContent side="left" className="w-80 max-w-[90vw] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('filters')}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6">
          <SearchFilters
            search={search}
            priceCurrency={priceCurrency}
            onApplied={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
