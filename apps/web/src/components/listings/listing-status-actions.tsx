'use client';

import { ListingAction, type ListingDetail, ListingStatus, ReviewStatus } from '@walls/shared';
import { Button } from '@walls/ui/components/button';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/dashboard/dialogs';
import { useRouter } from '@/i18n/navigation';
import { type StatusChange, listingsApi } from '@/lib/api/listings';
import { useErrorMessage } from '@/lib/use-error-message';

const STATUS_ACTIONS = [
  { action: ListingAction.MARK_SOLD, path: 'mark-sold', key: 'markSold' },
  { action: ListingAction.MARK_RENTED, path: 'mark-rented', key: 'markRented' },
  { action: ListingAction.ARCHIVE, path: 'archive', key: 'archive' },
  { action: ListingAction.REOPEN, path: 'reopen', key: 'reopen' },
  { action: ListingAction.UNARCHIVE, path: 'unarchive', key: 'unarchive' },
] as const satisfies readonly { action: ListingAction; path: StatusChange; key: string }[];

/** Actions that take a listing off the public site, dropping edits waiting for review. */
const LEAVES_PUBLISHED: readonly StatusChange[] = ['mark-sold', 'mark-rented', 'archive'];

/**
 * Sold, rented, archived and back to published (SPEC §6), for the listing's creator and for
 * reviewers. Only the actions the server allows right now are shown, each confirmed first.
 */
export function ListingStatusActions({
  listing,
  viewerIsReviewer,
  onChange,
}: {
  listing: ListingDetail;
  viewerIsReviewer: boolean;
  onChange: (listing: ListingDetail) => void;
}) {
  const t = useTranslations('listingStatus');
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState<StatusChange | null>(null);
  const [busy, setBusy] = useState(false);

  const available = STATUS_ACTIONS.filter(({ action }) =>
    listing.permissions.actions.includes(action),
  );
  const archivedByTeam =
    !viewerIsReviewer &&
    listing.status === ListingStatus.ARCHIVED &&
    !listing.permissions.actions.includes(ListingAction.UNARCHIVE);
  const discardsRevision = listing.revision?.status === ReviewStatus.PENDING;

  async function change(path: StatusChange) {
    setBusy(true);
    try {
      onChange(await listingsApi.changeStatus(listing.id, path));
      toast.success(t('changed'));
      setOpen(null);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (available.length === 0) {
    return archivedByTeam ? (
      <p className="text-sm text-muted-foreground">{t('archivedByTeam')}</p>
    ) : null;
  }

  return (
    <div className="flex flex-col gap-2">
      {available.map(({ path, key }) => (
        <Button key={path} type="button" variant="outline" onClick={() => setOpen(path)}>
          {t(`actions.${key}`)}
        </Button>
      ))}
      {available.map(({ path, key }) => (
        <ConfirmDialog
          key={path}
          open={open === path}
          onOpenChange={(isOpen) => setOpen(isOpen ? path : null)}
          title={t(`confirm.${key}.title`)}
          description={[
            t(`confirm.${key}.description`, { by: viewerIsReviewer ? 'reviewer' : 'creator' }),
            discardsRevision && LEAVES_PUBLISHED.includes(path) ? t('discardsRevision') : null,
          ]
            .filter(Boolean)
            .join(' ')}
          confirmLabel={t(`actions.${key}`)}
          cancelLabel={t('cancel')}
          busy={busy}
          onConfirm={() => void change(path)}
        />
      ))}
    </div>
  );
}
