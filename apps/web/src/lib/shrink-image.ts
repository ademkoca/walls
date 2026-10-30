import { AVATAR_IMAGE_RULES, LISTING_IMAGE_RULES } from '@walls/shared';

const BYTES_PER_MB = 1024 * 1024;

/**
 * Largest listing photo or profile picture sent as is. Bigger ones are reduced first, which
 * keeps uploads quick on mobile connections and stored photos small; the reduced size is
 * still plenty for display.
 */
export const SHRINK_ABOVE_BYTES = 3.5 * BYTES_PER_MB;

/** Profile pictures are shown small. */
export const AVATAR_SHRINK = {
  maxEdgePx: 1600,
  minShortSidePx: AVATAR_IMAGE_RULES.minSidePx,
} as const;

/** Scans of documents stay legible well above this. */
export const PROOF_IMAGE_SHRINK = { maxEdgePx: 2400, minShortSidePx: 600 } as const;

/** Listing photos: plenty for a full-width display on large screens. */
export const LISTING_PHOTO_SHRINK = {
  maxEdgePx: 3000,
  minShortSidePx: LISTING_IMAGE_RULES.minShortSidePx,
} as const;

export interface ShrinkOptions {
  /** The longest side is scaled down to this. */
  maxEdgePx: number;
  /** The shortest side is never scaled below this (the API's minimum). */
  minShortSidePx: number;
}

const JPEG_QUALITIES = [0.88, 0.8, 0.72, 0.64];
const SIZE_REDUCTION_STEP = 0.8;
const MAX_SIZE_REDUCTIONS = 3;

/**
 * The size an image is scaled to: its longest side fits `maxEdgePx`, but the shortest side
 * stays at or above `minShortSidePx` (a wide panorama keeps its height). Never enlarges.
 */
export function fitWithin(
  size: { width: number; height: number },
  { maxEdgePx, minShortSidePx }: ShrinkOptions,
): { width: number; height: number } {
  const longSide = Math.max(size.width, size.height);
  const shortSide = Math.min(size.width, size.height);
  const scale = Math.min(1, Math.max(maxEdgePx / longSide, minShortSidePx / shortSide));
  return { width: Math.ceil(size.width * scale), height: Math.ceil(size.height * scale) };
}

function toJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/** Draws the image on a white background (JPEG has no transparency) at the given size. */
function draw(bitmap: ImageBitmap, size: { width: number; height: number }) {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size.width, size.height);
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  return canvas;
}

/**
 * Makes a large photo small enough to upload: files up to `maxBytes` (by default
 * `SHRINK_ABOVE_BYTES`) are returned untouched; bigger ones are scaled down and re-saved as JPEG (which also drops hidden
 * metadata such as GPS positions). When the browser cannot read the file (for example HEIC
 * outside Safari) the original is returned and the server decides.
 */
export async function prepareImageForUpload(
  file: File,
  options: ShrinkOptions = LISTING_PHOTO_SHRINK,
  maxBytes: number = SHRINK_ABOVE_BYTES,
): Promise<File> {
  if (file.size <= maxBytes) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }

  try {
    let size = fitWithin(bitmap, options);
    let smallest: Blob | null = null;
    for (let reduction = 0; reduction <= MAX_SIZE_REDUCTIONS; reduction += 1) {
      const canvas = draw(bitmap, size);
      if (!canvas) return file;
      for (const quality of JPEG_QUALITIES) {
        const blob = await toJpegBlob(canvas, quality);
        if (!blob) return file;
        if (!smallest || blob.size < smallest.size) smallest = blob;
        if (blob.size <= maxBytes) return asFile(blob, file);
      }
      // Still too big at the lowest quality: scale down further, within the API's minimum.
      size = fitWithin(size, {
        ...options,
        maxEdgePx: Math.floor(Math.max(size.width, size.height) * SIZE_REDUCTION_STEP),
      });
    }
    return smallest && smallest.size < file.size ? asFile(smallest, file) : file;
  } finally {
    bitmap.close();
  }
}

function asFile(blob: Blob, original: File): File {
  const name = original.name.replace(/\.[^./\\]+$/, '') || 'photo';
  return new File([blob], `${name}.jpg`, {
    type: 'image/jpeg',
    lastModified: original.lastModified,
  });
}
