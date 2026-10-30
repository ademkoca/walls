'use client';

import {
  ApiErrorCode,
  ListingAction,
  type ListingContentView,
  type ListingDetail,
  ListingEditMode,
  type ListingImage,
  ListingStatus,
  ReviewStatus,
  checkSubmissionRequirements,
  publicListingPath,
} from '@walls/shared';
import { Alert, AlertDescription, AlertTitle } from '@walls/ui/components/alert';
import { Button, buttonVariants } from '@walls/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@walls/ui/components/card';
import { Spinner } from '@walls/ui/components/spinner';
import { ArrowLeftIcon, CircleAlertIcon, ExternalLinkIcon, InfoIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useState } from 'react';
import { FormProvider, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/dashboard/dialogs';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/errors';
import { listingsApi } from '@/lib/api/listings';
import { useErrorMessage } from '@/lib/use-error-message';
import { ListingStatusBadge } from '../listing-status-badge';
import { ReviewPanel } from '../review/review-panel';
import { ListingImages } from './listing-images';
import {
  AmenitiesSection,
  BasicsSection,
  DetailsSection,
  LocationSection,
  PriceSection,
  TextsSection,
} from './listing-form-sections';
import {
  editorContent,
  formSubmissionSnapshot,
  proposedContent,
  remainingImageCount,
  toFormValues,
  toListingInput,
} from './listing-form-model';
import { SubmissionChecklist } from './submission-checklist';
import { useListingForm } from './use-listing-form';
import { QuotedText } from '@/components/dashboard/quoted-text';

type Busy = 'save' | 'submit' | 'revise' | 'delete' | null;

/**
 * The dashboard listing page. Editors edit drafts and published listings (SPEC §6) and
 * manage images; reviewers see the content read-only, with the review panel.
 */
export function ListingEditor({
  initialListing,
  viewerIsReviewer,
  insights,
}: {
  initialListing: ListingDetail;
  viewerIsReviewer: boolean;
  /** Shown under the status notice, e.g. the listing's views and inquiries. */
  insights?: ReactNode;
}) {
  const t = useTranslations('listings');
  const tPublished = useTranslations('listings.editor.published');
  const tNav = useTranslations('dashboard.nav');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [listing, setListing] = useState(initialListing);
  const [images, setImages] = useState<ListingImage[]>(initialListing.images);
  const [busy, setBusy] = useState<Busy>(null);
  const [confirm, setConfirm] = useState<'submit' | 'delete' | null>(null);
  // Reviewers look at pending changes by default; they can switch to the live version.
  const [showProposed, setShowProposed] = useState(true);

  const { editMode } = listing.permissions;
  const editable = editMode !== null;
  const editingPublished = editMode === ListingEditMode.PUBLISHED;

  /** What the form shows: the editor's working version, or for reviewers live/proposed. */
  const displayedContent = (next: ListingDetail): ListingContentView =>
    viewerIsReviewer
      ? ((showProposed ? proposedContent(next) : null) ?? next)
      : editorContent(next);

  const form = useListingForm(toFormValues(displayedContent(initialListing)));
  const { isDirty } = form.formState;
  const values = useWatch({ control: form.control });
  const canSubmit = listing.permissions.actions.includes(ListingAction.SUBMIT);
  const canRevise = listing.permissions.actions.includes(ListingAction.REVISE);
  // `values` (useWatch) re-renders on every change, so the checklist stays current.
  const issues = checkSubmissionRequirements(
    formSubmissionSnapshot(form.getValues(), remainingImageCount(listing, images.length)),
  );

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  function applyListing(next: ListingDetail) {
    setListing(next);
    setImages(next.images);
    form.reset(toFormValues(displayedContent(next)));
  }

  /**
   * After an image change on a published listing the server may have created or updated
   * the pending revision; reload it without discarding unsaved form edits.
   */
  async function onImagesChange(next: ListingImage[]) {
    setImages(next);
    if (!editingPublished) return;
    try {
      const refreshed = await listingsApi.get(listing.id);
      setListing(refreshed);
      setImages(refreshed.images);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  /** Validates and saves the form. Returns the saved listing, or null on failure. */
  async function save(): Promise<ListingDetail | null> {
    let saved: ListingDetail | null = null;
    await form.handleSubmit(async (formValues) => {
      try {
        saved = await listingsApi.update(listing.id, toListingInput(formValues));
        applyListing(saved);
      } catch (error) {
        toast.error(errorMessage(error));
      }
    })();
    return saved;
  }

  async function run(action: Exclude<Busy, null>, task: () => Promise<void>) {
    setBusy(action);
    try {
      await task();
    } finally {
      setBusy(null);
    }
  }

  const onSave = () =>
    run('save', async () => {
      const saved = await save();
      if (!saved) return;
      const sentForReview = editingPublished && proposedContent(saved) !== null;
      toast.success(
        sentForReview
          ? tPublished('sentForReview')
          : editingPublished
            ? tPublished('saved')
            : t('editor.saved'),
      );
    });

  const onSubmit = () =>
    run('submit', async () => {
      setConfirm(null);
      if (isDirty && !(await save())) return;
      try {
        applyListing(await listingsApi.submit(listing.id));
        toast.success(t('editor.submitted'));
        router.refresh();
      } catch (error) {
        const incomplete =
          error instanceof ApiError && error.code === ApiErrorCode.SUBMISSION_INCOMPLETE;
        toast.error(
          errorMessage(error),
          incomplete ? { description: t('editor.checklist.missing') } : undefined,
        );
      }
    });

  const onRevise = () =>
    run('revise', async () => {
      try {
        applyListing(await listingsApi.revise(listing.id));
        toast.success(t('editor.revised'));
      } catch (error) {
        toast.error(errorMessage(error));
      }
    });

  const onDelete = () =>
    run('delete', async () => {
      setConfirm(null);
      try {
        await listingsApi.remove(listing.id);
        toast.success(t('editor.deleted'));
        form.reset(form.getValues());
        router.push('/dashboard/listings');
        router.refresh();
      } catch (error) {
        toast.error(errorMessage(error));
      }
    });

  const title = values.texts?.sr?.title?.trim() || t('untitled');
  const pendingRevision = listing.revision?.status === ReviewStatus.PENDING;
  const removedImageIds = pendingRevision ? (listing.revision?.removedImageIds ?? []) : [];

  return (
    <FormProvider {...form}>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-4">
          <Link
            href="/dashboard/listings"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" aria-hidden />
            {t('backToList')}
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
              <ListingStatusBadge status={listing.status} />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {isDirty && editable && (
                <p className="text-sm text-muted-foreground" role="status">
                  {t('editor.unsaved')}
                </p>
              )}
              {listing.status === ListingStatus.PUBLISHED && listing.slug && (
                <Link
                  href={publicListingPath(listing.slug)}
                  target="_blank"
                  rel="noopener"
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  <ExternalLinkIcon data-icon="inline-start" />
                  {t('viewOnSite')}
                  <span className="sr-only"> ({tNav('newTab')})</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        <StatusNotice listing={listing} viewerIsReviewer={viewerIsReviewer} />
        {insights}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (editable) void onSave();
            }}
            className="space-y-6"
          >
            {editable && (
              <p className="text-sm text-muted-foreground">{t('editor.requiredHint')}</p>
            )}
            <fieldset disabled={!editable} className="contents">
              <Section title={t('editor.sections.basics')}>
                <BasicsSection editable={editable} />
              </Section>
            </fieldset>
            <Section title={t('editor.sections.description')}>
              <TextsSection editable={editable} />
            </Section>
            <fieldset disabled={!editable} className="contents">
              <Section title={t('editor.sections.location')}>
                <LocationSection editable={editable} />
              </Section>
              <Section title={t('editor.sections.details')}>
                <DetailsSection editable={editable} />
              </Section>
              <Section title={t('editor.sections.amenities')}>
                <AmenitiesSection editable={editable} />
              </Section>
              <Section title={t('editor.sections.price')}>
                <PriceSection editable={editable} />
              </Section>
            </fieldset>
            <Section title={t('editor.sections.images')}>
              <ListingImages
                listingId={listing.id}
                images={images}
                onImagesChange={(next) => void onImagesChange(next)}
                editable={editable}
                published={listing.publishedAt !== null}
                removedImageIds={removedImageIds}
              />
            </Section>
          </form>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            {viewerIsReviewer && (
              <ReviewPanel
                listing={listing}
                onChange={applyListing}
                showProposed={showProposed}
                onShowProposedChange={(show) => {
                  setShowProposed(show);
                  form.reset(toFormValues((show ? proposedContent(listing) : null) ?? listing));
                }}
              />
            )}
            {(editable || canSubmit || canRevise || listing.permissions.canDelete) && (
              <Card>
                <CardContent className="flex flex-col gap-2">
                  {editable && (
                    <Button
                      type="button"
                      variant={editingPublished ? 'default' : 'outline'}
                      disabled={busy !== null || !isDirty}
                      onClick={() => void onSave()}
                    >
                      {busy === 'save' && <Spinner data-icon="inline-start" />}
                      {editingPublished ? tPublished('saveChanges') : t('editor.save')}
                    </Button>
                  )}
                  {canSubmit && (
                    <Button
                      type="button"
                      disabled={busy !== null || issues.length > 0}
                      onClick={() => setConfirm('submit')}
                    >
                      {busy === 'submit' && <Spinner data-icon="inline-start" />}
                      {t('editor.submit')}
                    </Button>
                  )}
                  {canRevise && (
                    <Button type="button" disabled={busy !== null} onClick={() => void onRevise()}>
                      {busy === 'revise' && <Spinner data-icon="inline-start" />}
                      {t('editor.revise')}
                    </Button>
                  )}
                  {listing.permissions.canDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={busy !== null}
                      onClick={() => setConfirm('delete')}
                    >
                      {t('editor.delete')}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
            {editable && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('editor.checklist.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <SubmissionChecklist issues={issues} />
                </CardContent>
              </Card>
            )}
          </aside>
        </div>
      </div>

      <ConfirmDialog
        open={confirm === 'submit'}
        onOpenChange={(open) => setConfirm(open ? 'submit' : null)}
        title={t('editor.submitConfirmTitle')}
        description={t('editor.submitConfirmDescription')}
        confirmLabel={t('editor.submit')}
        cancelLabel={t('editor.cancel')}
        onConfirm={() => void onSubmit()}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(open) => setConfirm(open ? 'delete' : null)}
        title={t('editor.deleteConfirmTitle')}
        description={t('editor.deleteConfirmDescription')}
        confirmLabel={t('editor.delete')}
        cancelLabel={t('editor.cancel')}
        destructive
        onConfirm={() => void onDelete()}
      />
    </FormProvider>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function StatusNotice({
  listing,
  viewerIsReviewer,
}: {
  listing: ListingDetail;
  viewerIsReviewer: boolean;
}) {
  const t = useTranslations('listings.editor');
  const tReview = useTranslations('review');
  const showReason =
    listing.rejectionReason &&
    (listing.status === ListingStatus.REJECTED || listing.status === ListingStatus.DRAFT);
  const editingPublished = listing.permissions.editMode === ListingEditMode.PUBLISHED;
  const { revision } = listing;

  return (
    <>
      {listing.status === ListingStatus.PENDING_REVIEW && (
        <Alert>
          <InfoIcon />
          <AlertDescription>
            {viewerIsReviewer ? tReview('pendingNotice') : t('pendingNotice')}
          </AlertDescription>
        </Alert>
      )}
      {editingPublished && (
        <Alert>
          <InfoIcon />
          <AlertDescription>{t('published.notice')}</AlertDescription>
        </Alert>
      )}
      {editingPublished && revision?.status === ReviewStatus.PENDING && (
        <Alert>
          <InfoIcon />
          <AlertDescription>{t('published.revisionPending')}</AlertDescription>
        </Alert>
      )}
      {!viewerIsReviewer && revision?.status === ReviewStatus.REJECTED && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>{t('rejectionReason')}</AlertTitle>
          <AlertDescription>
            <p>{t('published.revisionRejected')}</p>
            {revision.rejectionReason && <QuotedText text={revision.rejectionReason} />}
          </AlertDescription>
        </Alert>
      )}
      {showReason && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>{t('rejectionReason')}</AlertTitle>
          <AlertDescription>
            {listing.status === ListingStatus.REJECTED && !viewerIsReviewer && (
              <p>{t('rejectedNotice')}</p>
            )}
            {listing.rejectionReason && <QuotedText text={listing.rejectionReason} />}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
