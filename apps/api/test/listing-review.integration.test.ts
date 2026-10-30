import {
  auditLogs,
  listingMedia,
  listingStatusHistory,
  listings,
  properties,
} from '@walls/database';
import { type ListingSummary, Role } from '@walls/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createTestContext } from './helpers';
import { LISTINGS, detailOf, submittedListing } from './listing-fixtures';

const ctx = createTestContext();
afterAll(ctx.close);

const summariesOf = (response: { body: unknown }) =>
  (response.body as { listings: ListingSummary[] }).listings;

async function auditActions(id: string) {
  const rows = await ctx.db.select().from(auditLogs).where(eq(auditLogs.entityId, id));
  return rows.map((row) => row.action);
}

describe('the review queue (SPEC §2.1)', () => {
  it('shows reviewers every listing, filterable by status', async () => {
    const seller = await ctx.signedInUser();
    const admin = await ctx.signedInUser(Role.ADMIN);
    const id = await submittedListing(seller.client);

    const pending = summariesOf(await admin.client.get(`${LISTINGS}?status=PENDING_REVIEW`));
    expect(pending.map((listing) => listing.id)).toContain(id);
    expect(pending.every((listing) => listing.status === 'PENDING_REVIEW')).toBe(true);
    expect(pending.find((listing) => listing.id === id)?.creator.displayName).toBe(
      seller.user.displayName,
    );

    const listing = detailOf(await admin.client.get(`${LISTINGS}/${id}`));
    expect(listing.permissions).toMatchObject({
      editMode: null,
      actions: ['APPROVE', 'REJECT'],
      canSetFeatured: false,
      canPermanentlyDelete: false,
    });
  });

  it('rejects an unknown status filter', async () => {
    const admin = await ctx.signedInUser(Role.ADMIN);
    expect((await admin.client.get(`${LISTINGS}?status=LIVE`)).status).toBe(400);
  });

  it('does not let admins edit listing content', async () => {
    const seller = await ctx.signedInUser();
    const admin = await ctx.signedInUser(Role.ADMIN);
    const id = await submittedListing(seller.client);
    const response = await admin.client.patch(`${LISTINGS}/${id}`, { transactionType: 'RENT' });
    expect(response.status).toBe(403);
  });
});

describe('approving and rejecting (SPEC §6)', () => {
  it('publishes the listing with a permanent slug, approves its images and emails the creator', async () => {
    const seller = await ctx.signedInUser();
    const admin = await ctx.signedInUser(Role.ADMIN);
    const id = await submittedListing(seller.client);

    const response = await admin.client.post(`${LISTINGS}/${id}/approve`);
    expect(response.status).toBe(200);
    const listing = detailOf(response);
    expect(listing.status).toBe('PUBLISHED');
    expect(listing.slug).toMatch(/^trosoban-stan-na-vracaru-beograd(-\d+)?$/);
    expect(listing.publishedAt).not.toBeNull();

    const media = await ctx.db.select().from(listingMedia).where(eq(listingMedia.listingId, id));
    expect(media.every((item) => item.approvedAt !== null)).toBe(true);

    const email = await ctx.lastEmailTo(seller.user.email);
    expect(email?.subject).toContain('Oglas je objavljen');
    expect(await auditActions(id)).toContain('LISTING_APPROVED');
  });

  it('gives listings with the same title different slugs', async () => {
    const seller = await ctx.signedInUser();
    const admin = await ctx.signedInUser(Role.ADMIN);
    const texts = [{ locale: 'sr', title: 'Isti naslov za dva oglasa', description: 'Opis.' }];
    const first = await submittedListing(seller.client, { texts });
    const second = await submittedListing(seller.client, { texts });

    const a = detailOf(await admin.client.post(`${LISTINGS}/${first}/approve`));
    const b = detailOf(await admin.client.post(`${LISTINGS}/${second}/approve`));
    expect(a.slug).not.toBe(b.slug);
    expect(b.slug).toMatch(/^isti-naslov-za-dva-oglasa-beograd-\d+$/);
  });

  it('requires a reason to reject, and sends it to the creator', async () => {
    const seller = await ctx.signedInUser();
    const admin = await ctx.signedInUser(Role.ADMIN);
    const id = await submittedListing(seller.client);

    expect((await admin.client.post(`${LISTINGS}/${id}/reject`, { reason: ' ' })).status).toBe(400);

    const response = await admin.client.post(`${LISTINGS}/${id}/reject`, {
      reason: 'Slike su mutne.',
    });
    expect(detailOf(response)).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Slike su mutne.',
    });
    const email = await ctx.lastEmailTo(seller.user.email);
    expect(email?.text).toContain('Slike su mutne.');

    const history = await ctx.db
      .select()
      .from(listingStatusHistory)
      .where(
        and(eq(listingStatusHistory.listingId, id), eq(listingStatusHistory.toStatus, 'REJECTED')),
      );
    expect(history[0]?.reason).toBe('Slike su mutne.');

    // The creator revises and resubmits; approval then clears the old reason.
    await seller.client.post(`${LISTINGS}/${id}/revise`);
    expect((await seller.client.post(`${LISTINGS}/${id}/submit`)).status).toBe(200);
    const approved = detailOf(await admin.client.post(`${LISTINGS}/${id}/approve`));
    expect(approved).toMatchObject({ status: 'PUBLISHED', rejectionReason: null });
  });

  it('does not let sellers or agents approve or reject', async () => {
    const seller = await ctx.signedInUser();
    const agent = await ctx.signedInUser(Role.REAL_ESTATE_AGENT);
    const id = await submittedListing(seller.client);
    for (const client of [seller.client, agent.client]) {
      expect((await client.post(`${LISTINGS}/${id}/approve`)).status).toBe(403);
      expect((await client.post(`${LISTINGS}/${id}/reject`, { reason: 'x' })).status).toBe(403);
    }
    // The creator may archive, but not while the listing is in review.
    expect((await seller.client.post(`${LISTINGS}/${id}/archive`)).status).toBe(409);
    expect((await agent.client.post(`${LISTINGS}/${id}/archive`)).status).toBe(403);
  });

  it('only approves listings that are in review', async () => {
    const seller = await ctx.signedInUser();
    const admin = await ctx.signedInUser(Role.ADMIN);
    const draft = (await seller.client.post(LISTINGS)).body as { id: string };
    expect((await admin.client.post(`${LISTINGS}/${draft.id}/approve`)).status).toBe(409);
  });
});

describe('after publication (SPEC §6, §22)', () => {
  async function publishedListing(overrides: Record<string, unknown> = {}) {
    const seller = await ctx.signedInUser();
    const admin = await ctx.signedInUser(Role.ADMIN);
    const id = await submittedListing(seller.client, overrides);
    await admin.client.post(`${LISTINGS}/${id}/approve`);
    return { id, seller, admin };
  }

  it('marks a sale listing sold and then archives it', async () => {
    const { id, admin } = await publishedListing();
    expect((await admin.client.post(`${LISTINGS}/${id}/mark-rented`)).status).toBe(409);
    expect(detailOf(await admin.client.post(`${LISTINGS}/${id}/mark-sold`)).status).toBe('SOLD');
    expect(detailOf(await admin.client.post(`${LISTINGS}/${id}/archive`)).status).toBe('ARCHIVED');
    expect(await auditActions(id)).toEqual(
      expect.arrayContaining(['LISTING_MARKED_SOLD', 'LISTING_ARCHIVED']),
    );
  });

  it('marks a rental listing rented', async () => {
    const { id, admin } = await publishedListing({
      transactionType: 'RENT',
      price: { mode: 'FIXED', amount: 650, currency: 'EUR', period: 'MONTH', negotiable: false },
    });
    expect(detailOf(await admin.client.post(`${LISTINGS}/${id}/mark-rented`)).status).toBe(
      'RENTED',
    );
  });

  it('puts a sold listing back on the market and unarchives one, without review', async () => {
    const { id, admin } = await publishedListing();
    await admin.client.post(`${LISTINGS}/${id}/mark-sold`);
    expect(detailOf(await admin.client.post(`${LISTINGS}/${id}/reopen`)).status).toBe('PUBLISHED');
    await admin.client.post(`${LISTINGS}/${id}/archive`);
    expect(detailOf(await admin.client.post(`${LISTINGS}/${id}/unarchive`)).status).toBe(
      'PUBLISHED',
    );
    expect(await auditActions(id)).toEqual(
      expect.arrayContaining(['LISTING_REOPENED', 'LISTING_UNARCHIVED']),
    );
  });

  it('features a published listing until a future date', async () => {
    const { id, admin } = await publishedListing();
    const until = new Date(Date.now() + 7 * 24 * 3_600_000).toISOString();

    const past = await admin.client.put(`${LISTINGS}/${id}/featured`, {
      featured: true,
      featuredUntil: new Date(Date.now() - 1000).toISOString(),
    });
    expect(past.status).toBe(400);

    const featured = detailOf(
      await admin.client.put(`${LISTINGS}/${id}/featured`, {
        featured: true,
        featuredUntil: until,
      }),
    );
    expect(featured).toMatchObject({ isFeatured: true, featuredUntil: until });

    const unfeatured = detailOf(
      await admin.client.put(`${LISTINGS}/${id}/featured`, {
        featured: false,
        featuredUntil: null,
      }),
    );
    expect(unfeatured).toMatchObject({ isFeatured: false, featuredUntil: null });
  });

  it('cannot feature a listing that is not published', async () => {
    const seller = await ctx.signedInUser();
    const admin = await ctx.signedInUser(Role.ADMIN);
    const id = await submittedListing(seller.client);
    const response = await admin.client.put(`${LISTINGS}/${id}/featured`, {
      featured: true,
      featuredUntil: null,
    });
    expect(response.status).toBe(409);
  });
});

describe('the creator manages the end of a listing (SPEC §6, decision 2026-10-30)', () => {
  async function publishedListing() {
    const seller = await ctx.signedInUser();
    const admin = await ctx.signedInUser(Role.ADMIN);
    const id = await submittedListing(seller.client);
    const slug = detailOf(await admin.client.post(`${LISTINGS}/${id}/approve`)).slug!;
    return { id, slug, seller, admin };
  }
  const publicStatus = async (slug: string) =>
    (await ctx.client().get(`/api/v1/public/listings/${slug}`)).status;

  it('marks sold, reopens, archives and unarchives their own listing', async () => {
    const { id, slug, seller } = await publishedListing();
    const status = async (path: string) =>
      detailOf(await seller.client.post(`${LISTINGS}/${id}/${path}`)).status;

    expect(await status('mark-sold')).toBe('SOLD');
    expect(await publicStatus(slug)).toBe(404);
    expect(await status('reopen')).toBe('PUBLISHED');
    expect(await publicStatus(slug)).toBe(200);
    expect(await status('archive')).toBe('ARCHIVED');
    expect(detailOf(await seller.client.get(`${LISTINGS}/${id}`)).permissions.actions).toEqual([
      'UNARCHIVE',
    ]);
    expect(await status('unarchive')).toBe('PUBLISHED');
    expect(await publicStatus(slug)).toBe(200);

    const history = await ctx.db
      .select()
      .from(listingStatusHistory)
      .where(eq(listingStatusHistory.listingId, id));
    expect(history.filter((entry) => entry.actorId === seller.user.id)).toHaveLength(6);
  });

  it('cannot unarchive a listing an Admin archived; the Admin can', async () => {
    const { id, slug, seller, admin } = await publishedListing();
    await admin.client.post(`${LISTINGS}/${id}/archive`);
    const [archived] = await ctx.db.select().from(listings).where(eq(listings.id, id));
    expect(archived?.archivedByReviewer).toBe(true);

    expect(detailOf(await seller.client.get(`${LISTINGS}/${id}`)).permissions.actions).toEqual([]);
    expect((await seller.client.post(`${LISTINGS}/${id}/unarchive`)).status).toBe(403);
    expect(detailOf(await admin.client.post(`${LISTINGS}/${id}/unarchive`)).status).toBe(
      'PUBLISHED',
    );
    expect(await publicStatus(slug)).toBe(200);
    const [restored] = await ctx.db.select().from(listings).where(eq(listings.id, id));
    expect(restored?.archivedByReviewer).toBe(false);
  });

  it('does not let other users change the status', async () => {
    const { id } = await publishedListing();
    for (const other of [
      await ctx.signedInUser(),
      await ctx.signedInUser(Role.REAL_ESTATE_AGENT),
    ]) {
      expect((await other.client.post(`${LISTINGS}/${id}/mark-sold`)).status).toBe(403);
      expect((await other.client.post(`${LISTINGS}/${id}/archive`)).status).toBe(403);
    }
  });
});

describe('listing ownership (SPEC §5)', () => {
  it('keeps a listing with its creator: an admin cannot hand it to an agent', async () => {
    const seller = await ctx.signedInUser();
    const admin = await ctx.signedInUser(Role.ADMIN);
    const agent = await ctx.signedInUser(Role.REAL_ESTATE_AGENT);
    const id = await submittedListing(seller.client);
    const response = await admin.client.put(`${LISTINGS}/${id}/assignment`, {
      agentId: agent.user.id,
    });
    expect(response.status).toBe(404);
    expect((await agent.client.get(`${LISTINGS}/${id}`)).status).toBe(403);
  });
});

describe('permanent deletion (SPEC §24)', () => {
  async function archivedListing() {
    const seller = await ctx.signedInUser();
    const admin = await ctx.signedInUser(Role.ADMIN);
    const id = await submittedListing(seller.client);
    await admin.client.post(`${LISTINGS}/${id}/approve`);
    await admin.client.post(`${LISTINGS}/${id}/archive`);
    return { id, admin };
  }

  it('lets only a Super Admin delete an archived listing, with its files and property', async () => {
    const { id, admin } = await archivedListing();
    const superAdmin = await ctx.signedInUser(Role.SUPER_ADMIN);
    const [row] = await ctx.db.select().from(listings).where(eq(listings.id, id));
    const keys = (
      await ctx.db.select().from(listingMedia).where(eq(listingMedia.listingId, id))
    ).map((media) => media.storageKey);

    expect((await admin.client.delete(`${LISTINGS}/${id}/permanent`)).status).toBe(403);
    expect((await superAdmin.client.delete(`${LISTINGS}/${id}/permanent`)).status).toBe(204);

    expect(await ctx.db.select().from(listings).where(eq(listings.id, id))).toEqual([]);
    expect(
      await ctx.db.select().from(properties).where(eq(properties.id, row!.propertyId)),
    ).toEqual([]);
    await expect.poll(() => keys.some((key) => ctx.media.files.has(key))).toBe(false);
    expect(await auditActions(id)).toContain('LISTING_PERMANENTLY_DELETED');
  });

  it('refuses listings that are not archived', async () => {
    const seller = await ctx.signedInUser();
    const superAdmin = await ctx.signedInUser(Role.SUPER_ADMIN);
    const id = await submittedListing(seller.client);
    expect((await superAdmin.client.delete(`${LISTINGS}/${id}/permanent`)).status).toBe(409);
  });
});
