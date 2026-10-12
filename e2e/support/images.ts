import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const FIXTURE_DIR = path.resolve(import.meta.dirname, '../.output/fixtures');

/**
 * Writes `count` distinct JPEG photos that meet the listing image rules (≥ 1024 × 768,
 * ≥ 50 KB) and returns their paths.
 */
export async function listingPhotos(count: number): Promise<string[]> {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const hues = ['#c96a3b', '#3b7ac9', '#4f9a5a', '#9a4f8c', '#c9b03b'];
  return Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const file = path.join(FIXTURE_DIR, `photo-${index + 1}.jpg`);
      await sharp({
        create: {
          width: 1600,
          height: 1200,
          channels: 3,
          background: hues[index % hues.length]!,
          noise: { type: 'gaussian', mean: 120, sigma: 30 },
        },
      })
        .jpeg({ quality: 85 })
        .toFile(file);
      return file;
    }),
  );
}
