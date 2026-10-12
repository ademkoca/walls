import { Role, UserStatus, enumValues } from '@walls/shared';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@walls/ui/components/table';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { InviteAdminDialog } from '@/components/admin/invite-admin-dialog';
import { Pager, pageParam, param } from '@/components/admin/pager';
import { UserFilters } from '@/components/admin/user-filters';
import { UserStatusBadge } from '@/components/admin/user-status-badge';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { Link } from '@/i18n/navigation';
import { getCurrentUser, getUsers } from '@/lib/api/server';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/users'>): Promise<Metadata> {
  const t = await getTranslations({ locale: await metadataLocale(params), namespace: 'users' });
  return { title: t('title') };
}

const oneOf = <T extends string>(values: readonly T[], value: string | undefined) =>
  values.find((candidate) => candidate === value);

/** User administration (Admins and Super Admins; the API enforces it). */
export default async function UsersPage({
  params,
  searchParams,
}: PageProps<'/[locale]/dashboard/users'>) {
  await resolveLocale(params);
  const search = await searchParams;
  const t = await getTranslations('users');
  const tEnums = await getTranslations('enums');
  const format = await getFormatter();
  const filters = {
    q: param(search.q),
    role: oneOf(enumValues(Role), param(search.role)),
    status: oneOf(enumValues(UserStatus), param(search.status)),
  };
  const page = pageParam(search.page);
  const [result, viewer] = await Promise.all([getUsers({ ...filters, page }), getCurrentUser()]);
  if (!result || !viewer) return null;

  const query = Object.fromEntries(
    Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        {viewer.role === Role.SUPER_ADMIN && <InviteAdminDialog />}
      </div>

      <UserFilters initial={filters} />

      {result.items.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          {t('empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.name')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('columns.email')}</TableHead>
                <TableHead>{t('columns.role')}</TableHead>
                <TableHead>{t('columns.status')}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('columns.joined')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/users/${user.id}`}
                      className="font-medium hover:underline"
                    >
                      {user.displayName}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden max-w-64 truncate text-muted-foreground md:table-cell">
                    {user.email}
                  </TableCell>
                  <TableCell>{tEnums(`role.${user.role}`)}</TableCell>
                  <TableCell>
                    <UserStatusBadge status={user.status} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {format.dateTime(new Date(user.createdAt), { dateStyle: 'medium' })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Pager pathname="/dashboard/users" query={query} page={page} hasMore={result.hasMore} />
    </div>
  );
}
