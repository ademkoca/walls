import {
  auditLogs,
  listingMedia,
  listingStatusHistory,
  listingTexts,
  listings,
} from '@walls/database';
import { type ListingDetail, type ListingSummary, Role } from '@walls/shared';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createTestContext, errorOf, testImage } from './helpers';
import {
  LISTINGS,
  addImages,
  completeApartment,
  createListing,
  detailOf,
  image,
  imagesOf,
} from './listing-fixtures';

const ctx = createTestContext();
afterAll(ctx.close);

describe('creating listings (SPEC §2.1, §5)', () => {
  it('creates an empty draft owned by the private seller, with no assigned agent', async () => {
    const { user, client } = await ctx.signedInUser(Role.PRIVATE_SELLER);
    const id = await createListing(client);

    const listing = detailOf(await client.get(`${LISTINGS}/${id}`));
    expect(listing).toMatchObject({
      status: 'DRAFT',
      sellerType: 'PRIVATE_SELLER',
      price: { mode: 'ON_REQUEST' },
      isExactAddressPublic: false,
      permissions: { editMode: 'DRAFT', canDelete: true, actions: ['SUBMIT'] },
    });
    const [row] = await ctx.db.select().from(listings).where(eq(listings.id, id));
    expect(row).toMatchObject({ createdById: user.id, assignedAgentId: null });

    const [history] = await ctx.db
      .select()
      .from(listingStatusHistory)
      .where(eq(listingStatusHistory.listingId, id));
    expect(history).toMatchObject({ fromStatus: null, toStatus: 'DRAFT', actorId: user.id });
  });

  it('gives an agent-created listing the agent seller type', async () => {
    const { client } = await ctx.signedInUser(Role.REAL_ESTATE_AGENT);
    const id = await createListing(client);
    expect(detailOf(await client.get(`${LISTINGS}/${id}`)).sellerType).toBe('REAL_ESTATE_AGENT');
  });

  it('does not let admins create listings or anonymous visitors use the endpoints', async () => {
    const { client } = await ctx.signedInUser(Role.ADMIN);
    expect((await client.post(LISTINGS)).status).toBe(403);
    expect((await ctx.client().post(LISTINGS)).status).toBe(401);
    expect((await ctx.client().get(LISTINGS)).status).toBe(401);
  });
});

describe('access to listings (SPEC §26)', () => {
  it('lets only the creator see and change their listing', async () => {
    const owner = await ctx.signedInUser();
    const otherSeller = await ctx.signedInUser();
    const agent = await ctx.signedInUser(Role.REAL_ESTATE_AGENT);
    const id = await createListing(owner.client);

    for (const intruder of [otherSeller.client, agent.client]) {
      expect((await intruder.get(`${LISTINGS}/${id}`)).status).toBe(403);
      expect((await intruder.patch(`${LISTINGS}/${id}`, { transactionType: 'RENT' })).status).toBe(
        403,
      );
      expect((await intruder.delete(`${LISTINGS}/${id}`)).status).toBe(403);
      expect((await intruder.post(`${LISTINGS}/${id}/submit`)).status).toBe(403);
      expect((await intruder.upload(`${LISTINGS}/${id}/images`, await image())).status).toBe(403);
      const list = (await intruder.get(LISTINGS)).body as { listings: ListingSummary[] };
      expect(list.listings.map((listing) => listing.id)).not.toContain(id);
    }
  });

  it('lets an assigned agent manage the listing alongside its creator', async () => {
    const owner = await ctx.signedInUser();
    const agent = await ctx.signedInUser(Role.REAL_ESTATE_AGENT);
    const id = await createListing(owner.client);
    await ctx.db
      .update(listings)
      .set({ assignedAgentId: agent.user.id })
      .where(eq(listings.id, id));

    expect((await agent.client.get(`${LISTINGS}/${id}`)).status).toBe(200);
    expect(
      (await agent.client.patch(`${LISTINGS}/${id}`, { transactionType: 'RENT' })).status,
    ).toBe(200);
    expect((await owner.client.get(`${LISTINGS}/${id}`)).status).toBe(200);
  });

  it('rejects ownership, status and assignment fields sent by the client', async () => {
    const { client } = await ctx.signedInUser();
    const other = await ctx.signedInUser();
    const id = await createListing(client);

    for (const field of [
      { createdById: other.user.id },
      { assignedAgentId: other.user.id },
      { sellerType: 'REAL_ESTATE_AGENT' },
      { status: 'PUBLISHED' },
    ]) {
      const response = await client.patch(`${LISTINGS}/${id}`, field);
      expect(response.status).toBe(400);
    }
    expect(detailOf(await client.get(`${LISTINGS}/${id}`)).status).toBe('DRAFT');
  });

  it('answers 400 for malformed ids and 404 for unknown listings', async () => {
    const { client } = await ctx.signedInUser();
    expect((await client.get(`${LISTINGS}/not-a-uuid`)).status).toBe(400);
    expect((await client.get(`${LISTINGS}/00000000-0000-4000-8000-000000000000`)).status).toBe(404);
  });
});

describe('editing drafts', () => {
  it('saves every section and reports what still blocks submission', async () => {
    const { client } = await ctx.signedInUser();
    const id = await createListing(client);

    const response = await client.patch(`${LISTINGS}/${id}`, completeApartment);
    expect(response.status).toBe(200);
    const listing = detailOf(response);
    expect(listing).toMatchObject({
      propertyType: 'APARTMENT',
      transactionType: 'SALE',
      location: { city: 'Beograd', streetNumber: '12a', latitude: 44.8 },
      attributes: { floorArea: 74.5, heatingType: 'DISTRICT', furnishedStatus: 'SEMI_FURNISHED' },
      amenityCodes: ['ELEVATOR', 'BALCONY'],
      price: { mode: 'FIXED', amount: 189000, currency: 'EUR', negotiable: true },
    });
    // An empty English translation is not stored, so English pages fall back to Serbian.
    expect(listing.texts.map((text) => text.locale)).toEqual(['sr']);
    expect(listing.submissionIssues).toEqual([{ code: 'TOO_FEW_IMAGES', field: 'images' }]);

    const [stored] = await ctx.db.select().from(listings).where(eq(listings.id, id));
    expect(stored?.priceAmountMinor).toBe(18_900_000);
  });

  it('clears the amount when switching to price on request', async () => {
    const { client } = await ctx.signedInUser();
    const id = await createListing(client);
    await client.patch(`${LISTINGS}/${id}`, completeApartment);

    const listing = detailOf(
      await client.patch(`${LISTINGS}/${id}`, { price: { mode: 'ON_REQUEST' } }),
    );
    expect(listing.price).toEqual({ mode: 'ON_REQUEST' });
    const [stored] = await ctx.db.select().from(listings).where(eq(listings.id, id));
    expect(stored).toMatchObject({ priceAmountMinor: null, priceCurrency: null });
  });

  it('only allows a rental period on rental listings', async () => {
    const { client } = await ctx.signedInUser();
    const id = await createListing(client);
    await client.patch(`${LISTINGS}/${id}`, {
      transactionType: 'RENT',
      price: { mode: 'FIXED', amount: 600, currency: 'EUR', period: 'MONTH', negotiable: false },
    });

    const response = await client.patch(`${LISTINGS}/${id}`, { transactionType: 'SALE' });
    expect(response.status).toBe(400);
    expect(errorOf(response).code).toBe('VALIDATION_FAILED');
  });

  it('rejects unknown amenities', async () => {
    const { client } = await ctx.signedInUser();
    const id = await createListing(client);
    const response = await client.patch(`${LISTINGS}/${id}`, { amenityCodes: ['SAUNA'] });
    expect(response.status).toBe(400);
  });

  it("lists the editor's listings with their Serbian title and cover image", async () => {
    const { client } = await ctx.signedInUser();
    const id = await createListing(client);
    await client.patch(`${LISTINGS}/${id}`, completeApartment);
    await addImages(client, id, 1);

    const { listings: summaries } = (await client.get(LISTINGS)).body as {
      listings: ListingSummary[];
    };
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      id,
      status: 'DRAFT',
      title: 'Trosoban stan na Vračaru',
      city: 'Beograd',
      imageCount: 1,
    });
    expect(summaries[0]?.coverImageUrl).toMatch(/^https:\/\/media\.test\//);
  });
});

describe('listing images (SPEC §15)', () => {
  it('accepts JPEG, PNG and WebP and makes the first image the cover', async () => {
    const { client } = await ctx.signedInUser();
    const id = await createListing(client);

    let images: ListingDetail['images'] = [];
    for (const format of ['jpeg', 'png', 'webp'] as const) {
      const response = await client.upload(`${LISTINGS}/${id}/images`, await testImage({ format }));
      expect(response.status).toBe(201);
      images = imagesOf(response);
    }
    expect(images.map((item) => item.isPrimary)).toEqual([true, false, false]);
    expect(images[0]).toMatchObject({ width: 1200, height: 900 });
    expect(ctx.media.files.size).toBeGreaterThanOrEqual(3);
  });

  it('checks the file content, not its name', async () => {
    const { client } = await ctx.signedInUser();
    const id = await createListing(client);
    const response = await client.upload(
      `${LISTINGS}/${id}/images`,
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'.repeat(2000)),
      'photo.jpg',
    );
    expect(response.status).toBe(422);
    expect(errorOf(response)).toMatchObject({
      code: 'INVALID_IMAGE',
      details: { issues: ['UNSUPPORTED_TYPE'] },
    });
  });

  it('rejects images below the minimum dimensions or file size', async () => {
    const { client } = await ctx.signedInUser();
    const id = await createListing(client);

    const portraitTooNarrow = await testImage({ width: 700, height: 1100 });
    const tooSmall = await client.upload(`${LISTINGS}/${id}/images`, portraitTooNarrow);
    expect(errorOf(tooSmall).details).toEqual({ issues: ['DIMENSIONS_TOO_SMALL'] });

    const flat = await sharpFlatPng();
    const tooLight = await client.upload(`${LISTINGS}/${id}/images`, flat);
    expect(errorOf(tooLight).details).toEqual({ issues: ['FILE_TOO_SMALL'] });
  });

  it('accepts portrait images that meet the minimum on both sides', async () => {
    const { client } = await ctx.signedInUser();
    const id = await createListing(client);
    const portrait = await testImage({ width: 800, height: 1100 });
    expect((await client.upload(`${LISTINGS}/${id}/images`, portrait)).status).toBe(201);
  });

  it('refuses more than 30 images', async () => {
    const { client } = await ctx.signedInUser();
    const id = await createListing(client);
    await ctx.db.insert(listingMedia).values(
      Array.from({ length: 30 }, (_, index) => ({
        listingId: id,
        type: 'IMAGE' as const,
        storageKey: `seed/${id}/${index}`,
        url: `https://media.test/seed/${index}`,
        sortOrder: index,
        isPrimary: index === 0,
      })),
    );
    const response = await client.upload(`${LISTINGS}/${id}/images`, await image());
    expect(response.status).toBe(409);
    expect(errorOf(response).code).toBe('IMAGE_LIMIT_REACHED');
  });

  it('reorders images and moves the cover', async () => {
    const { client } = await ctx.signedInUser();
    const id = await createListing(client);
    await addImages(client, id, 3);
    const [first, second, third] = detailOf(await client.get(`${LISTINGS}/${id}`)).images;

    const response = await client.put(`${LISTINGS}/${id}/images/order`, {
      mediaIds: [third!.id, first!.id, second!.id],
      primaryMediaId: first!.id,
    });
    expect(response.status).toBe(200);
    expect(imagesOf(response).map((item) => [item.id, item.isPrimary])).toEqual([
      [third!.id, false],
      [first!.id, true],
      [second!.id, false],
    ]);

    const incomplete = await client.put(`${LISTINGS}/${id}/images/order`, {
      mediaIds: [third!.id, first!.id],
      primaryMediaId: first!.id,
    });
    expect(incomplete.status).toBe(400);
  });

  it('promotes the next image when the cover is deleted, and removes the stored file', async () => {
    const { client } = await ctx.signedInUser();
    const id = await createListing(client);
    await addImages(client, id, 2);
    const [cover, next] = detailOf(await client.get(`${LISTINGS}/${id}`)).images;
    const [coverRow] = await ctx.db
      .select()
      .from(listingMedia)
      .where(eq(listingMedia.id, cover!.id));

    const response = await client.delete(`${LISTINGS}/${id}/images/${cover!.id}`);
    expect(response.status).toBe(200);
    expect(imagesOf(response)).toEqual([
      expect.objectContaining({ id: next!.id, isPrimary: true }),
    ]);
    await expect.poll(() => ctx.media.files.has(coverRow!.storageKey)).toBe(false);
  });
});

describe('submitting for review (SPEC §6, §39)', () => {
  it('refuses an incomplete listing and lists what is missing', async () => {
    const { client } = await ctx.signedInUser();
    const id = await createListing(client);
    await client.patch(`${LISTINGS}/${id}`, { propertyType: 'LAND' });

    const response = await client.post(`${LISTINGS}/${id}/submit`);
    expect(response.status).toBe(422);
    const { code, details } = errorOf(response);
    expect(code).toBe('SUBMISSION_INCOMPLETE');
    expect((details as { issues: { field: string }[] }).issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining([
        'transactionType',
        'title',
        'location.city',
        'attributes.plotArea',
        'images',
      ]),
    );
  });

  it('moves a complete draft to review, locks it, and confirms by email', async () => {
    const { user, client } = await ctx.signedInUser();
    const id = await createListing(client);
    await client.patch(`${LISTINGS}/${id}`, completeApartment);
    await addImages(client, id, 3);

    const response = await client.post(`${LISTINGS}/${id}/submit`);
    expect(response.status).toBe(200);
    expect(detailOf(response)).toMatchObject({
      status: 'PENDING_REVIEW',
      permissions: { editMode: null, canDelete: false, actions: [] },
    });

    const email = await ctx.lastEmailTo(user.email);
    expect(email?.subject).toContain('Oglas je poslat na proveru');
    expect(email?.text).toContain(`http://localhost:3000/dashboard/listings/${id}`);

    const audit = await ctx.db.select().from(auditLogs).where(eq(auditLogs.entityId, id));
    expect(audit.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(['LISTING_CREATED', 'LISTING_SUBMITTED']),
    );

    // A listing in review cannot be changed, withdrawn or deleted by its creator (SPEC §24).
    expect((await client.patch(`${LISTINGS}/${id}`, { transactionType: 'RENT' })).status).toBe(409);
    expect((await client.upload(`${LISTINGS}/${id}/images`, await image())).status).toBe(409);
    expect((await client.delete(`${LISTINGS}/${id}`)).status).toBe(409);
    expect((await client.post(`${LISTINGS}/${id}/submit`)).status).toBe(409);
  });

  it('lets the creator revise a rejected listing, keeping the reason', async () => {
    const { client } = await ctx.signedInUser();
    const id = await createListing(client);
    await ctx.db
      .update(listings)
      .set({ status: 'REJECTED', rejectionReason: 'Slike su mutne.' })
      .where(eq(listings.id, id));

    expect(detailOf(await client.get(`${LISTINGS}/${id}`)).permissions.actions).toEqual(['REVISE']);
    const response = await client.post(`${LISTINGS}/${id}/revise`);
    expect(response.status).toBe(200);
    expect(detailOf(response)).toMatchObject({
      status: 'DRAFT',
      rejectionReason: 'Slike su mutne.',
      permissions: { editMode: 'DRAFT' },
    });
  });
});

describe('deleting drafts (SPEC §24)', () => {
  it('soft-deletes the draft and keeps the record', async () => {
    const { client } = await ctx.signedInUser();
    const id = await createListing(client);
    await client.patch(`${LISTINGS}/${id}`, { texts: completeApartment.texts });

    expect((await client.delete(`${LISTINGS}/${id}`)).status).toBe(204);
    expect((await client.get(`${LISTINGS}/${id}`)).status).toBe(404);
    expect(((await client.get(LISTINGS)).body as { listings: unknown[] }).listings).toEqual([]);

    const [row] = await ctx.db.select().from(listings).where(eq(listings.id, id));
    expect(row?.deletedAt).not.toBeNull();
    const texts = await ctx.db.select().from(listingTexts).where(eq(listingTexts.listingId, id));
    expect(texts).toHaveLength(1);
  });
});

describe('features per property type (SPEC §10)', () => {
  it('rejects features that do not apply to the property type', async () => {
    const { client } = await ctx.signedInUser();
    const id = await createListing(client);

    const land = await client.patch(`${LISTINGS}/${id}`, {
      propertyType: 'LAND',
      amenityCodes: ['ELEVATOR'],
    });
    expect(land.status).toBe(400);

    const utilities = await client.patch(`${LISTINGS}/${id}`, {
      propertyType: 'LAND',
      amenityCodes: ['ELECTRICITY', 'ROAD_ACCESS'],
    });
    expect(detailOf(utilities).amenityCodes).toEqual(['ELECTRICITY', 'ROAD_ACCESS']);
  });

  it('refuses features before a property type is chosen', async () => {
    const { client } = await ctx.signedInUser();
    const id = await createListing(client);
    expect((await client.patch(`${LISTINGS}/${id}`, { amenityCodes: ['BALCONY'] })).status).toBe(
      400,
    );
  });

  it('drops features that no longer apply when the property type changes', async () => {
    const { client } = await ctx.signedInUser();
    const id = await createListing(client);
    await client.patch(`${LISTINGS}/${id}`, {
      propertyType: 'APARTMENT',
      amenityCodes: ['ELEVATOR', 'SECURITY_SYSTEM', 'BALCONY'],
    });

    const garage = detailOf(await client.patch(`${LISTINGS}/${id}`, { propertyType: 'GARAGE' }));
    expect(garage.amenityCodes).toEqual(['ELEVATOR', 'SECURITY_SYSTEM']);
  });
});

/** A large but featureless PNG: valid dimensions, compresses far below 50 KB. */
async function sharpFlatPng(): Promise<Buffer> {
  const { default: sharp } = await import('sharp');
  return sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#ffffff' } })
    .png()
    .toBuffer();
}
