import { ImageIssue, LISTING_IMAGE_RULES } from '@walls/shared';
import { idParamSchema, listingInputSchema, mediaOrderInputSchema } from '@walls/validation';
import { type RequestHandler, Router } from 'express';
import multer from 'multer';
import { authenticated, requireAuth } from '../http/auth-context';
import { invalidImage, validationFailed } from '../http/errors';
import { type RateLimitRule, limitByIp } from '../http/security';
import { parseBody } from '../http/validate';
import type { ListingMediaService } from './listing-media.service';
import type { ListingsService } from './listings.service';

const STATUS_CREATED = 201;
const STATUS_NO_CONTENT = 204;
const UPLOAD_FIELD = 'file';

/**
 * Accepts one image per request, kept in memory (at most 15 MB) and validated from its
 * content by the media service. Oversized files are cut off by multer before buffering.
 */
function singleImageUpload(): RequestHandler {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: LISTING_IMAGE_RULES.maxBytes, files: 1, fields: 0, parts: 1 },
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

export function listingsRoutes(deps: {
  listings: ListingsService;
  media: ListingMediaService;
  uploadRateLimit: RateLimitRule;
}): Router {
  const { listings, media } = deps;
  const router = Router();
  router.use(authenticated);

  const listingId = (params: { id?: string }) => idParamSchema.parse(params.id);

  router.get('/', async (req, res) => {
    res.json({ listings: await listings.listForEditor(requireAuth(req).actor) });
  });

  router.post('/', async (req, res) => {
    res.status(STATUS_CREATED).json(await listings.create(requireAuth(req).actor));
  });

  router.get('/:id', async (req, res) => {
    res.json({ listing: await listings.get(requireAuth(req).actor, listingId(req.params)) });
  });

  router.patch('/:id', async (req, res) => {
    const input = parseBody(listingInputSchema, req);
    res.json({
      listing: await listings.updateDraft(requireAuth(req).actor, listingId(req.params), input),
    });
  });

  router.delete('/:id', async (req, res) => {
    await listings.deleteDraft(requireAuth(req).actor, listingId(req.params));
    res.status(STATUS_NO_CONTENT).end();
  });

  router.post('/:id/submit', async (req, res) => {
    res.json({ listing: await listings.submit(requireAuth(req).actor, listingId(req.params)) });
  });

  router.post('/:id/revise', async (req, res) => {
    res.json({ listing: await listings.revise(requireAuth(req).actor, listingId(req.params)) });
  });

  router.post(
    '/:id/images',
    limitByIp(deps.uploadRateLimit),
    singleImageUpload(),
    async (req, res) => {
      if (!req.file) throw validationFailed([UPLOAD_FIELD], 'An image file is required');
      const images = await media.addImage(
        requireAuth(req).actor,
        listingId(req.params),
        req.file.buffer,
      );
      res.status(STATUS_CREATED).json({ images });
    },
  );

  router.put('/:id/images/order', async (req, res) => {
    const input = parseBody(mediaOrderInputSchema, req);
    res.json({
      images: await media.reorderImages(requireAuth(req).actor, listingId(req.params), input),
    });
  });

  router.delete('/:id/images/:mediaId', async (req, res) => {
    const mediaId = idParamSchema.parse(req.params.mediaId);
    res.json({
      images: await media.removeImage(requireAuth(req).actor, listingId(req.params), mediaId),
    });
  });

  return router;
}
