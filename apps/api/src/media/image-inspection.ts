import type { MeasuredImage } from '@walls/shared';
import { imageSize } from 'image-size';

/** Detected format (from the file signature) → MIME type. Other formats are rejected. */
const MIME_TYPE_BY_FORMAT: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

/**
 * Measures an uploaded image from its content, never from the client-supplied name or type
 * (SPEC §15, §37). Returns null when the content is not a supported image.
 */
export function inspectImage(data: Buffer): MeasuredImage | null {
  try {
    const { type, width, height } = imageSize(data);
    const mimeType = type ? MIME_TYPE_BY_FORMAT[type] : undefined;
    if (!mimeType || !width || !height) return null;
    return { mimeType, bytes: data.length, width, height };
  } catch {
    return null;
  }
}
