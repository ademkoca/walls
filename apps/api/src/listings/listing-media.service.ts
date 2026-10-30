import { randomUUID } from 'node:crypto';
import type { Database, DbExecutor } from '@walls/database';
import {
  type Actor,
  ImageIssue,
  ListingEditMode,
  type ListingImage,
  MediaType,
  canAddListingImage,
  checkListingImage,
  checkSubmissionRequirements,
  contentSubmissionSnapshot,
} from '@walls/shared';
import type { MediaOrderInput } from '@walls/validation';
import { AuditAction, AuditEntity, recordAudit } from '../audit/audit-log';
import {
  imageLimitReached,
  invalidImage,
  notFound,
  submissionIncomplete,
  validationFailed,
} from '../http/errors';
import type { Logger } from '../logger';
import { inspectImage } from '../media/image-inspection';
import type { MediaStorage } from '../media/media-storage';
import { liveContent } from './listing-content';
import { toListingImage } from './listing-view';
import {
  deleteMedia,
  findImages,
  findListingAggregate,
  insertMedia,
  updateListing,
  writeImageOrder,
} from './listings.repository';
import type { ListingsService } from './listings.service';
import { lockEditable } from './listings.service';

/**
 * Listing images (SPEC §15). Files are validated from their content, stored through the
 * `MediaStorage` abstraction, and recorded as first-class media rows.
 *
 * On a published listing, added images stay unapproved (not public) until an Admin approves
 * the pending revision. Removing an approved image, reordering and changing the cover among
 * approved images apply immediately (SPEC §6).
 */
export class ListingMediaService {
  constructor(
    private readonly db: Database,
    private readonly storage: MediaStorage,
    private readonly listings: ListingsService,
    private readonly logger: Logger,
  ) {}

  async addImage(actor: Actor, listingId: string, data: Buffer): Promise<ListingImage[]> {
    // Checks access before the (slow) upload, so rejected requests never reach storage.
    await this.db.transaction((tx) => lockEditable(tx, actor, listingId));

    const measured = inspectImage(data);
    const issues = measured ? checkListingImage(measured) : [ImageIssue.UNSUPPORTED_TYPE];
    if (!measured || issues.length > 0) throw invalidImage(issues);

    const stored = await this.storage.put({
      key: `listings/${listingId}/${randomUUID()}`,
      data,
      contentType: measured.mimeType,
    });

    try {
      return await this.db.transaction(async (tx) => {
        const { mode } = await lockEditable(tx, actor, listingId);
        const images = await findImages(tx, listingId);
        if (!canAddListingImage(images.length)) throw imageLimitReached();

        await insertMedia(tx, {
          listingId,
          type: MediaType.IMAGE,
          storageKey: stored.key,
          url: stored.url,
          sortOrder: (images.at(-1)?.sortOrder ?? -1) + 1,
          isPrimary: images.length === 0,
          mimeType: measured.mimeType,
          bytes: measured.bytes,
          width: measured.width,
          height: measured.height,
        });
        await this.afterImagesChanged(tx, actor, listingId, mode);
        return (await findImages(tx, listingId)).map(toListingImage);
      });
    } catch (error) {
      this.deleteStored(stored.key);
      throw error;
    }
  }

  /**
   * Removes an image right away. A published listing keeps the minimum number of approved
   * images, and its cover stays an approved image.
   */
  async removeImage(actor: Actor, listingId: string, mediaId: string): Promise<ListingImage[]> {
    let removedKey: string | undefined;
    const result = await this.db.transaction(async (tx) => {
      const { mode } = await lockEditable(tx, actor, listingId);
      const images = await findImages(tx, listingId);
      const image = images.find((candidate) => candidate.id === mediaId);
      if (!image) throw notFound();
      const remaining = images.filter((candidate) => candidate.id !== mediaId);
      const removesLiveImage = mode === ListingEditMode.PUBLISHED && image.approvedAt !== null;

      if (removesLiveImage) {
        const approvedLeft = remaining.filter((candidate) => candidate.approvedAt !== null);
        const live = liveContent((await findListingAggregate(tx, listingId))!);
        const issues = checkSubmissionRequirements(
          contentSubmissionSnapshot(live, approvedLeft.length),
        );
        if (issues.length > 0) throw submissionIncomplete(issues);
      }

      await deleteMedia(tx, mediaId);
      removedKey = image.storageKey;
      const primary =
        remaining.find((candidate) => candidate.isPrimary) ??
        remaining.find(
          (candidate) => mode === ListingEditMode.DRAFT || candidate.approvedAt !== null,
        );
      if (primary) {
        await writeImageOrder(
          tx,
          listingId,
          remaining.map((candidate) => candidate.id),
          primary.id,
        );
      }
      if (removesLiveImage) {
        await recordAudit(tx, {
          actorId: actor.id,
          action: AuditAction.LISTING_IMAGE_REMOVED,
          entityType: AuditEntity.LISTING,
          entityId: listingId,
          before: { mediaId, url: image.url },
        });
      }
      await this.afterImagesChanged(tx, actor, listingId, mode);
      return (await findImages(tx, listingId)).map(toListingImage);
    });
    if (removedKey) this.deleteStored(removedKey);
    return result;
  }

  /** Reorders the images and sets the cover. The order must list every image exactly once. */
  async reorderImages(
    actor: Actor,
    listingId: string,
    input: MediaOrderInput,
  ): Promise<ListingImage[]> {
    return this.db.transaction(async (tx) => {
      const { mode } = await lockEditable(tx, actor, listingId);
      const images = await findImages(tx, listingId);
      const byId = new Map(images.map((image) => [image.id, image]));
      const matches =
        byId.size === input.mediaIds.length && input.mediaIds.every((id) => byId.has(id));
      if (!matches) throw validationFailed(['mediaIds'], 'The order must list every image once');

      if (mode === ListingEditMode.PUBLISHED) {
        // The public cover must be an approved image (SPEC §6: cover changes among approved images).
        if (byId.get(input.primaryMediaId)?.approvedAt === null) {
          throw validationFailed(['primaryMediaId'], 'Only approved images can be the cover');
        }
      }
      await writeImageOrder(tx, listingId, input.mediaIds, input.primaryMediaId);
      await updateListing(tx, listingId, {});
      if (mode === ListingEditMode.PUBLISHED) {
        await recordAudit(tx, {
          actorId: actor.id,
          action: AuditAction.LISTING_IMAGES_REORDERED,
          entityType: AuditEntity.LISTING,
          entityId: listingId,
          before: { order: images.map((image) => image.id) },
          after: { order: input.mediaIds, primaryMediaId: input.primaryMediaId },
        });
      }
      return (await findImages(tx, listingId)).map(toListingImage);
    });
  }

  private async afterImagesChanged(
    tx: DbExecutor,
    actor: Actor,
    listingId: string,
    mode: ListingEditMode,
  ) {
    if (mode === ListingEditMode.PUBLISHED) {
      await this.listings.syncPublishedEdit(tx, actor, listingId);
    } else {
      await updateListing(tx, listingId, {});
    }
  }

  /** Storage cleanup never fails the request; an orphaned file is only logged. */
  private deleteStored(key: string): void {
    this.storage.delete(key).catch((error: unknown) => {
      this.logger.warn({ err: error, key }, 'Failed to delete stored media');
    });
  }
}
