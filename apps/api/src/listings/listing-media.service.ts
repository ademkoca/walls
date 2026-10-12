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
} from '@walls/shared';
import type { MediaOrderInput } from '@walls/validation';
import { AuditAction, AuditEntity, recordAudit } from '../audit/audit-log';
import { imageLimitReached, invalidImage, notFound, validationFailed } from '../http/errors';
import type { Logger } from '../logger';
import { inspectImage } from '../media/image-inspection';
import type { MediaStorage } from '../media/media-storage';
import { liveContent } from './listing-content';
import { pendingRevision, toListingImage } from './listing-view';
import {
  deleteMedia,
  findImages,
  findListingAggregate,
  insertMedia,
  savePendingRevision,
  updateListing,
  writeImageOrder,
} from './listings.repository';
import type { ListingsService } from './listings.service';
import { lockEditable } from './listings.service';

/**
 * Listing images (SPEC §15). Files are validated from their content, stored through the
 * `MediaStorage` abstraction, and recorded as first-class media rows.
 *
 * On a published listing, adding or removing images is a major edit: added images stay
 * unapproved (not public) and removals are recorded in the pending revision until an Admin
 * approves it. Reordering and changing the cover among approved images apply immediately.
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

  async removeImage(actor: Actor, listingId: string, mediaId: string): Promise<ListingImage[]> {
    let removedKey: string | undefined;
    const result = await this.db.transaction(async (tx) => {
      const { mode } = await lockEditable(tx, actor, listingId);
      const images = await findImages(tx, listingId);
      const image = images.find((candidate) => candidate.id === mediaId);
      if (!image) throw notFound();

      if (mode === ListingEditMode.PUBLISHED && image.approvedAt !== null) {
        await this.proposeRemoval(tx, actor, listingId, mediaId);
      } else {
        // Drafts, and images a pending revision added, are removed right away.
        await deleteMedia(tx, mediaId);
        removedKey = image.storageKey;
        const remaining = images.filter((candidate) => candidate.id !== mediaId);
        const primary = remaining.find((candidate) => candidate.isPrimary) ?? remaining[0];
        if (primary) {
          await writeImageOrder(
            tx,
            listingId,
            remaining.map((candidate) => candidate.id),
            primary.id,
          );
        }
        await this.afterImagesChanged(tx, actor, listingId, mode);
      }
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

  /**
   * Records that the pending revision removes an approved image. The sync then validates
   * the proposed version (which must keep at least the minimum number of images).
   */
  private async proposeRemoval(tx: DbExecutor, actor: Actor, listingId: string, mediaId: string) {
    const aggregate = (await findListingAggregate(tx, listingId))!;
    const pending = pendingRevision(aggregate);
    if (pending?.removedMediaIds.includes(mediaId)) return;
    await savePendingRevision(tx, {
      listingId,
      content: pending?.content ?? liveContent(aggregate),
      removedMediaIds: [...(pending?.removedMediaIds ?? []), mediaId],
      updatedById: actor.id,
    });
    await this.listings.syncPublishedEdit(tx, actor, listingId);
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
