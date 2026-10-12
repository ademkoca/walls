import { auditLogs, listingMedia, listingRevisions } from '@walls/database';
import { type ListingSummary, Role } from '@walls/shared';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createTestContext, errorOf } from './helpers';
import {
  LISTINGS,
  addImages,
  completeApartment,
  detailOf,
  image,
  imagesOf,
  submittedListing,
} from './listing-fixtures';

const ctx = createTestContext();
afterAll(ctx.close);

/** A published listing with `imageCount` approved images, its seller and an admin. */
async function published(imageCount = 3) {
  const seller = await ctx.signedInUser();
  const admin = await ctx.signedInUser(Role.ADMIN);
  const id = await submittedListing(seller.client);
  if (imageCount > 3) await addImagesBeforeApproval(seller, id, imageCount - 3);
  expect((await admin.client.post(`${LISTINGS}/${id}/approve`)).status).toBe(200);
  return { id, seller, admin };
}

/** Submitted listings are locked, so extra images are added in a revised draft. */
async function addImagesBeforeApproval(
  seller: Awaited<ReturnType<typeof ctx.signedInUser>>,
  id: string,
  count: number,
) {
  const admin = await ctx.signedInUser(Role.ADMIN);
  await admin.client.post(`${LISTINGS}/${id}/reject`, { reason: 'Dodajte slike.' });
  await seller.client.post(`${LISTINGS}/${id}/revise`);
  await addImages(seller.client, id, count);
  await seller.client.post(`${LISTINGS}/${id}/submit`);
}

const withTitle = (title: string) => ({
  ...completeApartment,
  texts: [{ locale: 'sr', title, description: 'Svetao stan blizu Hrama.' }],
});

async function auditActions(id: string) {
  const rows = await ctx.db.select().from(auditLogs).where(eq(auditLogs.entityId, id));
  return rows.map((row) => row.action);
}

describe('minor edits of a published listing (SPEC §6)', () => {
  it('apply the price and address visibility immediately, audited, without review', async () => {
    const { id, seller } = await published();
    const response = await seller.client.patch(`${LISTINGS}/${id}`, {
      ...completeApartment,
      price: { mode: 'FIXED', amount: 175000, currency: 'EUR', period: null, negotiable: false },
      isExactAddressPublic: true,
    });
    expect(response.status).toBe(200);
    expect(detailOf(response)).toMatchObject({
      status: 'PUBLISHED',
      price: { amount: 175000 },
      isExactAddressPublic: true,
      revision: null,
    });
    expect(await auditActions(id)).toContain('LISTING_UPDATED_LIVE');
  });

  it('apply image order and cover changes among approved images immediately', async () => {
    const { id, seller } = await published();
    const [first, second, third] = detailOf(await seller.client.get(`${LISTINGS}/${id}`)).images;
    const response = await seller.client.put(`${LISTINGS}/${id}/images/order`, {
      mediaIds: [second!.id, third!.id, first!.id],
      primaryMediaId: third!.id,
    });
    expect(imagesOf(response).map((item) => [item.id, item.isPrimary])).toEqual([
      [second!.id, false],
      [third!.id, true],
      [first!.id, false],
    ]);
    expect(detailOf(await seller.client.get(`${LISTINGS}/${id}`)).revision).toBeNull();
  });
});

describe('major edits of a published listing (SPEC §6)', () => {
  it('go into a pending revision while the live listing stays unchanged', async () => {
    const { id, seller, admin } = await published();
    const response = await seller.client.patch(`${LISTINGS}/${id}`, withTitle('Novi naslov'));
    const listing = detailOf(response);
    expect(listing.texts[0]?.title).toBe('Trosoban stan na Vračaru');
    expect(listing.revision).toMatchObject({
      status: 'PENDING',
      content: { texts: [{ title: 'Novi naslov' }] },
    });

    const queue = (await admin.client.get(`${LISTINGS}?pendingRevision=true`)).body as {
      listings: ListingSummary[];
    };
    expect(queue.listings.find((item) => item.id === id)?.hasPendingRevision).toBe(true);
  });

  it('keep one pending revision that further edits update, and drop it when undone', async () => {
    const { id, seller } = await published();
    await seller.client.patch(`${LISTINGS}/${id}`, withTitle('Prvi predlog'));
    await seller.client.patch(`${LISTINGS}/${id}`, withTitle('Drugi predlog'));
    const rows = await ctx.db
      .select()
      .from(listingRevisions)
      .where(eq(listingRevisions.listingId, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.content.texts[0]?.title).toBe('Drugi predlog');

    const undone = detailOf(await seller.client.patch(`${LISTINGS}/${id}`, completeApartment));
    expect(undone.revision).toBeNull();
    expect(await auditActions(id)).toContain('LISTING_REVISION_WITHDRAWN');
  });

  it('refuse a proposed version that could not be published', async () => {
    const { id, seller } = await published();
    const response = await seller.client.patch(`${LISTINGS}/${id}`, {
      ...completeApartment,
      location: { ...completeApartment.location, street: null },
    });
    expect(response.status).toBe(422);
    expect(errorOf(response).code).toBe('SUBMISSION_INCOMPLETE');
    expect(detailOf(await seller.client.get(`${LISTINGS}/${id}`)).revision).toBeNull();
  });

  it('send a new price to review together with a new transaction type', async () => {
    const { id, seller } = await published();
    const listing = detailOf(
      await seller.client.patch(`${LISTINGS}/${id}`, {
        ...completeApartment,
        transactionType: 'RENT',
        price: { mode: 'FIXED', amount: 700, currency: 'EUR', period: 'MONTH', negotiable: false },
      }),
    );
    expect(listing).toMatchObject({ transactionType: 'SALE', price: { amount: 189000 } });
    expect(listing.revision?.content).toMatchObject({
      transactionType: 'RENT',
      price: { amount: 700, period: 'MONTH' },
    });
  });
});

describe('images of a published listing (SPEC §6)', () => {
  it('keeps added images unapproved, and never as the cover, until the revision is approved', async () => {
    const { id, seller } = await published();
    const images = imagesOf(await seller.client.upload(`${LISTINGS}/${id}/images`, await image()));
    const added = images.find((item) => !item.approved)!;
    expect(added).toBeDefined();
    expect(detailOf(await seller.client.get(`${LISTINGS}/${id}`)).revision?.status).toBe('PENDING');

    const response = await seller.client.put(`${LISTINGS}/${id}/images/order`, {
      mediaIds: images.map((item) => item.id),
      primaryMediaId: added.id,
    });
    expect(response.status).toBe(400);
  });

  it('records removals in the revision and keeps the minimum number of images', async () => {
    const { id, seller } = await published();
    const [first] = detailOf(await seller.client.get(`${LISTINGS}/${id}`)).images;
    const tooFew = await seller.client.delete(`${LISTINGS}/${id}/images/${first!.id}`);
    expect(tooFew.status).toBe(422);

    await addImages(seller.client, id, 1);
    const response = await seller.client.delete(`${LISTINGS}/${id}/images/${first!.id}`);
    expect(response.status).toBe(200);
    const listing = detailOf(await seller.client.get(`${LISTINGS}/${id}`));
    expect(listing.images.map((item) => item.id)).toContain(first!.id);
    expect(listing.revision?.removedImageIds).toEqual([first!.id]);
  });
});

describe('reviewing revisions (SPEC §6)', () => {
  it('approval publishes the proposed content and image changes, and emails the creator', async () => {
    const { id, seller, admin } = await published();
    const [removed] = detailOf(await seller.client.get(`${LISTINGS}/${id}`)).images;
    const [removedRow] = await ctx.db
      .select()
      .from(listingMedia)
      .where(eq(listingMedia.id, removed!.id));
    await seller.client.patch(`${LISTINGS}/${id}`, withTitle('Odobreni naslov'));
    await addImages(seller.client, id, 1);
    await seller.client.delete(`${LISTINGS}/${id}/images/${removed!.id}`);

    const response = await admin.client.post(`${LISTINGS}/${id}/revision/approve`);
    expect(response.status).toBe(200);
    const listing = detailOf(response);
    expect(listing.texts[0]?.title).toBe('Odobreni naslov');
    expect(listing.revision).toBeNull();
    expect(listing.images).toHaveLength(3);
    expect(listing.images.every((item) => item.approved)).toBe(true);
    expect(listing.images.filter((item) => item.isPrimary)).toHaveLength(1);
    expect(listing.images.map((item) => item.id)).not.toContain(removed!.id);
    await expect.poll(() => ctx.media.files.has(removedRow!.storageKey)).toBe(false);

    const email = await ctx.lastEmailTo(seller.user.email);
    expect(email?.subject).toContain('Izmene oglasa su objavljene');
    expect(await auditActions(id)).toContain('LISTING_REVISION_APPROVED');
  });

  it('rejection keeps the live listing, drops added images and shows the reason', async () => {
    const { id, seller, admin } = await published();
    await seller.client.patch(`${LISTINGS}/${id}`, withTitle('Odbijeni naslov'));
    await addImages(seller.client, id, 1);

    expect((await admin.client.post(`${LISTINGS}/${id}/revision/reject`, {})).status).toBe(400);
    const response = await admin.client.post(`${LISTINGS}/${id}/revision/reject`, {
      reason: 'Naslov nije tačan.',
    });
    const listing = detailOf(response);
    expect(listing.texts[0]?.title).toBe('Trosoban stan na Vračaru');
    expect(listing.images).toHaveLength(3);
    expect(listing.revision).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Naslov nije tačan.',
    });
    expect((await ctx.lastEmailTo(seller.user.email))?.text).toContain('Naslov nije tačan.');

    // A new edit starts a new pending revision.
    const next = detailOf(await seller.client.patch(`${LISTINGS}/${id}`, withTitle('Treći put')));
    expect(next.revision).toMatchObject({ status: 'PENDING', rejectionReason: null });
  });

  it('is for reviewers only, and needs a pending revision', async () => {
    const { id, seller, admin } = await published();
    expect((await admin.client.post(`${LISTINGS}/${id}/revision/approve`)).status).toBe(404);
    await seller.client.patch(`${LISTINGS}/${id}`, withTitle('Predlog'));
    expect((await seller.client.post(`${LISTINGS}/${id}/revision/approve`)).status).toBe(403);
  });

  it('is discarded when the listing is marked sold', async () => {
    const { id, seller, admin } = await published();
    await seller.client.patch(`${LISTINGS}/${id}`, withTitle('Predlog'));
    await addImages(seller.client, id, 1);
    const sold = detailOf(await admin.client.post(`${LISTINGS}/${id}/mark-sold`));
    expect(sold).toMatchObject({ status: 'SOLD', revision: null });
    expect(sold.images).toHaveLength(3);
    expect(await auditActions(id)).toContain('LISTING_REVISION_DISCARDED');
  });
});
