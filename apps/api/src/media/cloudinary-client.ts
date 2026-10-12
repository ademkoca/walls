import { createHash } from 'node:crypto';

const API_BASE = 'https://api.cloudinary.com/v1_1';
const MS_PER_SECOND = 1000;

export interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/** `image` for pictures (transformations available), `raw` for documents kept as uploaded. */
export type CloudinaryResourceType = 'image' | 'raw';

const unixSeconds = () => String(Math.floor(Date.now() / MS_PER_SECOND));

/** Signed calls to Cloudinary's REST API, shared by the public and private storages. */
export class CloudinaryClient {
  constructor(readonly credentials: CloudinaryCredentials) {}

  /** Signature over the sorted parameters (Cloudinary "signed requests"). */
  private sign(params: Record<string, string>): string {
    const payload = Object.keys(params)
      .sort()
      .map((name) => `${name}=${params[name]}`)
      .join('&');
    return createHash('sha1')
      .update(payload + this.credentials.apiSecret)
      .digest('hex');
  }

  async post(
    resourceType: CloudinaryResourceType,
    action: 'upload' | 'destroy',
    params: Record<string, string>,
    file?: Blob,
  ): Promise<Response> {
    const signedParams = { ...params, timestamp: unixSeconds() };
    const form = new FormData();
    for (const [name, value] of Object.entries(signedParams)) form.append(name, value);
    form.append('api_key', this.credentials.apiKey);
    form.append('signature', this.sign(signedParams));
    if (file) form.append('file', file);

    const response = await fetch(
      `${API_BASE}/${this.credentials.cloudName}/${resourceType}/${action}`,
      { method: 'POST', body: form },
    );
    if (!response.ok) {
      throw new Error(`Cloudinary ${action} failed with HTTP ${response.status}`);
    }
    return response;
  }

  /** A short-lived signed URL that downloads an `authenticated` file. */
  privateDownloadUrl(
    resourceType: CloudinaryResourceType,
    publicId: string,
    expiresInSeconds: number,
  ): string {
    const params = {
      public_id: publicId,
      type: 'authenticated',
      timestamp: unixSeconds(),
      expires_at: String(Math.floor(Date.now() / MS_PER_SECOND) + expiresInSeconds),
    };
    const query = new URLSearchParams({
      ...params,
      api_key: this.credentials.apiKey,
      signature: this.sign(params),
    });
    return `${API_BASE}/${this.credentials.cloudName}/${resourceType}/download?${query.toString()}`;
  }
}
