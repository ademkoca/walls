import { ProfileField, type ProfileView, enumValues } from '@walls/shared';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@walls/ui/components/table';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { ProfileAvatar } from '../profiles/profile-avatar';

/**
 * Current and proposed profile side by side; changed rows are highlighted so the reviewer
 * sees what the agent wants to change (SPEC §4).
 */
export async function ProfileComparison({
  live,
  proposed,
  liveEmail,
  newEmail,
  changes,
}: {
  live: ProfileView;
  proposed: ProfileView;
  liveEmail: string;
  newEmail: string | null;
  changes: readonly ProfileField[];
}) {
  const t = await getTranslations('profileChanges');
  const text = (value: string | null) =>
    value ? <span className="whitespace-pre-line">{value}</span> : t('emptyValue');
  const yesNo = (value: boolean) => (value ? t('yes') : t('no'));
  const avatar = (view: ProfileView) => (
    <ProfileAvatar
      name={view.displayName}
      url={view.avatarUrl}
      alt=""
      className="size-16 text-lg"
    />
  );

  const rows: Record<ProfileField, [ReactNode, ReactNode]> = {
    DISPLAY_NAME: [live.displayName, proposed.displayName],
    BIO: [text(live.bio), text(proposed.bio)],
    AGENCY_NAME: [text(live.agencyName), text(proposed.agencyName)],
    PHONE: [text(live.phone), text(proposed.phone)],
    PHONE_PUBLIC: [yesNo(live.isPhonePublic), yesNo(proposed.isPhonePublic)],
    EMAIL_PUBLIC: [yesNo(live.isEmailPublic), yesNo(proposed.isEmailPublic)],
    AVATAR: [avatar(live), avatar(proposed)],
    EMAIL: [liveEmail, newEmail ?? liveEmail],
  };

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('compare.field')}</TableHead>
            <TableHead>{t('compare.live')}</TableHead>
            <TableHead>{t('compare.proposed')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {enumValues(ProfileField).map((field) => {
            const changed = changes.includes(field);
            const [current, next] = rows[field];
            return (
              <TableRow
                key={field}
                data-changed={changed || undefined}
                className="align-top data-changed:bg-accent/60"
              >
                <TableCell className="font-medium">{t(`fields.${field}`)}</TableCell>
                <TableCell className="max-w-xs whitespace-normal wrap-anywhere text-muted-foreground">
                  {current}
                </TableCell>
                <TableCell
                  className={
                    changed
                      ? 'max-w-xs whitespace-normal wrap-anywhere font-medium'
                      : 'max-w-xs whitespace-normal wrap-anywhere text-muted-foreground'
                  }
                >
                  {next}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
