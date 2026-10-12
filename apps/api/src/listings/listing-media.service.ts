import { randomUUID } from 'node:crypto';
import type { Database } from '@walls/database';
import {
  type Actor,
  ImageIssue,
  type ListingImage,
  MediaType,
  canAddListingImage,
  checkListingImage,
} from '@walls/shared';
import type { MediaOrderInput } from '@walls/validation';
import { imageLimitReached, invalidImage, notFound, validationFailed } from '../http/errors';
import type { Logger } from '../logger';
import { inspectImage } from '../media/image-inspection';
import type { MediaStorage } from '../media/media-storage';
import {
  deleteMedia,
  findImages,
  insertMedia,
  updateListing,
  writeImageOrder,
} from './listings.repository';
import { lockEditableDraft } from './listings.service';

const toListingImage = (image: {
  id: string;
  url: string;
  isPrimary: boolean;
  width: number | null;
  height: number | null;
}): ListingImage => ({
  id: image.id,
  url: image.url,
  isPrimary: image.isPrimary,
  width: image.width,
  height: image.height,
});

/**
 * Listing images (SPEC §15). Files are validated from their content, stored through the
 * `MediaStorage` abstraction, and recorded as first-class media rows.
 */
export class ListingMediaService {
  constructor(
    private readonly db: Database,
    private readonly storage: MediaStorage,
    private readonly logger: Logger,
  ) {}

  /** Checks access before the (slow) upload, so rejected requests never reach storage. */
  private async assertCanEditImages(actor: Actor, listingId: string): Promise<void> {
    await this.db.transaction((tx) => lockEditableDraft(tx, actor, listingId));
  }

  async addImage(actor: Actor, listingId: string, data: Buffer): Promise<ListingImage[]> {
    await this.assertCanEditImages(actor, listingId);

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
        await lockEditableDraft(tx, actor, listingId);
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
        await updateListing(tx, listingId, {});
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
      await lockEditableDraft(tx, actor, listingId);
      const images = await findImages(tx, listingId);
      const image = images.find((candidate) => candidate.id === mediaId);
      if (!image) throw notFound();

      await deleteMedia(tx, mediaId);
      const remaining = images.filter((candidate) => candidate.id !== mediaId);
      // Keep exactly one cover image: promote the first remaining image if needed.
      const primary = remaining.find((candidate) => candidate.isPrimary) ?? remaining[0];
      if (primary) {
        await writeImageOrder(
          tx,
          listingId,
          remaining.map((candidate) => candidate.id),
          primary.id,
        );
      }
      await updateListing(tx, listingId, {});
      removedKey = image.storageKey;
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
      await lockEditableDraft(tx, actor, listingId);
      const current = new Set((await findImages(tx, listingId)).map((image) => image.id));
      const matches =
        current.size === input.mediaIds.length && input.mediaIds.every((id) => current.has(id));
      if (!matches) throw validationFailed(['mediaIds'], 'The order must list every image once');

      await writeImageOrder(tx, listingId, input.mediaIds, input.primaryMediaId);
      await updateListing(tx, listingId, {});
      return (await findImages(tx, listingId)).map(toListingImage);
    });
  }

  /** Storage cleanup never fails the request; an orphaned file is only logged. */
  private deleteStored(key: string): void {
    this.storage.delete(key).catch((error: unknown) => {
      this.logger.warn({ err: error, key }, 'Failed to delete stored media');
    });
  }
}
