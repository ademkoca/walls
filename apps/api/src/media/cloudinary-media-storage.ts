import type { LinkPreviewImage } from '@walls/shared';
import { CloudinaryClient, type CloudinaryCredentials, assetFolder } from './cloudinary-client';
import {
  LINK_PREVIEW_SIZES,
  type LinkPreviewShape,
  type MediaStorage,
  type StoredMedia,
} from './media-storage';

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
    return {
      key: publicId,
      url: this.deliveryUrl(DELIVERY_TRANSFORMATION, publicId),
    };
  }

  /**
   * Cropped to the preview shape around the most important part of the image, as a JPEG:
   * every link preview reader supports it, and the file stays small (some messaging apps
   * skip large preview images).
   */
  linkPreviewImage(media: StoredMedia, shape: LinkPreviewShape): LinkPreviewImage {
    const { width, height } = LINK_PREVIEW_SIZES[shape];
    const transformation = `c_fill,g_auto,w_${width},h_${height},f_jpg,q_auto`;
    return { url: this.deliveryUrl(transformation, media.key), width, height };
  }

  private deliveryUrl(transformation: string, publicId: string): string {
    const { cloudName } = this.client.credentials;
    return `${DELIVERY_BASE}/${cloudName}/image/upload/${transformation}/${publicId}`;
  }

  async delete(key: string): Promise<void> {
    await this.client.post('image', 'destroy', { public_id: key, invalidate: 'true' });
  }
}
