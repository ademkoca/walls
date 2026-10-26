import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuditTable } from '@/components/admin/audit-table';
import { Pager, pageParam, param } from '@/components/admin/pager';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { getAuditLog } from '@/lib/api/server';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/audit-log'>): Promise<Metadata> {
  const t = await getTranslations({ locale: await metadataLocale(params), namespace: 'auditLog' });
  return { title: t('title') };
}

/** The platform audit log (SPEC §25), newest first. */
export default async function AuditLogPage({
  params,
  searchParams,
}: PageProps<'/[locale]/dashboard/audit-log'>) {
  await resolveLocale(params);
  const search = await searchParams;
  const t = await getTranslations('auditLog');
  const filters = { entityType: param(search.entityType), entityId: param(search.entityId) };
  const page = pageParam(search.page);
  const result = await getAuditLog({ ...filters, page });
  if (!result) return null;
  const query = Object.fromEntries(
    Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-4xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>
      {result.items.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          {t('empty')}
        </p>
      ) : (
        <AuditTable entries={result.items} />
      )}
      <Pager pathname="/dashboard/audit-log" query={query} page={page} hasMore={result.hasMore} />
    </div>
  );
}
