import { idParamSchema } from '@walls/validation';
import { Router } from 'express';
import { authenticated, requireAuth } from '../http/auth-context';
import type { AnalyticsService } from './analytics.service';

export function analyticsRoutes(analytics: AnalyticsService): Router {
  const router = Router();
  router.use(authenticated);

  router.get('/platform', async (req, res) => {
    res.json({ analytics: await analytics.platform(requireAuth(req).actor) });
  });

  router.get('/listings/:id', async (req, res) => {
    const id = idParamSchema.parse(req.params.id);
    res.json({ analytics: await analytics.listing(requireAuth(req).actor, id) });
  });

  return router;
}
