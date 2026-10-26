'use client';

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ApiErrorCode,
  type ImageIssue,
  LISTING_IMAGE_RULES,
  type ListingImage,
} from '@walls/shared';
import { Badge } from '@walls/ui/components/badge';
import { Button } from '@walls/ui/components/button';
import { Spinner } from '@walls/ui/components/spinner';
import { cn } from '@walls/ui/lib/utils';
import { GripVerticalIcon, ImageIcon, StarIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImageViewer } from '@/components/media/image-viewer';
import { ApiError } from '@/lib/api/errors';
import { listingsApi } from '@/lib/api/listings';
import { prepareImageForUpload } from '@/lib/shrink-image';
import { useErrorMessage } from '@/lib/use-error-message';

const ACCEPTED_TYPES = [...LISTING_IMAGE_RULES.allowedMimeTypes, '.heic', '.heif'].join(',');
const DRAG_ACTIVATION_DISTANCE_PX = 6;

/**
 * Listing images. Every change is saved immediately; the API validates each file from its
 * content (type, size, dimensions) and keeps exactly one cover image.
 */
export function ListingImages({
  listingId,
  images,
  onImagesChange,
  editable,
  published = false,
  removedImageIds = [],
}: {
  listingId: string;
  images: ListingImage[];
  onImagesChange: (images: ListingImage[]) => void;
  editable: boolean;
  /** Published listings: new images await approval and only approved ones can be the cover. */
  published?: boolean;
  /** Approved images a pending revision removes. */
  removedImageIds?: readonly string[];
}) {
  const t = useTranslations('listings.editor.images');
  const errorMessage = useErrorMessage();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [failures, setFailures] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE_PX } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function failureReason(error: unknown): string {
    if (error instanceof ApiError && error.code === ApiErrorCode.INVALID_IMAGE) {
      const issues = (error.details as { issues?: ImageIssue[] } | undefined)?.issues ?? [];
      if (issues.length > 0) return issues.map((issue) => t(`issues.${issue}`)).join(', ');
    }
    return errorMessage(error);
  }

  /** Uploads one file at a time, in the chosen order. */
  async function upload(files: File[]) {
    if (!editable || files.length === 0) return;
    setFailures([]);
    const failed: string[] = [];
    let added = 0;
    for (const file of files) {
      setUploading(file.name);
      try {
        onImagesChange(await listingsApi.uploadImage(listingId, await prepareImageForUpload(file)));
        added += 1;
      } catch (error) {
        failed.push(t('failed', { name: file.name, reason: failureReason(error) }));
        if (error instanceof ApiError && error.code === ApiErrorCode.IMAGE_LIMIT_REACHED) break;
      }
    }
    setUploading(null);
    setFailures(failed);
    if (added > 0) toast.success(t('added', { count: added }));
  }

  async function save(next: ListingImage[], primaryId: string) {
    const previous = images;
    const coverChanged = previous.find((image) => image.isPrimary)?.id !== primaryId;
    onImagesChange(next.map((image) => ({ ...image, isPrimary: image.id === primaryId })));
    try {
      onImagesChange(
        await listingsApi.reorderImages(listingId, {
          mediaIds: next.map((image) => image.id),
          primaryMediaId: primaryId,
        }),
      );
      toast.success(t(coverChanged ? 'coverSaved' : 'orderSaved'));
    } catch (error) {
      onImagesChange(previous);
      toast.error(errorMessage(error));
    }
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = images.findIndex((image) => image.id === active.id);
    const to = images.findIndex((image) => image.id === over.id);
    const primary = images.find((image) => image.isPrimary) ?? images[0];
    if (from < 0 || to < 0 || !primary) return;
    void save(arrayMove(images, from, to), primary.id);
  }

  async function remove(image: ListingImage) {
    try {
      onImagesChange(await listingsApi.removeImage(listingId, image.id));
      // An approved image of a published listing goes only once the changes are approved.
      toast.success(t(published && image.approved ? 'removalProposed' : 'removed'));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const full = images.length >= LISTING_IMAGE_RULES.maxImagesPerListing;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('rules', {
          min: LISTING_IMAGE_RULES.minImagesForSubmission,
          max: LISTING_IMAGE_RULES.maxImagesPerListing,
        })}
      </p>
      {editable && (
        <p className="text-sm text-muted-foreground">
          {t(published ? 'savedInstantlyPublished' : 'savedInstantly')}
        </p>
      )}

      {editable && (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            void upload([...event.dataTransfer.files]);
          }}
          className={cn(
            'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm',
            dragOver ? 'border-emphasis bg-accent' : 'border-border',
          )}
        >
          {uploading ? (
            <p className="flex items-center gap-2" aria-live="polite">
              <Spinner />
              {t('uploading', { name: uploading })}
            </p>
          ) : (
            <>
              <UploadIcon className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-muted-foreground">{t('drop')}</p>
              <Button
                type="button"
                variant="outline"
                disabled={full}
                onClick={() => inputRef.current?.click()}
              >
                {t('upload')}
              </Button>
            </>
          )}
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-label={t('upload')}
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = '';
              void upload(files);
            }}
          />
        </div>
      )}

      {failures.length > 0 && (
        <ul role="alert" className="space-y-1 text-sm text-destructive">
          {failures.map((failure) => (
            <li key={failure}>{failure}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>
          {t('count', { count: images.length, max: LISTING_IMAGE_RULES.maxImagesPerListing })}
        </span>
        {editable && images.length > 1 && <span>{t('moveHint')}</span>}
      </div>

      {images.length === 0 ? (
        <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          {t('empty')}
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={images.map((image) => image.id)} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {images.map((image, index) => (
                <SortableImage
                  key={image.id}
                  image={image}
                  position={index + 1}
                  editable={editable}
                  awaitingApproval={published && !image.approved}
                  toBeRemoved={removedImageIds.includes(image.id)}
                  onMakeCover={() => void save(images, image.id)}
                  onRemove={() => void remove(image)}
                  onOpen={() => setViewing(index)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      <ImageViewer
        images={images.map((image, index) => ({
          url: image.url,
          alt: t('imageAlt', { position: index + 1 }),
        }))}
        index={viewing}
        onIndexChange={setViewing}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}

function SortableImage({
  image,
  position,
  editable,
  awaitingApproval,
  toBeRemoved,
  onMakeCover,
  onRemove,
  onOpen,
}: {
  image: ListingImage;
  position: number;
  editable: boolean;
  awaitingApproval: boolean;
  toBeRemoved: boolean;
  onMakeCover: () => void;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const t = useTranslations('listings.editor.images');
  const tViewer = useTranslations('imageViewer');
  const tPublished = useTranslations('listings.editor.published');
  const [broken, setBroken] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
    disabled: !editable,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group relative overflow-hidden rounded-lg border bg-muted',
        isDragging && 'z-10 shadow-lg ring-2 ring-ring',
        toBeRemoved && 'opacity-60',
      )}
    >
      <div className="aspect-[4/3]">
        {broken ? (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageIcon aria-hidden />
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            aria-label={tViewer('open', { position })}
            title={tViewer('open', { position })}
            className="block size-full transition-opacity hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
          >
            {/* Provider URLs (Cloudinary transformations or local files) are already optimized. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt=""
              className="size-full object-cover"
              loading="lazy"
              onError={() => setBroken(true)}
            />
          </button>
        )}
      </div>
      <div className="absolute top-2 left-2 flex flex-wrap gap-1">
        {image.isPrimary && (
          <Badge>
            <StarIcon aria-hidden />
            {t('cover')}
          </Badge>
        )}
        {awaitingApproval && <Badge variant="secondary">{tPublished('pendingApproval')}</Badge>}
        {toBeRemoved && <Badge variant="destructive">{tPublished('toBeRemoved')}</Badge>}
      </div>
      {editable && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-card/90 p-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="cursor-grab touch-none"
            aria-label={t('dragHandle', { position })}
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon />
          </Button>
          <div className="flex gap-1">
            {!image.isPrimary && !awaitingApproval && !toBeRemoved && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('makeCover')}
                title={t('makeCover')}
                onClick={onMakeCover}
              >
                <StarIcon />
              </Button>
            )}
            {!toBeRemoved && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('remove')}
                title={t('remove')}
                onClick={onRemove}
              >
                <Trash2Icon />
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
