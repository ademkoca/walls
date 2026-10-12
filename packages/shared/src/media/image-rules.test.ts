import { describe, expect, it } from 'vitest';
import {
  AVATAR_IMAGE_RULES,
  ImageIssue,
  LISTING_IMAGE_RULES,
  canAddListingImage,
  checkAvatarImage,
  checkListingImage,
} from './image-rules';

const KB = 1024;
const MB = 1024 * KB;
const validJpeg = { mimeType: 'image/jpeg', bytes: 2 * MB, width: 1600, height: 1200 };

describe('listing image rules (SPEC §15)', () => {
  it('accepts a typical photo', () => {
    expect(checkListingImage(validJpeg)).toEqual([]);
  });

  it.each(['image/png', 'image/webp', 'image/heic', 'image/heif'])('accepts %s', (mimeType) => {
    expect(checkListingImage({ ...validJpeg, mimeType })).toEqual([]);
  });

  it.each(['application/pdf', 'image/gif', 'image/svg+xml'])('rejects %s', (mimeType) => {
    expect(checkListingImage({ ...validJpeg, mimeType })).toEqual([ImageIssue.UNSUPPORTED_TYPE]);
  });

  it('enforces the 50 KB – 15 MB size range inclusively', () => {
    expect(checkListingImage({ ...validJpeg, bytes: 50 * KB })).toEqual([]);
    expect(checkListingImage({ ...validJpeg, bytes: 15 * MB })).toEqual([]);
    expect(checkListingImage({ ...validJpeg, bytes: 50 * KB - 1 })).toEqual([
      ImageIssue.FILE_TOO_SMALL,
    ]);
    expect(checkListingImage({ ...validJpeg, bytes: 15 * MB + 1 })).toEqual([
      ImageIssue.FILE_TOO_LARGE,
    ]);
  });

  it('accepts 1024×768 in either orientation', () => {
    expect(checkListingImage({ ...validJpeg, width: 1024, height: 768 })).toEqual([]);
    expect(checkListingImage({ ...validJpeg, width: 768, height: 1024 })).toEqual([]);
  });

  it.each([
    [1023, 768],
    [1024, 767],
    [1000, 1000],
  ])('rejects %i×%i', (width, height) => {
    expect(checkListingImage({ ...validJpeg, width, height })).toEqual([
      ImageIssue.DIMENSIONS_TOO_SMALL,
    ]);
  });

  it('caps the number of images per listing', () => {
    expect(canAddListingImage(LISTING_IMAGE_RULES.maxImagesPerListing - 1)).toBe(true);
    expect(canAddListingImage(LISTING_IMAGE_RULES.maxImagesPerListing)).toBe(false);
  });
});

describe('profile pictures', () => {
  const avatar = { mimeType: 'image/jpeg', bytes: 30_000, width: 400, height: 300 };

  it('accepts small files of at least 200 px on each side', () => {
    expect(checkAvatarImage(avatar)).toEqual([]);
  });

  it('rejects tiny, oversized and unsupported images', () => {
    expect(checkAvatarImage({ ...avatar, height: 199 })).toEqual([ImageIssue.DIMENSIONS_TOO_SMALL]);
    expect(checkAvatarImage({ ...avatar, bytes: AVATAR_IMAGE_RULES.maxBytes + 1 })).toEqual([
      ImageIssue.FILE_TOO_LARGE,
    ]);
    expect(checkAvatarImage({ ...avatar, mimeType: 'image/gif' })).toEqual([
      ImageIssue.UNSUPPORTED_TYPE,
    ]);
  });
});
