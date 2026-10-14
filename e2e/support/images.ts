import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const FIXTURE_DIR = path.resolve(import.meta.dirname, '../.output/fixtures');

/**
 * Writes `count` distinct JPEG photos that meet the listing image rules (≥ 1024 × 768,
 * ≥ 50 KB) and returns their paths. Every call writes new files: tests run in parallel, and
 * a shared file name let one test upload a photo while another was still writing it.
 */
export async function listingPhotos(count: number): Promise<string[]> {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const batch = randomUUID().slice(0, 8);
  const hues = ['#c96a3b', '#3b7ac9', '#4f9a5a', '#9a4f8c', '#c9b03b'];
  return Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const file = path.join(FIXTURE_DIR, `photo-${batch}-${index + 1}.jpg`);
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

/**
 * A photo straight from a modern phone or camera: about 12 MB, far above what the hosting
 * platform lets through in one request (see MAX_UPLOAD_BYTES in the web app).
 */
export async function largePhoto(): Promise<{ path: string; bytes: number }> {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const file = path.join(FIXTURE_DIR, `large-${randomUUID().slice(0, 8)}.jpg`);
  const info = await sharp({
    create: {
      width: 4000,
      height: 3000,
      channels: 3,
      background: '#4f9a5a',
      noise: { type: 'gaussian', mean: 128, sigma: 60 },
    },
  })
    .jpeg({ quality: 95 })
    .toFile(file);
  return { path: file, bytes: info.size };
}
