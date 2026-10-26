import { cn } from '@walls/ui/lib/utils';

/** One number with its label, e.g. "Views 128". */
export function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border bg-card p-4', className)}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-3xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
