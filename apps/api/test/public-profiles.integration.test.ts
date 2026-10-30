import { users } from '@walls/database';
import {
  type Page,
  type PublicPartnerSummary,
  type PublicProfilePage,
  Role,
  SellerType,
} from '@walls/shared';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createTestContext } from './helpers';
import { LISTINGS, submittedListing } from './listing-fixtures';

const ctx = createTestContext();
afterAll(ctx.close);

const pageOf = (response: { body: unknown }) => response.body as PublicProfilePage;

async function setProfile(userId: string, values: Partial<typeof users.$inferInsert>) {
  await ctx.db.update(users).set(values).where(eq(users.id, userId));
}

/**
 * A professional's entry in the public directory (optionally filtered by kind), searching
 * every page (other tests add professionals).
 */
async function directoryEntry(
  slug: string,
  type?: SellerType,
): Promise<PublicPartnerSummary | undefined> {
  for (let page = 1; ; page += 1) {
    const query = new URLSearchParams({ page: String(page), ...(type ? { type } : {}) });
    const response = await ctx.client().get(`/api/v1/public/partners?${query.toString()}`);
    expect(response.status).toBe(200);
    const directory = response.body as Page<PublicPartnerSummary>;
    const entry = directory.items.find((item) => item.slug === slug);
    if (entry || !directory.hasMore) return entry;
  }
}

async function publishedListing(owner: Awaited<ReturnType<typeof ctx.signedInUser>>) {
  const id = await submittedListing(owner.client);
  const admin = await ctx.signedInUser(Role.ADMIN);
  expect((await admin.client.post(`${LISTINGS}/${id}/approve`)).status).toBe(200);
  return { id, admin };
}

describe('public seller profiles (SPEC §19)', () => {
  it('shows only the contact details the seller made public, with the phone status', async () => {
    const seller = await ctx.signedInUser();
    await setProfile(seller.user.id, { phone: '+381 64 123 4567', bio: 'Zdravo!' });

    const hidden = pageOf(await ctx.client().get(`/api/v1/public/sellers/${seller.user.slug}`));
    expect(hidden.profile).toMatchObject({
      sellerType: 'PRIVATE_SELLER',
      phone: null,
      email: null,
    });
    expect(hidden.profile).not.toHaveProperty('status');
    expect(JSON.stringify(hidden)).not.toContain(seller.user.email);

    await setProfile(seller.user.id, { isPhonePublic: true, isEmailPublic: true });
    const shown = pageOf(await ctx.client().get(`/api/v1/public/sellers/${seller.user.slug}`));
    expect(shown.profile).toMatchObject({
      bio: 'Zdravo!',
      email: seller.user.email,
      phone: { phone: '+381 64 123 4567', verificationStatus: 'UNVERIFIED' },
    });
  });

  it('offers the profile picture for link previews, or nothing without one', async () => {
    const seller = await ctx.signedInUser();
    const path = `/api/v1/public/sellers/${seller.user.slug}`;
    expect(pageOf(await ctx.client().get(path)).linkPreviewImage).toBeNull();

    const avatarUrl = 'https://media.test/avatars/preview';
    await setProfile(seller.user.id, { avatarStorageKey: 'avatars/preview', avatarUrl });
    expect(pageOf(await ctx.client().get(path)).linkPreviewImage).toEqual({
      url: avatarUrl,
      width: null,
      height: null,
    });
  });

  it('lists the seller’s published listings only', async () => {
    const seller = await ctx.signedInUser();
    const { id } = await publishedListing(seller);
    await submittedListing(seller.client); // still in review: not public

    const page = pageOf(await ctx.client().get(`/api/v1/public/sellers/${seller.user.slug}`));
    expect(page.listings.map((listing) => listing.id)).toEqual([id]);
    expect(page.listings[0]).toMatchObject({
      title: { sr: 'Trosoban stan na Vračaru', en: null },
      propertyType: 'APARTMENT',
      transactionType: 'SALE',
    });
    expect(page.listings[0]?.coverImageUrl).toMatch(/^https:\/\/media\.test\//);
  });

  it('is not found for deactivated users, admins, or the wrong profile type', async () => {
    const seller = await ctx.signedInUser();
    const admin = await ctx.signedInUser(Role.ADMIN);
    expect((await ctx.client().get(`/api/v1/public/partners/${seller.user.slug}`)).status).toBe(
      404,
    );
    expect((await ctx.client().get(`/api/v1/public/sellers/${admin.user.slug}`)).status).toBe(404);

    await admin.client.post(`/api/v1/users/${seller.user.id}/deactivate`, { reason: 'Prevara.' });
    expect((await ctx.client().get(`/api/v1/public/sellers/${seller.user.slug}`)).status).toBe(404);
  });
});

describe('public professional profiles (SPEC §19)', () => {
  it('always shows the agent phone with its status, and names the kind of advertiser', async () => {
    const agent = await ctx.signedInUser(Role.REAL_ESTATE_AGENT);
    await setProfile(agent.user.id, {
      phone: '+381 11 222 3333',
      agencyName: 'Kvadrat',
      isPhonePublic: false,
    });
    const page = pageOf(await ctx.client().get(`/api/v1/public/partners/${agent.user.slug}`));
    expect(page.profile).not.toHaveProperty('approvedAgent');
    expect(page.profile).toMatchObject({
      sellerType: 'REAL_ESTATE_AGENT',
      agencyName: 'Kvadrat',
      phone: { phone: '+381 11 222 3333', verificationStatus: 'UNVERIFIED' },
      email: null,
    });
  });

  it('lists only the listings the agent created', async () => {
    const agent = await ctx.signedInUser(Role.REAL_ESTATE_AGENT);
    const own = await publishedListing(agent);
    await publishedListing(await ctx.signedInUser());

    const page = pageOf(await ctx.client().get(`/api/v1/public/partners/${agent.user.slug}`));
    expect(page.listings.map((listing) => listing.id)).toEqual([own.id]);
    expect((await directoryEntry(agent.user.slug))?.listingCount).toBe(1);
  });

  it('shows agencies and investors with their kind, without an agency name', async () => {
    for (const sellerType of [SellerType.AGENCY, SellerType.INVESTOR]) {
      const partner = await ctx.signedInUser(Role.REAL_ESTATE_AGENT, sellerType);
      await setProfile(partner.user.id, { phone: '+381 20 123 456', agencyName: 'Stari naziv' });
      const page = pageOf(await ctx.client().get(`/api/v1/public/partners/${partner.user.slug}`));
      expect(page.profile).toMatchObject({
        sellerType,
        agencyName: null,
        phone: { phone: '+381 20 123 456', verificationStatus: 'UNVERIFIED' },
      });
    }
  });
});

describe('public partner directory (SPEC §16)', () => {
  it('lists agents, agencies and investors, each kind on its own tab', async () => {
    const agent = await ctx.signedInUser(Role.REAL_ESTATE_AGENT);
    const agency = await ctx.signedInUser(Role.REAL_ESTATE_AGENT, SellerType.AGENCY);
    const investor = await ctx.signedInUser(Role.REAL_ESTATE_AGENT, SellerType.INVESTOR);

    expect(await directoryEntry(agent.user.slug)).toMatchObject({
      sellerType: 'REAL_ESTATE_AGENT',
    });
    expect(await directoryEntry(agency.user.slug)).toMatchObject({ sellerType: 'AGENCY' });
    expect(await directoryEntry(investor.user.slug)).toMatchObject({ sellerType: 'INVESTOR' });

    expect(await directoryEntry(agency.user.slug, SellerType.AGENCY)).toBeDefined();
    expect(await directoryEntry(agent.user.slug, SellerType.AGENCY)).toBeUndefined();
    expect(await directoryEntry(investor.user.slug, SellerType.AGENCY)).toBeUndefined();
    expect(await directoryEntry(investor.user.slug, SellerType.INVESTOR)).toBeDefined();
  });

  it('never lists private sellers and refuses an unknown kind', async () => {
    const seller = await ctx.signedInUser();
    expect(await directoryEntry(seller.user.slug)).toBeUndefined();
    for (const type of ['PRIVATE_SELLER', 'ADMIN']) {
      const response = await ctx.client().get(`/api/v1/public/partners?type=${type}`);
      expect(response.status).toBe(400);
    }
  });
});
