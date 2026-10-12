import type { Config } from '../config';
import type { Logger } from '../logger';
import { CloudinaryMediaStorage } from './cloudinary-media-storage';
import { LocalDiskMediaStorage } from './local-disk-media-storage';
import type { MediaStorage } from './media-storage';

/**
 * Cloudinary when configured (always in production — enforced by config), otherwise files
 * are stored on the local disk for development.
 */
export function createMediaStorage(config: Config, logger: Logger): MediaStorage {
  if (config.media.cloudinary) return new CloudinaryMediaStorage(config.media.cloudinary);
  logger.warn(
    { directory: config.media.localDirectory },
    'CLOUDINARY_* is not set: uploads are stored on the local disk',
  );
  return new LocalDiskMediaStorage(config.media.localDirectory);
}
