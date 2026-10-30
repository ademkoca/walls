import { AMENITIES } from '@walls/shared';
import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../src/client';
import { agentApplications, amenities, listingMedia, listings, users } from '../src/schema';
import { testDatabaseUrl } from './env';
import { expectDbError, insertListing, insertUser } from './fixtures';

const { db, close } = createDatabase({ url: testDatabaseUrl() });
afterAll(close);

describe('migrations', () => {
  // Heating and furnished status are structured property fields, not amenities (SPEC §10).
  it('seed the amenity catalogue in the order of @walls/shared', async () => {
    const rows = await db.select().from(amenities).orderBy(amenities.sortOrder);
    expect(rows.map((row) => row.code)).toEqual(AMENITIES);
  });
});

describe('users', () => {
  it('treats email addresses case-insensitively', async () => {
    const user = await insertUser(db, { email: 'Marko@Example.com' });
    const [found] = await db.select().from(users).where(eq(users.email, 'marko@example.com'));
    expect(found?.id).toBe(user.id);
    await expectDbError(insertUser(db, { email: 'MARKO@example.com' }), {
      constraint: 'users_email_unique',
    });
  });

  it('defaults phone numbers to unverified', async () => {
    const user = await insertUser(db, { phone: '+381 64 123 4567' });
    expect(user.phoneVerificationStatus).toBe('UNVERIFIED');
  });

  it('requires a verified email for active accounts', async () => {
    await expectDbError(insertUser(db, { status: 'ACTIVE', emailVerifiedAt: null }), {
      constraint: 'users_active_has_verified_email',
    });
  });

  it('gives each role a matching kind of advertiser (SPEC §5)', async () => {
    for (const sellerType of ['REAL_ESTATE_AGENT', 'AGENCY', 'INVESTOR'] as const) {
      const professional = await insertUser(db, { role: 'REAL_ESTATE_AGENT', sellerType });
      expect(professional.sellerType).toBe(sellerType);
    }
    const mismatches = [
      { role: 'PRIVATE_SELLER', sellerType: 'AGENCY' },
      { role: 'PRIVATE_SELLER', sellerType: null },
      { role: 'REAL_ESTATE_AGENT', sellerType: 'PRIVATE_SELLER' },
      { role: 'REAL_ESTATE_AGENT', sellerType: null },
      { role: 'ADMIN', sellerType: 'AGENCY' },
    ] as const;
    for (const mismatch of mismatches) {
      await expectDbError(insertUser(db, mismatch), {
        constraint: 'users_seller_type_matches_role',
      });
    }
  });

  it('keeps deactivation status and timestamp consistent', async () => {
    await expectDbError(insertUser(db, { status: 'DEACTIVATED' }), {
      constraint: 'users_deactivated_at_matches_status',
    });
  });
});

describe('listings', () => {
  it('starts as a draft with price on request and a hidden exact address', async () => {
    const listing = await insertListing(db);
    expect(listing).toMatchObject({
      status: 'DRAFT',
      priceMode: 'ON_REQUEST',
      priceAmountMinor: null,
      isExactAddressPublic: false,
    });
  });

  it('accepts a fixed price and stores amounts above 2^31', async () => {
    const listing = await insertListing(db, {
      priceMode: 'FIXED',
      priceAmountMinor: 25_000_000_000,
      priceCurrency: 'RSD',
    });
    expect(listing.priceAmountMinor).toBe(25_000_000_000);
  });

  it('rejects an amount combined with "price on request"', async () => {
    await expectDbError(insertListing(db, { priceMode: 'ON_REQUEST', priceAmountMinor: 100 }), {
      constraint: 'listings_price_shape',
    });
  });

  it('records an Admin archiving only on archived listings', async () => {
    await expectDbError(insertListing(db, { archivedByReviewer: true }), {
      constraint: 'listings_archived_by_reviewer_only_when_archived',
    });
    const archived = await insertListing(db, {
      status: 'ARCHIVED',
      slug: `arhiviran-${Date.now()}`,
      publishedAt: new Date(),
      archivedByReviewer: true,
    });
    expect(archived.archivedByReviewer).toBe(true);
  });

  it('rejects a fixed price without an amount', async () => {
    await expectDbError(insertListing(db, { priceMode: 'FIXED', priceCurrency: 'EUR' }), {
      constraint: 'listings_price_shape',
    });
  });

  it('rejects a fixed price without a currency', async () => {
    await expectDbError(insertListing(db, { priceMode: 'FIXED', priceAmountMinor: 100_000 }), {
      constraint: 'listings_price_shape',
    });
  });

  const monthlyPrice = {
    priceMode: 'FIXED',
    priceAmountMinor: 100_000,
    priceCurrency: 'EUR',
    pricePeriod: 'MONTH',
  } as const;

  it.each([
    ['a sale listing', 'SALE'],
    ['a listing without a transaction type', null],
  ] as const)('rejects a rental period on %s', async (_label, transactionType) => {
    await expectDbError(insertListing(db, { ...monthlyPrice, transactionType }), {
      constraint: 'listings_rental_period_only_for_rent',
    });
  });

  it('accepts a rental period on a rent listing', async () => {
    const listing = await insertListing(db, { ...monthlyPrice, transactionType: 'RENT' });
    expect(listing.pricePeriod).toBe('MONTH');
  });

  it('requires a reason for rejected listings', async () => {
    await expectDbError(insertListing(db, { status: 'REJECTED' }), {
      constraint: 'listings_rejected_has_reason',
    });
  });

  it('requires a slug and publication date once published', async () => {
    await expectDbError(insertListing(db, { status: 'PUBLISHED' }), {
      constraint: 'listings_published_has_slug',
    });
  });

  it('only allows drafts to be soft-deleted', async () => {
    await expectDbError(insertListing(db, { status: 'PENDING_REVIEW', deletedAt: new Date() }), {
      constraint: 'listings_only_drafts_deleted',
    });
  });

  it('never lets the creator change (SPEC §5)', async () => {
    const listing = await insertListing(db);
    const someoneElse = await insertUser(db);
    await expectDbError(
      db.update(listings).set({ createdById: someoneElse.id }).where(eq(listings.id, listing.id)),
      { message: /created_by_id is immutable/ },
    );
  });

  it('still allows other updates', async () => {
    const listing = await insertListing(db);
    const [updated] = await db
      .update(listings)
      .set({ isExactAddressPublic: true })
      .where(eq(listings.id, listing.id))
      .returning();
    expect(updated?.isExactAddressPublic).toBe(true);
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(listing.updatedAt.getTime());
  });
});

describe('listing media', () => {
  const image = (listingId: string, sortOrder: number, isPrimary: boolean) => ({
    listingId,
    type: 'IMAGE' as const,
    storageKey: `listings/${listingId}/${sortOrder}`,
    url: `https://media.example/${listingId}/${sortOrder}.jpg`,
    sortOrder,
    isPrimary,
    mimeType: 'image/jpeg',
    bytes: 500_000,
    width: 1600,
    height: 1200,
  });

  it('allows only one cover image per listing', async () => {
    const listing = await insertListing(db);
    await db.insert(listingMedia).values([image(listing.id, 0, true), image(listing.id, 1, false)]);
    await expectDbError(db.insert(listingMedia).values(image(listing.id, 2, true)), {
      constraint: 'listing_media_one_primary_per_listing',
    });
  });
});

describe('agent applications', () => {
  const application = (email: string) => ({
    sellerType: 'REAL_ESTATE_AGENT' as const,
    fullName: 'Ana Anić',
    email,
    phone: '+381 64 765 4321',
  });

  it('allows one pending application per email address, case-insensitively', async () => {
    await db.insert(agentApplications).values(application('ana@agency.rs'));
    await expectDbError(db.insert(agentApplications).values(application('ANA@agency.rs')), {
      constraint: 'agent_applications_one_pending_per_email',
    });
  });

  it('are for a professional account only', async () => {
    await expectDbError(
      db
        .insert(agentApplications)
        .values({ ...application('seller@agency.rs'), sellerType: 'PRIVATE_SELLER' }),
      { constraint: 'agent_applications_professional_seller_type' },
    );
  });

  it('requires a reason to reject', async () => {
    const reviewer = await insertUser(db, { role: 'ADMIN' });
    await expectDbError(
      db.insert(agentApplications).values({
        ...application('reject@agency.rs'),
        status: 'REJECTED',
        reviewedById: reviewer.id,
        reviewedAt: new Date(),
      }),
      { constraint: 'agent_applications_rejection_reason' },
    );
  });
});

describe('database extensions', () => {
  it('provides unaccent for diacritic-insensitive search', async () => {
    const result = await db.execute<{ plain: string }>(
      sql`SELECT unaccent('Vračar Čukarica Đeram') AS plain`,
    );
    expect(result[0]?.plain).toBe('Vracar Cukarica Deram');
  });
});
