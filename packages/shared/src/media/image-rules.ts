const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * BYTES_PER_KB;

/** Listing image limits (SPEC §15). */
export const LISTING_IMAGE_RULES = {
  /** Checked against the detected file signature, never the client-supplied type or extension. */
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  minBytes: 50 * BYTES_PER_KB,
  maxBytes: 15 * BYTES_PER_MB,
  /** Orientation-agnostic: portrait and landscape images both qualify. */
  minLongSidePx: 1024,
  minShortSidePx: 768,
  maxImagesPerListing: 30,
  minImagesForSubmission: 3,
} as const;

export type ListingImageMimeType = (typeof LISTING_IMAGE_RULES.allowedMimeTypes)[number];

export const ImageIssue = {
  UNSUPPORTED_TYPE: 'UNSUPPORTED_TYPE',
  FILE_TOO_SMALL: 'FILE_TOO_SMALL',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  DIMENSIONS_TOO_SMALL: 'DIMENSIONS_TOO_SMALL',
} as const;
export type ImageIssue = (typeof ImageIssue)[keyof typeof ImageIssue];

/** Properties measured server-side from the uploaded file content. */
export interface MeasuredImage {
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
}

export function isAllowedImageMimeType(mimeType: string): mimeType is ListingImageMimeType {
  return (LISTING_IMAGE_RULES.allowedMimeTypes as readonly string[]).includes(mimeType);
}

export function checkListingImage(image: MeasuredImage): ImageIssue[] {
  const rules = LISTING_IMAGE_RULES;
  const issues: ImageIssue[] = [];

  if (!isAllowedImageMimeType(image.mimeType)) issues.push(ImageIssue.UNSUPPORTED_TYPE);
  if (image.bytes < rules.minBytes) issues.push(ImageIssue.FILE_TOO_SMALL);
  if (image.bytes > rules.maxBytes) issues.push(ImageIssue.FILE_TOO_LARGE);

  const longSide = Math.max(image.width, image.height);
  const shortSide = Math.min(image.width, image.height);
  if (longSide < rules.minLongSidePx || shortSide < rules.minShortSidePx) {
    issues.push(ImageIssue.DIMENSIONS_TOO_SMALL);
  }
  return issues;
}

/** Whether another image may be added to a listing that already has `currentCount` images. */
export function canAddListingImage(currentCount: number): boolean {
  return currentCount < LISTING_IMAGE_RULES.maxImagesPerListing;
}
