import { Role } from '@walls/shared';
import { publicPageQuerySchema, slugParamSchema } from '@walls/validation';
import { Router } from 'express';
import type { PublicService } from './public.service';

/** Public, unauthenticated reads for the website (SPEC §16). */
export function publicRoutes(service: PublicService): Router {
  const router = Router();

  router.get('/agents', async (req, res) => {
    const { page } = publicPageQuerySchema.parse(req.query);
    res.json(await service.agents(page));
  });

  router.get('/agents/:slug', async (req, res) => {
    res.json(await service.profile(Role.REAL_ESTATE_AGENT, slugParamSchema.parse(req.params.slug)));
  });

  router.get('/sellers/:slug', async (req, res) => {
    res.json(await service.profile(Role.PRIVATE_SELLER, slugParamSchema.parse(req.params.slug)));
  });

  return router;
}
