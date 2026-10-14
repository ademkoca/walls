import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BYTES, fitWithin, prepareImageForUpload } from './shrink-image';

const photo = { maxEdgePx: 3000, minShortSidePx: 768 };

describe('fitWithin', () => {
  it('scales the longest side down to the maximum, keeping the proportions', () => {
    expect(fitWithin({ width: 6000, height: 4000 }, photo)).toEqual({ width: 3000, height: 2000 });
    expect(fitWithin({ width: 3024, height: 4032 }, photo)).toEqual({ width: 2250, height: 3000 });
  });

  it('never enlarges', () => {
    expect(fitWithin({ width: 2000, height: 1500 }, photo)).toEqual({ width: 2000, height: 1500 });
  });

  it('keeps the short side at the API minimum, even for a panorama', () => {
    const { width, height } = fitWithin({ width: 9000, height: 800 }, photo);
    expect(height).toBeGreaterThanOrEqual(768);
    expect(width).toBeGreaterThan(height);
  });

  it('leaves images that are already below the minimum alone', () => {
    expect(fitWithin({ width: 1000, height: 500 }, photo)).toEqual({ width: 1000, height: 500 });
  });
});

describe('prepareImageForUpload', () => {
  it('returns a file within the safe size untouched', async () => {
    const file = new File([new Uint8Array(1024)], 'small.jpg', { type: 'image/jpeg' });
    expect(await prepareImageForUpload(file)).toBe(file);
    expect(MAX_UPLOAD_BYTES).toBeLessThan(4.5 * 1024 * 1024);
  });
});
