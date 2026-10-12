import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { PrivateFileStorage } from './private-file-storage';

/**
 * Development only: private documents on the local disk, in a directory the API never
 * serves directly. Used when Cloudinary is not configured.
 */
export class LocalDiskPrivateFileStorage implements PrivateFileStorage {
  constructor(private readonly directory: string) {}

  private pathFor(key: string): string {
    const filePath = path.resolve(this.directory, key);
    if (!filePath.startsWith(path.resolve(this.directory) + path.sep)) {
      throw new Error('File key escapes the private file directory');
    }
    return filePath;
  }

  async put(file: { key: string; data: Buffer }): Promise<void> {
    const filePath = this.pathFor(file.key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, file.data);
  }

  get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}
