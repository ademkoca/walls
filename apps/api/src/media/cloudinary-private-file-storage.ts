import { CloudinaryClient, type CloudinaryCredentials, assetFolder } from './cloudinary-client';
import type { PrivateFileStorage } from './private-file-storage';

/** Signed download links are used immediately by the API, so they can expire quickly. */
const DOWNLOAD_URL_TTL_SECONDS = 60;

/**
 * Private documents on Cloudinary: stored as `authenticated` raw files, which have no
 * public URL. The API downloads them with a short-lived signed link.
 */
export class CloudinaryPrivateFileStorage implements PrivateFileStorage {
  private readonly client: CloudinaryClient;

  constructor(credentials: CloudinaryCredentials) {
    this.client = new CloudinaryClient(credentials);
  }

  async put(file: { key: string; data: Buffer; contentType: string }): Promise<void> {
    await this.client.post(
      'raw',
      'upload',
      {
        public_id: file.key,
        asset_folder: assetFolder(file.key),
        type: 'authenticated',
        overwrite: 'false',
      },
      new Blob([new Uint8Array(file.data)], { type: file.contentType }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const response = await fetch(
      this.client.privateDownloadUrl('raw', key, DOWNLOAD_URL_TTL_SECONDS),
    );
    if (!response.ok) throw new Error(`Cloudinary download failed with HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    await this.client.post('raw', 'destroy', {
      public_id: key,
      type: 'authenticated',
      invalidate: 'true',
    });
  }
}
