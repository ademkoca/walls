import { ImageIssue } from '@walls/shared';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { invalidImage, validationFailed } from './errors';

export const UPLOAD_FIELD = 'file';

/**
 * Accepts one image per request, kept in memory (at most `maxBytes`) and validated from
 * its content by the service. Oversized files are cut off by multer before buffering.
 */
export function singleImageUpload(maxBytes: number): RequestHandler {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1, fields: 0, parts: 1 },
  }).single(UPLOAD_FIELD);

  return (req, res, next) => {
    upload(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        next(
          error.code === 'LIMIT_FILE_SIZE'
            ? invalidImage([ImageIssue.FILE_TOO_LARGE])
            : validationFailed([UPLOAD_FIELD], 'Send exactly one file in the "file" field'),
        );
        return;
      }
      next(error);
    });
  };
}
