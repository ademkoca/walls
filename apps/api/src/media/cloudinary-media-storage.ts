import { createHash } from 'node:crypto';
import type { MediaStorage, StoredMedia } from './media-storage';

const API_BASE = 'https://api.cloudinary.com/v1_1';
const DELIVERY_BASE = 'https://res.cloudinary.com';
/** Let Cloudinary pick the best format and quality per browser (SPEC §37). */
const DELIVERY_TRANSFORMATION = 'f_auto,q_auto';
const MS_PER_SECOND = 1000;

export interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

interface UploadResponse {
  public_id: string;
}

/**
 * Cloudinary through its REST API (signed requests). Images are delivered through an
 * automatic format/quality transformation, so HEIC uploads reach browsers as JPEG/WebP/AVIF.
 */
export class CloudinaryMediaStorage implements MediaStorage {
  constructor(private readonly credentials: CloudinaryCredentials) {}

  /** Signature over the sorted parameters (Cloudinary "signed upload"). */
  private sign(params: Record<string, string>): string {
    const payload = Object.keys(params)
      .sort()
      .map((name) => `${name}=${params[name]}`)
      .join('&');
    return createHash('sha1')
      .update(payload + this.credentials.apiSecret)
      .digest('hex');
  }

  private async post(action: string, params: Record<string, string>, file?: Blob) {
    const signedParams = { ...params, timestamp: String(Math.floor(Date.now() / MS_PER_SECOND)) };
    const form = new FormData();
    for (const [name, value] of Object.entries(signedParams)) form.append(name, value);
    form.append('api_key', this.credentials.apiKey);
    form.append('signature', this.sign(signedParams));
    if (file) form.append('file', file);

    const response = await fetch(`${API_BASE}/${this.credentials.cloudName}/image/${action}`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) {
      throw new Error(`Cloudinary ${action} failed with HTTP ${response.status}`);
    }
    return response;
  }

  async put(file: { key: string; data: Buffer; contentType: string }): Promise<StoredMedia> {
    const response = await this.post(
      'upload',
      { public_id: file.key, overwrite: 'false' },
      new Blob([new Uint8Array(file.data)], { type: file.contentType }),
    );
    const { public_id: publicId } = (await response.json()) as UploadResponse;
    return {
      key: publicId,
      url: `${DELIVERY_BASE}/${this.credentials.cloudName}/image/upload/${DELIVERY_TRANSFORMATION}/${publicId}`,
    };
  }

  async delete(key: string): Promise<void> {
    await this.post('destroy', { public_id: key, invalidate: 'true' });
  }
}
