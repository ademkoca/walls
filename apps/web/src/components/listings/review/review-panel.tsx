'use client';

import { ListingAction, type ListingDetail } from '@walls/shared';
import { Button } from '@walls/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@walls/ui/components/card';
import { Input } from '@walls/ui/components/input';
import { Label } from '@walls/ui/components/label';
import { Switch } from '@walls/ui/components/switch';
import { useFormatter, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog, ReasonDialog, TypedConfirmDialog } from '@/components/dashboard/dialogs';
import { useRouter } from '@/i18n/navigation';
import { listingsApi } from '@/lib/api/listings';
import { useErrorMessage } from '@/lib/use-error-message';
import { ListingStatusActions } from '../listing-status-actions';
import { type RevisionGroup, revisionChanges } from './revision-changes';

type Dialog = 'approve' | 'reject' | 'approveRevision' | 'rejectRevision' | 'delete' | null;

/** `YYYY-MM-DD` for a date input, from an ISO timestamp. */
const dateInputValue = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

/**
 * Admin / Super Admin tools for one listing: review the submission or its pending changes,
 * change status, feature, delete permanently. Every action is authorized
 * again by the API; buttons only appear when the server says they are allowed.
 */
export function ReviewPanel({
  listing,
  onChange,
  showProposed,
  onShowProposedChange,
}: {
  listing: ListingDetail;
  onChange: (listing: ListingDetail) => void;
  showProposed: boolean;
  onShowProposedChange: (show: boolean) => void;
}) {
  const t = useTranslations('review');
  const tRevision = useTranslations('revision');
  const tEnums = useTranslations('enums');
  const format = useFormatter();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [featured, setFeatured] = useState(listing.isFeatured);
  const [featuredUntil, setFeaturedUntil] = useState(dateInputValue(listing.featuredUntil));

  const { actions } = listing.permissions;
  const changes = revisionChanges(listing);

  async function run(task: () => Promise<ListingDetail | void>, success: string) {
    setBusy(true);
    try {
      const updated = await task();
      if (updated) onChange(updated);
      toast.success(success);
      setDialog(null);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const dialogText = { cancelLabel: t('cancel') };

  return (
    <div className="space-y-4">
      {/* Pending changes first: that is what the reviewer came for. */}
      {changes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tRevision('title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">{tRevision('description')}</p>
            <div>
              <p className="font-medium">{tRevision('changed')}:</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {changes.groups.map((group: RevisionGroup) => (
                  <li key={group}>{tRevision(`groups.${group}`)}</li>
                ))}
                {changes.addedImages > 0 && (
                  <li>{tRevision('imagesAdded', { count: changes.addedImages })}</li>
                )}
              </ul>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-0"
              onClick={() => onShowProposedChange(!showProposed)}
            >
              {showProposed ? tRevision('showLive') : tRevision('showProposed')}
            </Button>
            <div className="flex flex-col gap-2">
              <Button type="button" onClick={() => setDialog('approveRevision')}>
                {tRevision('approve')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setDialog('rejectRevision')}>
                {tRevision('reject')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <Detail label={t('details.creator')}>{listing.creator.displayName}</Detail>
            <Detail label={t('details.sellerType')}>
              {tEnums(`sellerType.${listing.sellerType}`)}
            </Detail>
            {listing.publishedAt && (
              <Detail label={t('details.publishedAt')}>
                {format.dateTime(new Date(listing.publishedAt), { dateStyle: 'medium' })}
              </Detail>
            )}
            {listing.slug && <Detail label={t('details.slug')}>{listing.slug}</Detail>}
          </dl>

          {(actions.includes(ListingAction.APPROVE) || actions.includes(ListingAction.REJECT)) && (
            <div className="flex flex-col gap-2">
              {actions.includes(ListingAction.APPROVE) && (
                <Button type="button" onClick={() => setDialog('approve')}>
                  {t('approve')}
                </Button>
              )}
              {actions.includes(ListingAction.REJECT) && (
                <Button type="button" variant="outline" onClick={() => setDialog('reject')}>
                  {t('reject')}
                </Button>
              )}
            </div>
          )}

          <ListingStatusActions listing={listing} viewerIsReviewer onChange={onChange} />
        </CardContent>
      </Card>

      {listing.permissions.canSetFeatured && (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Switch id="featured" checked={featured} onCheckedChange={setFeatured} />
              <Label htmlFor="featured">{t('featured')}</Label>
            </div>
            {featured && (
              <div className="space-y-1">
                <Label htmlFor="featuredUntil">{t('featuredUntil')}</Label>
                <Input
                  id="featuredUntil"
                  type="date"
                  value={featuredUntil}
                  onChange={(event) => setFeaturedUntil(event.target.value)}
                />
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    listingsApi.setFeatured(listing.id, {
                      featured,
                      // End of the chosen day, in the reviewer's time zone.
                      featuredUntil:
                        featured && featuredUntil
                          ? new Date(`${featuredUntil}T23:59:59`).toISOString()
                          : null,
                    }),
                  t('featuredSaved'),
                )
              }
            >
              {t('saveFeatured')}
            </Button>
          </CardContent>
        </Card>
      )}

      {listing.permissions.canPermanentlyDelete && (
        <Button
          type="button"
          variant="ghost"
          className="w-full text-destructive hover:text-destructive"
          onClick={() => setDialog('delete')}
        >
          {t('permanentDelete')}
        </Button>
      )}

      <ConfirmDialog
        {...dialogText}
        open={dialog === 'approve'}
        onOpenChange={(open) => setDialog(open ? 'approve' : null)}
        title={t('approveTitle')}
        description={t('approveDescription')}
        confirmLabel={t('approve')}
        busy={busy}
        onConfirm={() => void run(() => listingsApi.approve(listing.id), t('approved'))}
      />
      <ReasonDialog
        {...dialogText}
        open={dialog === 'reject'}
        onOpenChange={(open) => setDialog(open ? 'reject' : null)}
        title={t('rejectTitle')}
        description={t('rejectDescription')}
        confirmLabel={t('reject')}
        reasonLabel={t('reason')}
        destructive
        busy={busy}
        onConfirm={(reason) =>
          void run(() => listingsApi.reject(listing.id, reason), t('rejected'))
        }
      />
      <ConfirmDialog
        {...dialogText}
        open={dialog === 'approveRevision'}
        onOpenChange={(open) => setDialog(open ? 'approveRevision' : null)}
        title={tRevision('approveTitle')}
        description={tRevision('approveDescription')}
        confirmLabel={tRevision('approve')}
        busy={busy}
        onConfirm={() =>
          void run(() => listingsApi.approveRevision(listing.id), tRevision('approved'))
        }
      />
      <ReasonDialog
        {...dialogText}
        open={dialog === 'rejectRevision'}
        onOpenChange={(open) => setDialog(open ? 'rejectRevision' : null)}
        title={tRevision('rejectTitle')}
        description={tRevision('rejectDescription')}
        confirmLabel={tRevision('reject')}
        reasonLabel={t('reason')}
        destructive
        busy={busy}
        onConfirm={(reason) =>
          void run(() => listingsApi.rejectRevision(listing.id, reason), tRevision('rejected'))
        }
      />
      <TypedConfirmDialog
        {...dialogText}
        open={dialog === 'delete'}
        onOpenChange={(open) => setDialog(open ? 'delete' : null)}
        title={t('permanentDeleteTitle')}
        description={t('permanentDeleteDescription')}
        confirmLabel={t('permanentDelete')}
        confirmWord={t('confirmWord')}
        confirmWordLabel={t('confirmWordLabel', { word: t('confirmWord') })}
        busy={busy}
        onConfirm={() =>
          void run(async () => {
            await listingsApi.permanentlyDelete(listing.id);
            router.push('/dashboard/listings');
          }, t('deleted'))
        }
      />
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </>
  );
}
