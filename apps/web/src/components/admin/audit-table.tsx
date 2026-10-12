import type { AuditLogEntry } from '@walls/shared';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@walls/ui/components/table';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/** Audit entries with readable action names; before/after values in an expandable block. */
export async function AuditTable({
  entries,
  showEntity = true,
}: {
  entries: AuditLogEntry[];
  showEntity?: boolean;
}) {
  const t = await getTranslations('auditLog');
  const format = await getFormatter();
  // Codes without a translation (added later) are shown as they are.
  const actionLabel = (action: string) => {
    const key = `actions.${action}` as Parameters<typeof t>[0];
    return t.has(key) ? t(key) : action;
  };

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('columns.time')}</TableHead>
            <TableHead>{t('columns.action')}</TableHead>
            {showEntity && (
              <TableHead className="hidden md:table-cell">{t('columns.entity')}</TableHead>
            )}
            <TableHead className="hidden md:table-cell">{t('columns.actor')}</TableHead>
            <TableHead>{t('columns.reason')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id} className="align-top">
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {format.dateTime(new Date(entry.createdAt), {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </TableCell>
              <TableCell>
                <span className="font-medium">{actionLabel(entry.action)}</span>
                {(entry.before ?? entry.after) && (
                  <details className="mt-1 text-xs text-muted-foreground">
                    <summary className="cursor-pointer">{t('details')}</summary>
                    <pre className="mt-1 max-w-md overflow-x-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(
                        { [t('before')]: entry.before, [t('after')]: entry.after },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                )}
              </TableCell>
              {showEntity && (
                <TableCell className="hidden md:table-cell">
                  <EntityLink
                    entry={entry}
                    label={entry.entityType === 'LISTING' ? t('listing') : t('user')}
                  />
                </TableCell>
              )}
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {entry.actor?.displayName ?? t('system')}
              </TableCell>
              <TableCell className="max-w-xs whitespace-pre-line text-muted-foreground">
                {entry.reason}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EntityLink({ entry, label }: { entry: AuditLogEntry; label: string }) {
  const href =
    entry.entityType === 'LISTING'
      ? `/dashboard/listings/${entry.entityId}`
      : entry.entityType === 'USER'
        ? `/dashboard/users/${entry.entityId}`
        : null;
  const text = `${label} ${entry.entityId.slice(0, 8)}`;
  return href ? (
    <Link href={href} className="hover:underline">
      {text}
    </Link>
  ) : (
    <span>{text}</span>
  );
}
