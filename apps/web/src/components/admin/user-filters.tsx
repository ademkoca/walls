'use client';

import { Role, UserStatus, enumValues } from '@walls/shared';
import { Button } from '@walls/ui/components/button';
import { Input } from '@walls/ui/components/input';
import { SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { EnumSelect } from '@/components/listings/editor/enum-select';
import { useRouter } from '@/i18n/navigation';

/** Search and role/status filters for the user list; state lives in the URL. */
export function UserFilters({
  initial,
}: {
  initial: { q?: string; role?: Role; status?: UserStatus };
}) {
  const t = useTranslations('users');
  const tEnums = useTranslations('enums');
  const router = useRouter();
  const [q, setQ] = useState(initial.q ?? '');
  const [role, setRole] = useState<Role | ''>(initial.role ?? '');
  const [status, setStatus] = useState<UserStatus | ''>(initial.status ?? '');

  return (
    <form
      role="search"
      className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_12rem_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        const query: Record<string, string> = {};
        if (q.trim()) query.q = q.trim();
        if (role) query.role = role;
        if (status) query.status = status;
        router.push({ pathname: '/dashboard/users', query });
      }}
    >
      <Input
        aria-label={t('search')}
        placeholder={t('search')}
        value={q}
        onChange={(event) => setQ(event.target.value)}
      />
      <EnumSelect
        id="user-role"
        value={role}
        onChange={setRole}
        placeholder={t('allRoles')}
        options={enumValues(Role).map((value) => ({ value, label: tEnums(`role.${value}`) }))}
      />
      <EnumSelect
        id="user-status"
        value={status}
        onChange={setStatus}
        placeholder={t('allStatuses')}
        options={enumValues(UserStatus).map((value) => ({
          value,
          label: tEnums(`userStatus.${value}`),
        }))}
      />
      <Button type="submit" variant="outline">
        <SearchIcon data-icon="inline-start" />
        {t('filter')}
      </Button>
    </form>
  );
}
