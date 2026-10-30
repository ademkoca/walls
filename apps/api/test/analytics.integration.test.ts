import { listingViewVisitors } from '@walls/database';
import {
  type ListingAnalytics,
  type PlatformAnalytics,
  Role,
  VIEWS_CHART_DAYS,
  analyticsDay,
} from '@walls/shared';
import { eq } from 'drizzle-orm';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ListingViewsService } from '../src/analytics/listing-views';
import { WEB_ORIGIN, createTestContext, testConfig, uniqueEmail } from './helpers';
import { LISTINGS, detailOf, submittedListing } from './listing-fixtures';

const ctx = createTestContext();
afterAll(ctx.close);

type User = Awaited<ReturnType<typeof ctx.signedInUser>>;
let admin: User;
beforeAll(async () => {
  admin = await ctx.signedInUser(Role.ADMIN);
});

const BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1';
const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1';
const DAY_MS = 86_400_000;

async function publishedListing(owner: User) {
  const id = await submittedListing(owner.client);
  const approved = await admin.client.post(`${LISTINGS}/${id}/approve`);
  return { id, slug: detailOf(approved).slug! };
}

/** An anonymous visitor's browser reporting a view. */
const view = (slug: string, userAgent: string) =>
  supertest(ctx.app)
    .post(`/api/v1/public/listings/${slug}/views`)
    .set('Origin', WEB_ORIGIN)
    .set('User-Agent', userAgent);

const analyticsOf = async (user: User, id: string) =>
  (
    (await user.client.get(`/api/v1/analytics/listings/${id}`)).body as {
      analytics: ListingAnalytics;
    }
  ).analytics;

describe('listing views and analytics (SPEC §23)', () => {
  it('counts each visitor once a day, not crawlers, the owner or admins', async () => {
    const seller = await ctx.signedInUser();
    const { id, slug } = await publishedListing(seller);

    expect((await view(slug, BROWSER)).status).toBe(204);
    await view(slug, BROWSER); // a reload
    await view(slug, PHONE);
    await view(slug, 'Mozilla/5.0 (compatible; Googlebot/2.1)');
    await seller.client.post(`/api/v1/public/listings/${slug}/views`);
    await admin.client.post(`/api/v1/public/listings/${slug}/views`);
    await ctx.client().post(`/api/v1/public/listings/${slug}/inquiries`, {
      name: 'Ivan Ivić',
      email: uniqueEmail(),
      phone: '',
      message: 'Zanima me cena parkinga.',
    });

    const analytics = await analyticsOf(seller, id);
    expect(analytics).toMatchObject({ totalViews: 2, inquiryCount: 1 });
    expect(analytics.viewsByDay).toHaveLength(VIEWS_CHART_DAYS);
    expect(analytics.viewsByDay.at(-1)).toEqual({ day: analyticsDay(new Date()), value: 2 });
    expect(analytics.viewsByDay[0]?.value).toBe(0);
  });

  it('counts a returning visitor again the next day and forgets earlier fingerprints', async () => {
    const seller = await ctx.signedInUser();
    const { id, slug } = await publishedListing(seller);
    const views = new ListingViewsService(ctx.db, testConfig.sessionSecret);
    const visitor = { ip: '203.0.113.9', userAgent: BROWSER, actor: null };
    const today = new Date();
    const tomorrow = new Date(today.getTime() + DAY_MS);

    expect(await views.record(slug, visitor, today)).toBe(true);
    expect(await views.record(slug, visitor, today)).toBe(false);
    expect(await views.record(slug, visitor, tomorrow)).toBe(true);
    const fingerprints = await ctx.db
      .select()
      .from(listingViewVisitors)
      .where(eq(listingViewVisitors.listingId, id));
    expect(fingerprints.map((row) => row.day)).toEqual([analyticsDay(tomorrow)]);
    expect((await analyticsOf(seller, id)).totalViews).toBe(2);
  });

  it('shows listing numbers to its creator and admins only', async () => {
    const seller = await ctx.signedInUser();
    const agent = await ctx.signedInUser(Role.REAL_ESTATE_AGENT);
    const { id } = await publishedListing(seller);
    const path = `/api/v1/analytics/listings/${id}`;
    expect((await seller.client.get(path)).status).toBe(200);
    expect((await admin.client.get(path)).status).toBe(200);
    expect((await agent.client.get(path)).status).toBe(403);
    expect((await (await ctx.signedInUser()).client.get(path)).status).toBe(403);
    expect((await ctx.client().get(path)).status).toBe(401);
  });

  it('gives admins platform totals', async () => {
    const platform = async () =>
      (
        (await admin.client.get('/api/v1/analytics/platform')).body as {
          analytics: PlatformAnalytics;
        }
      ).analytics;
    const before = await platform();
    const seller = await ctx.signedInUser();
    const { slug } = await publishedListing(seller);
    await submittedListing(seller.client);
    await view(slug, BROWSER);

    const after = await platform();
    expect(after.listings.total).toBe(before.listings.total + 2);
    expect(after.listings.published).toBe(before.listings.published + 1);
    expect(after.listings.pendingReview).toBe(before.listings.pendingReview + 1);
    expect(after.views.total).toBe(before.views.total + 1);
    expect(after.views.last30Days).toBe(before.views.last30Days + 1);
    expect(after.inquiries.total).toBeGreaterThanOrEqual(0);
    expect((await seller.client.get('/api/v1/analytics/platform')).status).toBe(403);
  });
});
