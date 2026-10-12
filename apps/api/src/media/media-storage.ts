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
}
