import { Role } from '@walls/shared';
import {
  contactInputSchema,
  inquiryInputSchema,
  listingSearchQuerySchema,
  partnerDirectoryQuerySchema,
  publicPageQuerySchema,
  slugParamSchema,
} from '@walls/validation';
import { Router } from 'express';
import type { ListingViewsService } from '../analytics/listing-views';
import type { ContactService } from '../contact/contact.service';
import type { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { getAuth } from '../http/auth-context';
import { type RateLimitRule, limitByIp } from '../http/security';
import { parseBody } from '../http/validate';
import type { InquiriesService } from '../inquiries/inquiries.service';
import type { PublicListingsService } from './public-listings.service';
import type { PublicService } from './public.service';

/** Public, unauthenticated reads for the website (SPEC §16). */
const STATUS_CREATED = 201;
const STATUS_NO_CONTENT = 204;

export function publicRoutes({
  profiles,
  listings,
  rates,
  inquiries,
  contact,
  views,
  inquiryRateLimit,
  contactRateLimit,
  viewRateLimit,
}: {
  profiles: PublicService;
  listings: PublicListingsService;
  rates: ExchangeRatesService;
  inquiries: InquiriesService;
  contact: ContactService;
  views: ListingViewsService;
  inquiryRateLimit: RateLimitRule;
  contactRateLimit: RateLimitRule;
  viewRateLimit: RateLimitRule;
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

  /** A visitor contacts the advertiser (SPEC §20). Bots get the same answer as people. */
  router.post('/listings/:slug/inquiries', limitByIp(inquiryRateLimit), async (req, res) => {
    const slug = slugParamSchema.parse(req.params.slug);
    await inquiries.create(slug, parseBody(inquiryInputSchema, req), getAuth(req)?.actor ?? null);
    res.status(STATUS_CREATED).json({ received: true });
  });

  /** A message to the company from the contact page. Bots get the same answer as people. */
  router.post('/contact', limitByIp(contactRateLimit), async (req, res) => {
    await contact.send(parseBody(contactInputSchema, req));
    res.status(STATUS_CREATED).json({ received: true });
  });

  /** The listing page reports a view from the browser; counting rules are in the service. */
  router.post('/listings/:slug/views', limitByIp(viewRateLimit), async (req, res) => {
    await views.record(slugParamSchema.parse(req.params.slug), {
      ip: req.ip ?? '',
      userAgent: req.get('user-agent') ?? '',
      actor: getAuth(req)?.actor ?? null,
    });
    res.status(STATUS_NO_CONTENT).end();
  });

  /** The current EUR → RSD rate, or null before the first refresh. */
  router.get('/exchange-rate', async (_req, res) => {
    res.json(await rates.current());
  });

  router.get('/sitemap', async (_req, res) => {
    res.json(await listings.sitemap());
  });

  router.get('/partners', async (req, res) => {
    res.json(await profiles.partners(partnerDirectoryQuerySchema.parse(req.query)));
  });

  router.get('/partners/:slug', async (req, res) => {
    const { page } = publicPageQuerySchema.parse(req.query);
    res.json(
      await profiles.profile(Role.REAL_ESTATE_AGENT, slugParamSchema.parse(req.params.slug), page),
    );
  });

  router.get('/sellers/:slug', async (req, res) => {
    const { page } = publicPageQuerySchema.parse(req.query);
    res.json(
      await profiles.profile(Role.PRIVATE_SELLER, slugParamSchema.parse(req.params.slug), page),
    );
  });

  return router;
}
