'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@walls/ui/components/select';

const ANY = '__any';

/** A select with an "any" choice first; '' means no filter. */
export function FilterSelect<T extends string>({
  id,
  value,
  onChange,
  options,
  anyLabel,
}: {
  id: string;
  value: T | '';
  onChange: (value: T | '') => void;
  options: readonly { value: T; label: string }[];
  anyLabel: string;
}) {
  const items = [{ value: ANY, label: anyLabel }, ...options];
  return (
    <Select
      items={items}
      value={value === '' ? ANY : value}
      onValueChange={(next) => onChange(!next || next === ANY ? '' : (next as T))}
    >
      <SelectTrigger id={id} className="w-full">
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
  );
}
