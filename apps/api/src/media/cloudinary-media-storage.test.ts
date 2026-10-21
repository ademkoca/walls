import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assetFolder } from './cloudinary-client';
import { CloudinaryMediaStorage } from './cloudinary-media-storage';
import { CloudinaryPrivateFileStorage } from './cloudinary-private-file-storage';

const credentials = { cloudName: 'demo', apiKey: 'key', apiSecret: 'secret' };

/** Captures the form a storage sends to Cloudinary. */
function captureUpload(): () => FormData {
  let sent: FormData | undefined;
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init: { body: FormData }) => {
      sent = init.body;
      return Promise.resolve(Response.json({ public_id: 'ignored' }));
    }),
  );
  return () => {
    if (!sent) throw new Error('nothing was uploaded');
    return sent;
  };
}

/** What Cloudinary recomputes: SHA-1 over the sorted signed parameters plus the secret. */
function expectedSignature(form: FormData): string {
  const signed = [...form.entries()]
    .filter(([name]) => !['api_key', 'signature', 'file'].includes(name))
    .map(([name, value]) => `${name}=${value as string}`)
    .sort()
    .join('&');
  return createHash('sha1')
    .update(signed + credentials.apiSecret)
    .digest('hex');
}

afterEach(() => vi.unstubAllGlobals());

describe('assetFolder', () => {
  it('is the key without its file name', () => {
    expect(assetFolder('listings/abc/def')).toBe('listings/abc');
    expect(assetFolder('agent-applications/1/2.pdf')).toBe('agent-applications/1');
    expect(assetFolder('plain')).toBe('');
  });
});

describe('Cloudinary uploads (dynamic folders)', () => {
  it('keeps the public ID and puts a listing image in a matching folder, signed', async () => {
    const sent = captureUpload();
    await new CloudinaryMediaStorage(credentials).put({
      key: 'listings/abc/def',
      data: Buffer.from('x'),
      contentType: 'image/jpeg',
    });
    const form = sent();
    expect(form.get('public_id')).toBe('listings/abc/def');
    expect(form.get('asset_folder')).toBe('listings/abc');
    expect(form.get('signature')).toBe(expectedSignature(form));
  });

  it('puts a private document in a matching folder, still authenticated and signed', async () => {
    const sent = captureUpload();
    await new CloudinaryPrivateFileStorage(credentials).put({
      key: 'agent-applications/1/2.pdf',
      data: Buffer.from('x'),
      contentType: 'application/pdf',
    });
    const form = sent();
    expect(form.get('public_id')).toBe('agent-applications/1/2.pdf');
    expect(form.get('asset_folder')).toBe('agent-applications/1');
    expect(form.get('type')).toBe('authenticated');
    expect(form.get('signature')).toBe(expectedSignature(form));
  });
});

describe('Cloudinary link preview images', () => {
  const storage = new CloudinaryMediaStorage(credentials);
  const media = {
    key: 'listings/abc/def',
    url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/listings/abc/def',
  };

  it('crops listing covers to the wide preview shape, as JPEG', () => {
    expect(storage.linkPreviewImage(media, 'wide')).toEqual({
      url: 'https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,w_1200,h_630,f_jpg,q_auto/listings/abc/def',
      width: 1200,
      height: 630,
    });
  });

  it('crops profile pictures to a square', () => {
    expect(storage.linkPreviewImage(media, 'square')).toEqual({
      url: 'https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,w_600,h_600,f_jpg,q_auto/listings/abc/def',
      width: 600,
      height: 600,
    });
  });
});
