import { LISTING_IMAGE_RULES, ListingAction } from '@walls/shared';
import {
  idParamSchema,
  listingInputSchema,
  listingListQuerySchema,
  mediaOrderInputSchema,
  rejectListingInputSchema,
  setFeaturedInputSchema,
} from '@walls/validation';
import { Router } from 'express';
import { authenticated, requireAuth } from '../http/auth-context';
import { validationFailed } from '../http/errors';
import { type RateLimitRule, limitByIp } from '../http/security';
import { UPLOAD_FIELD, singleImageUpload } from '../http/uploads';
import { parseBody } from '../http/validate';
import type { ListingMediaService } from './listing-media.service';
import type { ListingReviewService, SimpleReviewerAction } from './listing-review.service';
import type { ListingsService } from './listings.service';

const STATUS_CREATED = 201;
const STATUS_NO_CONTENT = 204;

export function listingsRoutes(deps: {
  listings: ListingsService;
  media: ListingMediaService;
  review: ListingReviewService;
  uploadRateLimit: RateLimitRule;
}): Router {
  const { listings, media, review } = deps;
  const router = Router();
  router.use(authenticated);

  const listingId = (params: { id?: string }) => idParamSchema.parse(params.id);

  router.get('/', async (req, res) => {
    const query = listingListQuerySchema.parse(req.query);
    res.json({ listings: await listings.list(requireAuth(req).actor, query) });
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
      listing: await listings.update(requireAuth(req).actor, listingId(req.params), input),
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
    singleImageUpload(LISTING_IMAGE_RULES.maxBytes),
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

  // Reviewer actions (Admin / Super Admin); the service checks the role and the state.
  router.post('/:id/approve', async (req, res) => {
    res.json({ listing: await review.approve(requireAuth(req).actor, listingId(req.params)) });
  });

  router.post('/:id/reject', async (req, res) => {
    const { reason } = parseBody(rejectListingInputSchema, req);
    res.json({
      listing: await review.reject(requireAuth(req).actor, listingId(req.params), reason),
    });
  });

  const statusRoutes: Record<string, SimpleReviewerAction> = {
    'mark-sold': ListingAction.MARK_SOLD,
    'mark-rented': ListingAction.MARK_RENTED,
    archive: ListingAction.ARCHIVE,
  };
  for (const [path, action] of Object.entries(statusRoutes)) {
    router.post(`/:id/${path}`, async (req, res) => {
      res.json({
        listing: await review.changeStatus(requireAuth(req).actor, listingId(req.params), action),
      });
    });
  }

  router.put('/:id/featured', async (req, res) => {
    const input = parseBody(setFeaturedInputSchema, req);
    res.json({
      listing: await review.setFeatured(requireAuth(req).actor, listingId(req.params), input),
    });
  });

  // Pending major edits of a published listing (SPEC §6).
  router.post('/:id/revision/approve', async (req, res) => {
    res.json({
      listing: await review.approveRevision(requireAuth(req).actor, listingId(req.params)),
    });
  });

  router.post('/:id/revision/reject', async (req, res) => {
    const { reason } = parseBody(rejectListingInputSchema, req);
    res.json({
      listing: await review.rejectRevision(requireAuth(req).actor, listingId(req.params), reason),
    });
  });

  /** Super Admin only, archived listings only; the UI asks for explicit confirmation. */
  router.delete('/:id/permanent', async (req, res) => {
    await review.permanentlyDelete(requireAuth(req).actor, listingId(req.params));
    res.status(STATUS_NO_CONTENT).end();
  });

  return router;
}
