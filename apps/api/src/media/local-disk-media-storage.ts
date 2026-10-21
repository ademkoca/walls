import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import express, { type RequestHandler } from 'express';
import type { LinkPreviewImage } from '@walls/shared';
import { type MediaStorage, type StoredMedia, untransformedPreview } from './media-storage';

/** Path under which the API serves locally stored files (reached through the web proxy). */
export const LOCAL_MEDIA_ROUTE = '/api/v1/media';
const CACHE_MAX_AGE = '1y';

/**
 * Development only: stores files on the local disk and serves them from the API. Used when
 * Cloudinary is not configured; never in production, where Cloudinary is required.
 */
export class LocalDiskMediaStorage implements MediaStorage {
  constructor(private readonly directory: string) {}

  private pathFor(key: string): string {
    const filePath = path.resolve(this.directory, key);
    if (!filePath.startsWith(path.resolve(this.directory) + path.sep)) {
      throw new Error('Media key escapes the media directory');
    }
    return filePath;
  }

  async put(file: { key: string; data: Buffer }): Promise<StoredMedia> {
    const filePath = this.pathFor(file.key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, file.data);
    return { key: file.key, url: `${LOCAL_MEDIA_ROUTE}/${file.key}` };
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  linkPreviewImage(media: StoredMedia): LinkPreviewImage {
    return untransformedPreview(media);
  }

  /** Serves stored files. Keys are random, so files can be cached forever. */
  handler(): RequestHandler {
    return express.static(this.directory, {
      immutable: true,
      maxAge: CACHE_MAX_AGE,
      index: false,
      dotfiles: 'deny',
    });
  }
}
