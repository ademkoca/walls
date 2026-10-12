'use client';

import {
  ApiErrorCode,
  ListingAction,
  ListingEditMode,
  type ListingDetail,
  type ListingImage,
  ListingStatus,
  checkSubmissionRequirements,
} from '@walls/shared';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@walls/ui/components/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@walls/ui/components/alert';
import { Button } from '@walls/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@walls/ui/components/card';
import { Spinner } from '@walls/ui/components/spinner';
import { ArrowLeftIcon, CircleAlertIcon, InfoIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useState } from 'react';
import { FormProvider, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/errors';
import { listingsApi } from '@/lib/api/listings';
import { useErrorMessage } from '@/lib/use-error-message';
import { ListingStatusBadge } from '../listing-status-badge';
import { ListingImages } from './listing-images';
import {
  AmenitiesSection,
  BasicsSection,
  DetailsSection,
  LocationSection,
  PriceSection,
  TextsSection,
} from './listing-form-sections';
import { formSubmissionSnapshot, toFormValues, toListingInput } from './listing-form-model';
import { SubmissionChecklist } from './submission-checklist';
import { useListingForm } from './use-listing-form';

type Busy = 'save' | 'submit' | 'revise' | 'delete' | null;

/** The dashboard listing editor: draft form, images, checklist and lifecycle actions. */
export function ListingEditor({ initialListing }: { initialListing: ListingDetail }) {
  const t = useTranslations('listings');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [listing, setListing] = useState(initialListing);
  const [images, setImages] = useState<ListingImage[]>(initialListing.images);
  const [busy, setBusy] = useState<Busy>(null);
  const [confirm, setConfirm] = useState<'submit' | 'delete' | null>(null);

  const form = useListingForm(toFormValues(initialListing));
  const { isDirty } = form.formState;
  const values = useWatch({ control: form.control });
  const editable = listing.permissions.editMode === ListingEditMode.DRAFT;
  const canSubmit = listing.permissions.actions.includes(ListingAction.SUBMIT);
  const canRevise = listing.permissions.actions.includes(ListingAction.REVISE);
  // `values` (useWatch) re-renders on every change, so the checklist stays current.
  const issues = checkSubmissionRequirements(
    formSubmissionSnapshot(form.getValues(), images.length),
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
    form.reset(toFormValues(next));
  }

  /** Validates and saves the form. Returns false when validation or the request failed. */
  async function save(): Promise<boolean> {
    let saved = false;
    await form.handleSubmit(async (formValues) => {
      try {
        applyListing(await listingsApi.update(listing.id, toListingInput(formValues)));
        saved = true;
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
      if (await save()) toast.success(t('editor.saved'));
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
            {isDirty && editable && (
              <p className="text-sm text-muted-foreground" role="status">
                {t('editor.unsaved')}
              </p>
            )}
          </div>
        </div>

        <StatusNotice listing={listing} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void onSave();
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
              <Section title={t('editor.sections.description')}>
                <TextsSection />
              </Section>
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
                onImagesChange={setImages}
                editable={editable}
              />
            </Section>
          </form>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            {(editable || canSubmit || canRevise || listing.permissions.canDelete) && (
              <Card>
                <CardContent className="flex flex-col gap-2">
                  {editable && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy !== null || !isDirty}
                      onClick={() => void onSave()}
                    >
                      {busy === 'save' && <Spinner data-icon="inline-start" />}
                      {t('editor.save')}
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
        title={t('editor.submitConfirmTitle')}
        description={t('editor.submitConfirmDescription')}
        confirmLabel={t('editor.submit')}
        cancelLabel={t('editor.cancel')}
        onConfirm={() => void onSubmit()}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title={t('editor.deleteConfirmTitle')}
        description={t('editor.deleteConfirmDescription')}
        confirmLabel={t('editor.delete')}
        cancelLabel={t('editor.cancel')}
        destructive
        onConfirm={() => void onDelete()}
        onCancel={() => setConfirm(null)}
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

function StatusNotice({ listing }: { listing: ListingDetail }) {
  const t = useTranslations('listings.editor');
  const showReason =
    listing.rejectionReason &&
    (listing.status === ListingStatus.REJECTED || listing.status === ListingStatus.DRAFT);

  return (
    <>
      {listing.status === ListingStatus.PENDING_REVIEW && (
        <Alert>
          <InfoIcon />
          <AlertDescription>{t('pendingNotice')}</AlertDescription>
        </Alert>
      )}
      {listing.status === ListingStatus.PUBLISHED && (
        <Alert>
          <InfoIcon />
          <AlertDescription>{t('publishedNotice')}</AlertDescription>
        </Alert>
      )}
      {showReason && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>{t('rejectionReason')}</AlertTitle>
          <AlertDescription>
            {listing.status === ListingStatus.REJECTED && <p>{t('rejectedNotice')}</p>}
            <p className="whitespace-pre-line">{listing.rejectionReason}</p>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
