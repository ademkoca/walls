import {
  idParamSchema,
  inquiryListQuerySchema,
  inquiryStatusInputSchema,
  publicPageQuerySchema,
} from '@walls/validation';
import { Router } from 'express';
import { authenticated, requireAuth } from '../http/auth-context';
import { parseBody } from '../http/validate';
import type { InquiriesService } from './inquiries.service';

/** Inquiries in the dashboard (SPEC §20). Visitors send them through `/public`. */
export function inquiriesRoutes(inquiries: InquiriesService): Router {
  const router = Router();
  router.use(authenticated);
  const inquiryId = (params: { id?: string }) => idParamSchema.parse(params.id);

  router.get('/', async (req, res) => {
    res.json(await inquiries.list(requireAuth(req).actor, inquiryListQuerySchema.parse(req.query)));
  });

  router.get('/sent', async (req, res) => {
    const { page } = publicPageQuerySchema.parse(req.query);
    res.json(await inquiries.sent(requireAuth(req).actor, page));
  });

  router.get('/counts', async (req, res) => {
    res.json({ counts: await inquiries.counts(requireAuth(req).actor) });
  });

  router.get('/:id', async (req, res) => {
    res.json({ inquiry: await inquiries.get(requireAuth(req).actor, inquiryId(req.params)) });
  });

  router.put('/:id/status', async (req, res) => {
    const { status } = parseBody(inquiryStatusInputSchema, req);
    res.json({
      inquiry: await inquiries.setStatus(requireAuth(req).actor, inquiryId(req.params), status),
    });
  });

  return router;
}
