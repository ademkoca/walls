import { Role } from '@walls/shared';
import {
  listingSearchQuerySchema,
  publicPageQuerySchema,
  slugParamSchema,
} from '@walls/validation';
import { Router } from 'express';
import type { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import type { PublicListingsService } from './public-listings.service';
import type { PublicService } from './public.service';

/** Public, unauthenticated reads for the website (SPEC §16). */
export function publicRoutes({
  profiles,
  listings,
  rates,
}: {
  profiles: PublicService;
  listings: PublicListingsService;
  rates: ExchangeRatesService;
}): Router {
  const router = Router();

  router.get('/home', async (_req, res) => {
    res.json(await listings.home());
  });

  router.get('/listings', async (req, res) => {
    res.json(await listings.search(listingSearchQuerySchema.parse(req.query)));
  });

  router.get('/listings/:slug', async (req, res) => {
    res.json(await listings.listing(slugParamSchema.parse(req.params.slug)));
  });

  /** The current EUR → RSD rate, or null before the first refresh. */
  router.get('/exchange-rate', async (_req, res) => {
    res.json(await rates.current());
  });

  router.get('/sitemap', async (_req, res) => {
    res.json(await listings.sitemap());
  });

  router.get('/agents', async (req, res) => {
    const { page } = publicPageQuerySchema.parse(req.query);
    res.json(await profiles.agents(page));
  });

  router.get('/agents/:slug', async (req, res) => {
    res.json(
      await profiles.profile(Role.REAL_ESTATE_AGENT, slugParamSchema.parse(req.params.slug)),
    );
  });

  router.get('/sellers/:slug', async (req, res) => {
    res.json(await profiles.profile(Role.PRIVATE_SELLER, slugParamSchema.parse(req.params.slug)));
  });

  return router;
}
