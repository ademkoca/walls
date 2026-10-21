import type { LinkPreviewImage } from '@walls/shared';

/** A stored file. `url` is what browsers load; `key` identifies the file to the provider. */
export interface StoredMedia {
  key: string;
  url: string;
}

/**
 * Stores and deletes media files (SPEC §15). Listing logic depends only on this interface,
 * so the provider (Cloudinary in production) can be replaced.
 */
export interface MediaStorage {
  put(file: { key: string; data: Buffer; contentType: string }): Promise<StoredMedia>;
  delete(key: string): Promise<void>;
  /** A stored image in the shape link previews use, as small and widely supported as possible. */
  linkPreviewImage(media: StoredMedia, shape: LinkPreviewShape): LinkPreviewImage;
}

/**
 * Link preview shapes: wide for listings (the 1.91:1 image social media show), square for
 * profile pictures.
 */
export const LINK_PREVIEW_SIZES = {
  wide: { width: 1200, height: 630 },
  square: { width: 600, height: 600 },
} as const;

export type LinkPreviewShape = keyof typeof LINK_PREVIEW_SIZES;

/** For providers that cannot transform images: the image as stored, size unknown. */
export function untransformedPreview(media: StoredMedia): LinkPreviewImage {
  return { url: media.url, width: null, height: null };
}

/** For tests: keeps files in memory. */
export class InMemoryMediaStorage implements MediaStorage {
  readonly files = new Map<string, { data: Buffer; contentType: string }>();

  put(file: { key: string; data: Buffer; contentType: string }): Promise<StoredMedia> {
    this.files.set(file.key, { data: file.data, contentType: file.contentType });
    return Promise.resolve({ key: file.key, url: `https://media.test/${file.key}` });
  }

  delete(key: string): Promise<void> {
    this.files.delete(key);
    return Promise.resolve();
  }

  linkPreviewImage(media: StoredMedia): LinkPreviewImage {
    return untransformedPreview(media);
  }
}
