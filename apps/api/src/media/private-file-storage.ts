/**
 * Stores private documents, such as agent applications' proof files (SPEC §2.1, §19).
 * Files are never publicly addressable: the API reads them back and serves them only to
 * authorized users.
 */
export interface PrivateFileStorage {
  put(file: { key: string; data: Buffer; contentType: string }): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

/** For tests: keeps files in memory. */
export class InMemoryPrivateFileStorage implements PrivateFileStorage {
  readonly files = new Map<string, Buffer>();

  put(file: { key: string; data: Buffer }): Promise<void> {
    this.files.set(file.key, file.data);
    return Promise.resolve();
  }

  get(key: string): Promise<Buffer> {
    const data = this.files.get(key);
    return data ? Promise.resolve(data) : Promise.reject(new Error(`No file ${key}`));
  }

  delete(key: string): Promise<void> {
    this.files.delete(key);
    return Promise.resolve();
  }
}
