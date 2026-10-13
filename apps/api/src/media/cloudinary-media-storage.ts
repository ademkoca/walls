import { CloudinaryClient, type CloudinaryCredentials, assetFolder } from './cloudinary-client';
import type { MediaStorage, StoredMedia } from './media-storage';

const DELIVERY_BASE = 'https://res.cloudinary.com';
/** Let Cloudinary pick the best format and quality per browser (SPEC §37). */
const DELIVERY_TRANSFORMATION = 'f_auto,q_auto';

interface UploadResponse {
  public_id: string;
}

/**
 * Cloudinary through its REST API (signed requests). Images are delivered through an
 * automatic format/quality transformation, so HEIC uploads reach browsers as JPEG/WebP/AVIF.
 */
export class CloudinaryMediaStorage implements MediaStorage {
  private readonly client: CloudinaryClient;

  constructor(credentials: CloudinaryCredentials) {
    this.client = new CloudinaryClient(credentials);
  }

  async put(file: { key: string; data: Buffer; contentType: string }): Promise<StoredMedia> {
    const response = await this.client.post(
      'image',
      'upload',
      { public_id: file.key, asset_folder: assetFolder(file.key), overwrite: 'false' },
      new Blob([new Uint8Array(file.data)], { type: file.contentType }),
    );
    const { public_id: publicId } = (await response.json()) as UploadResponse;
    const { cloudName } = this.client.credentials;
    return {
      key: publicId,
      url: `${DELIVERY_BASE}/${cloudName}/image/upload/${DELIVERY_TRANSFORMATION}/${publicId}`,
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.post('image', 'destroy', { public_id: key, invalidate: 'true' });
  }
}
