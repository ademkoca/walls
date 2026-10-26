'use client';

import type { PropertyType } from '@walls/shared';
import { cn } from '@walls/ui/lib/utils';
import { createContext, useContext, useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';

interface PlanSelection {
  selected: PropertyType | '';
  setSelected: (type: PropertyType | '') => void;
}

const PlanSelectionContext = createContext<PlanSelection | null>(null);

/**
 * Shares the property type chosen in the floor plan's hallway search with the plan's rooms, so
 * the chosen type's room stays lit while the visitor fills in the rest of the search.
 */
export function PlanSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<PropertyType | ''>('');
  const value = useMemo(() => ({ selected, setSelected }), [selected]);
  return <PlanSelectionContext value={value}>{children}</PlanSelectionContext>;
}

/** The plan's selection, or null outside a floor plan. */
export function usePlanSelection(): PlanSelection | null {
  return useContext(PlanSelectionContext);
}

/** A room's link into the search by type; marked selected when the hallway search picks it. */
export function RoomLink({
  type,
  className,
  children,
}: {
  type: PropertyType;
  className?: string;
  children: React.ReactNode;
}) {
  const selected = usePlanSelection()?.selected === type;
  return (
    <Link
      href={{ pathname: '/properties', query: { propertyType: type } }}
      data-selected={selected || undefined}
      className={cn('group', className)}
    >
      {children}
    </Link>
  );
}
