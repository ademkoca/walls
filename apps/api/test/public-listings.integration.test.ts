import { randomUUID } from 'node:crypto';
import {
  type ExchangeRateView,
  type ListingSearchResult,
  type PublicHome,
  type PublicListingDetail,
  Role,
  SellerType,
  type SitemapEntries,
} from '@walls/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RATE_MAX_AGE_MS } from '../src/exchange-rates/exchange-rates.service';
import { TEST_EUR_RSD, createTestContext } from './helpers';
import {
  LISTINGS,
  type TestClient,
  addImages,
  completeApartment,
  detailOf,
  submittedListing,
} from './listing-fixtures';

const ctx = createTestContext();
afterAll(ctx.close);

const PUBLIC = '/api/v1/public';
type Seller = Awaited<ReturnType<typeof ctx.signedInUser>>;
type Admin = Seller;

let admin: Admin;
beforeAll(async () => {
  admin = await ctx.signedInUser(Role.ADMIN);
  await ctx.exchangeRates.refreshIfStale();
});

/** Submits a listing and has an Admin publish it; returns its id and public slug. */
async function published(client: TestClient, overrides: Record<string, unknown> = {}) {
  const id = await submittedListing(client, overrides);
  const approved = await admin.client.post(`${LISTINGS}/${id}/approve`);
  expect(approved.status).toBe(200);
  return { id, slug: detailOf(approved).slug! };
}

const inCity = (city: string) => ({ location: { ...completeApartment.location, city } });

async function detail(slug: string) {
  const response = await ctx.client().get(`${PUBLIC}/listings/${slug}`);
  return { status: response.status, listing: response.body as PublicListingDetail };
}

async function search(query: Record<string, string>) {
  const response = await ctx
    .client()
    .get(`${PUBLIC}/listings?${new URLSearchParams(query).toString()}`);
  expect(response.status).toBe(200);
  return response.body as ListingSearchResult;
}

describe('public property search (SPEC §17)', () => {
  // A city of its own keeps other tests' listings out of the results.
  const city = `Testgrad ${randomUUID().slice(0, 8)}`;
  const ids: Record<'apartment' | 'house' | 'rental' | 'onRequest', string> = {
    apartment: '',
    house: '',
    rental: '',
    onRequest: '',
  };
  const ordered = async (query: Record<string, string>) =>
    (await search({ location: city, ...query })).items.map((item) => item.id);

  beforeAll(async () => {
    const seller = await ctx.signedInUser();
    ids.apartment = (
      await published(seller.client, {
        ...inCity(city),
        texts: [
          { locale: 'sr', title: 'Trosoban stan na Vračaru', description: 'Pogled na Hram.' },
        ],
      })
    ).id;
    ids.house = (
      await published(seller.client, {
        ...inCity(city),
        propertyType: 'HOUSE',
        texts: [{ locale: 'sr', title: 'Porodična kuća', description: 'Kuća sa dvorištem.' }],
        attributes: { floorArea: 150, bedrooms: 4, bathrooms: 2 },
        amenityCodes: ['GARDEN'],
        // 20,000,000 RSD = 170,212.77 EUR at the test rate.
        price: {
          mode: 'FIXED',
          amount: 20_000_000,
          currency: 'RSD',
          period: null,
          negotiable: false,
        },
      })
    ).id;
    ids.rental = (
      await published(seller.client, {
        ...inCity(city),
        transactionType: 'RENT',
        texts: [{ locale: 'sr', title: 'Garsonjera za izdavanje', description: 'Namešten stan.' }],
        attributes: {
          floorArea: 40,
          bedrooms: 1,
          bathrooms: 1,
          floor: 1,
          totalFloors: 3,
          furnishedStatus: 'FURNISHED',
        },
        amenityCodes: [],
        price: { mode: 'FIXED', amount: 600, currency: 'EUR', period: 'MONTH', negotiable: false },
      })
    ).id;
    ids.onRequest = (
      await published(seller.client, {
        ...inCity(city),
        texts: [{ locale: 'sr', title: 'Penthaus', description: 'Cena na upit.' }],
        attributes: { floorArea: 90, bedrooms: 3, bathrooms: 2, floor: 6, totalFloors: 6 },
        price: { mode: 'ON_REQUEST' },
      })
    ).id;
    // Not public: still in review, or created by a deactivated seller.
    await submittedListing(seller.client, inCity(city));
    const banned = await ctx.signedInUser();
    await published(banned.client, inCity(city));
    await admin.client.post(`/api/v1/users/${banned.user.id}/deactivate`, { reason: 'Prevara.' });
  });

  it('finds published listings by location, newest first, with cards for the results', async () => {
    const result = await search({ location: city });
    expect(result).toMatchObject({ total: 4, page: 1, pageSize: 24, hasMore: false });
    expect(result.items.map((item) => item.id)).toEqual([
      ids.onRequest,
      ids.rental,
      ids.house,
      ids.apartment,
    ]);
    expect(result.items[3]).toMatchObject({
      title: { sr: 'Trosoban stan na Vračaru', en: null },
      city,
      municipality: 'Vračar',
      price: { mode: 'FIXED', amount: 189000, currency: 'EUR' },
    });
    // Location parts and words match without accents or case.
    expect(await ordered({ location: `vracar, ${city.toLowerCase()}` })).toHaveLength(4);
    expect(await ordered({ location: `Zemun, ${city}` })).toEqual([]);
  });

  it('matches keywords by word prefix in the title and description, ignoring accents', async () => {
    expect(await ordered({ q: 'vracaru' })).toEqual([ids.apartment]);
    expect(await ordered({ q: 'Kuć dvori' })).toEqual([ids.house]);
    expect(await ordered({ q: 'stan' })).toEqual([ids.rental, ids.apartment]);
    expect(await ordered({ q: 'stan kuća' })).toEqual([]);
    expect(await ordered({ q: "%' & | !" })).toHaveLength(4);
  });

  it('filters by type, rooms, area and amenities', async () => {
    expect(await ordered({ transactionType: 'RENT' })).toEqual([ids.rental]);
    expect(await ordered({ propertyType: 'HOUSE' })).toEqual([ids.house]);
    expect(await ordered({ bedrooms: '3' })).toEqual([ids.onRequest, ids.house]);
    expect(await ordered({ bathrooms: '2' })).toEqual([ids.onRequest, ids.house]);
    expect(await ordered({ minArea: '80' })).toEqual([ids.onRequest, ids.house]);
    expect(await ordered({ maxArea: '50' })).toEqual([ids.rental]);
    expect(await ordered({ amenities: 'ELEVATOR,BALCONY' })).toEqual([
      ids.onRequest,
      ids.apartment,
    ]);
    expect(await ordered({ amenities: 'GARDEN,ELEVATOR' })).toEqual([]);
  });

  it('filters by furnished status exactly; listings without one never match', async () => {
    expect(await ordered({ furnishedStatus: 'FURNISHED' })).toEqual([ids.rental]);
    // The fixture apartment is semi-furnished; the house and penthouse have no status.
    expect(await ordered({ furnishedStatus: 'SEMI_FURNISHED' })).toEqual([ids.apartment]);
    expect(await ordered({ furnishedStatus: 'UNFURNISHED' })).toEqual([]);
  });

  it('marks every card with its advertiser type, the creator’s', async () => {
    const result = await search({ location: city });
    expect(result.items.map((item) => item.sellerType)).toEqual(Array(4).fill('PRIVATE_SELLER'));
  });

  it('compares prices across currencies at the current rate; "on request" never matches', async () => {
    expect(await ordered({ minPrice: '175000', currency: 'EUR' })).toEqual([ids.apartment]);
    expect(await ordered({ maxPrice: '180000' })).toEqual([ids.rental, ids.house]);
    expect(await ordered({ minPrice: '20000000', currency: 'RSD' })).toEqual([
      ids.house,
      ids.apartment,
    ]);
  });

  it('sorts by price and area, listings without a price last', async () => {
    expect(await ordered({ sort: 'PRICE_ASC' })).toEqual([
      ids.rental,
      ids.house,
      ids.apartment,
      ids.onRequest,
    ]);
    expect(await ordered({ sort: 'PRICE_DESC' })).toEqual([
      ids.apartment,
      ids.house,
      ids.rental,
      ids.onRequest,
    ]);
    expect(await ordered({ sort: 'AREA_ASC' })).toEqual([
      ids.rental,
      ids.apartment,
      ids.onRequest,
      ids.house,
    ]);
    expect(await ordered({ sort: 'AREA_DESC' })).toEqual([
      ids.house,
      ids.onRequest,
      ids.apartment,
      ids.rental,
    ]);
  });

  it('pages results and rejects invalid queries', async () => {
    const second = await search({ location: city, page: '2' });
    expect(second).toMatchObject({ items: [], total: 4, page: 2, hasMore: false });
    for (const query of [
      'bedrooms=0',
      'sort=RANDOM',
      'amenities=JACUZZI',
      'furnishedStatus=YES',
      'role=ADMIN',
    ]) {
      expect((await ctx.client().get(`${PUBLIC}/listings?${query}`)).status).toBe(400);
    }
  });
});

describe('public listing page (SPEC §13, §16)', () => {
  it('shows the listing without the hidden address, with an approximate area', async () => {
    const seller = await ctx.signedInUser();
    const { slug } = await published(seller.client);
    const { status, listing } = await detail(slug);
    expect(status).toBe(200);
    expect(listing).toMatchObject({
      slug,
      title: { sr: 'Trosoban stan na Vračaru', en: null },
      description: { sr: 'Svetao stan blizu Hrama.', en: null },
      propertyType: 'APARTMENT',
      transactionType: 'SALE',
      price: { mode: 'FIXED', amount: 189000, currency: 'EUR', negotiable: true },
      attributes: { floorArea: 74.5, bedrooms: 2, floor: 3, heatingType: 'DISTRICT' },
      amenityCodes: ['ELEVATOR', 'BALCONY'],
      location: { city: 'Beograd', municipality: 'Vračar', exact: null },
      advertiser: {
        slug: seller.user.slug,
        role: 'PRIVATE_SELLER',
        sellerType: 'PRIVATE_SELLER',
        phone: null,
        email: null,
      },
      assignedAgent: null,
    });
    expect(listing.location.approximate).toMatchObject({ radiusMeters: 250 });
    expect(JSON.stringify(listing)).not.toContain('Njegoševa');
    expect(listing.images).toHaveLength(3);
    // The cover, as the storage delivers it for link previews (untransformed in tests).
    expect(listing.linkPreviewImage).toEqual({
      url: listing.images[0]?.url,
      width: null,
      height: null,
    });
    expect(listing.images[0]).not.toHaveProperty('key');
  });

  it('shows the exact address and the assigned agent when there are', async () => {
    const seller = await ctx.signedInUser();
    const agent = await ctx.signedInUser(Role.REAL_ESTATE_AGENT);
    const { id, slug } = await published(seller.client, { isExactAddressPublic: true });
    await admin.client.put(`${LISTINGS}/${id}/assignment`, { agentId: agent.user.id });
    const { listing } = await detail(slug);
    expect(listing.location).toMatchObject({
      exact: { street: 'Njegoševa', streetNumber: '12a', latitude: 44.8, longitude: 20.47 },
      approximate: null,
    });
    expect(listing.assignedAgent).toMatchObject({
      slug: agent.user.slug,
      sellerType: 'REAL_ESTATE_AGENT',
    });
  });

  it('keeps showing the published version while edits wait for review', async () => {
    const seller = await ctx.signedInUser();
    const { id, slug } = await published(seller.client);
    const edited = await seller.client.patch(`${LISTINGS}/${id}`, {
      ...completeApartment,
      texts: [{ locale: 'sr', title: 'Novi naslov', description: 'Novi opis.' }],
    });
    expect(edited.status).toBe(200);
    await addImages(seller.client, id, 1);
    const { listing } = await detail(slug);
    expect(listing.title.sr).toBe('Trosoban stan na Vračaru');
    expect(listing.images).toHaveLength(3);
  });

  it('is not found once the listing is sold, or for unknown and malformed slugs', async () => {
    const seller = await ctx.signedInUser();
    const { id, slug } = await published(seller.client);
    expect((await admin.client.post(`${LISTINGS}/${id}/mark-sold`)).status).toBe(200);
    expect((await detail(slug)).status).toBe(404);
    expect((await detail('no-such-listing')).status).toBe(404);
    expect((await detail('Not_A_Slug')).status).toBe(400);
  });
});

describe('home page listings (SPEC §16, §22)', () => {
  it('lists unexpired featured listings and the latest listings', async () => {
    const seller = await ctx.signedInUser();
    const featured = await published(seller.client);
    const expired = await published(seller.client);
    const latest = await published(seller.client);
    await admin.client.put(`${LISTINGS}/${featured.id}/featured`, {
      featured: true,
      featuredUntil: null,
    });
    await admin.client.put(`${LISTINGS}/${expired.id}/featured`, {
      featured: true,
      featuredUntil: new Date(Date.now() + 1000).toISOString(),
    });
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const home = (await ctx.client().get(`${PUBLIC}/home`)).body as PublicHome;
    const featuredIds = home.featured.map((item) => item.id);
    expect(featuredIds).toContain(featured.id);
    expect(featuredIds).not.toContain(expired.id);
    expect(home.latest[0]?.id).toBe(latest.id);
    expect(home.latest.length).toBeLessThanOrEqual(8);
  });

  it('counts public listings, per property type, their cities ignoring case and accents, and active agents', async () => {
    const stats = async () => ((await ctx.client().get(`${PUBLIC}/home`)).body as PublicHome).stats;
    const before = await stats();

    const code = randomUUID().slice(0, 8);
    const seller = await ctx.signedInUser();
    await published(seller.client, inCity(`Šabac ${code}`));
    await published(seller.client, inCity(` sabac ${code.toUpperCase()} `));
    await submittedListing(seller.client, inCity(`Pending ${code}`));
    const banned = await ctx.signedInUser();
    await published(banned.client, inCity(`Banned ${code}`));
    await admin.client.post(`/api/v1/users/${banned.user.id}/deactivate`, { reason: 'Prevara.' });
    await ctx.signedInUser(Role.REAL_ESTATE_AGENT);
    await ctx.signedInUser(Role.REAL_ESTATE_AGENT, SellerType.INVESTOR);

    const after = await stats();
    expect(after).toMatchObject({
      listings: before.listings + 2,
      cities: before.cities + 1,
      partners: before.partners + 2,
    });
    expect(after.byPropertyType?.APARTMENT).toBe((before.byPropertyType?.APARTMENT ?? 0) + 2);
    expect(Object.values(after.byPropertyType ?? {}).reduce((sum, n) => sum + n, 0)).toBe(
      after.listings,
    );
  });
});

describe('searching by advertiser type (SPEC §17)', () => {
  const city = `Tipgrad ${randomUUID().slice(0, 8)}`;
  const ids: Partial<Record<SellerType, string>> = {};
  const ordered = async (query: Record<string, string>) =>
    (await search({ location: city, ...query })).items.map((item) => item.id);

  beforeAll(async () => {
    const seller = await ctx.signedInUser();
    ids.PRIVATE_SELLER = (await published(seller.client, inCity(city))).id;
    for (const sellerType of [
      SellerType.REAL_ESTATE_AGENT,
      SellerType.AGENCY,
      SellerType.INVESTOR,
    ]) {
      const professional = await ctx.signedInUser(Role.REAL_ESTATE_AGENT, sellerType);
      ids[sellerType] = (await published(professional.client, inCity(city))).id;
    }
  });

  it('keeps only listings advertised by that kind of advertiser', async () => {
    for (const sellerType of Object.values(SellerType)) {
      expect(await ordered({ sellerType }), sellerType).toEqual([ids[sellerType]]);
    }
  });

  it('goes by the creator even when an agency is assigned to the listing', async () => {
    const agency = await ctx.signedInUser(Role.REAL_ESTATE_AGENT, SellerType.AGENCY);
    await admin.client.put(`${LISTINGS}/${ids.PRIVATE_SELLER}/assignment`, {
      agentId: agency.user.id,
    });
    expect(await ordered({ sellerType: 'PRIVATE_SELLER' })).toEqual([ids.PRIVATE_SELLER]);
    expect(await ordered({ sellerType: 'AGENCY' })).toEqual([ids.AGENCY]);
  });

  it('shows the advertiser and an assigned agency with their kinds on the listing page', async () => {
    const card = (await search({ location: city, sellerType: 'PRIVATE_SELLER' })).items[0]!;
    const { listing } = await detail(card.slug);
    expect(listing.advertiser).toMatchObject({ sellerType: 'PRIVATE_SELLER' });
    expect(listing.assignedAgent).toMatchObject({ sellerType: 'AGENCY', agencyName: null });
  });
});

describe('exchange rate (SPEC §12)', () => {
  it('serves the stored rate with its retrieval time', async () => {
    const rate = (await ctx.client().get(`${PUBLIC}/exchange-rate`)).body as ExchangeRateView;
    expect(rate).toMatchObject({ base: 'EUR', quote: 'RSD', provider: 'fixed' });
    expect(Number(rate.rate)).toBe(Number(TEST_EUR_RSD));
    expect(Date.parse(rate.fetchedAt)).not.toBeNaN();
  });

  it('asks the provider again only once the stored rate is old', async () => {
    expect(await ctx.exchangeRates.refreshIfStale()).toBe(false);
    const later = new Date(Date.now() + RATE_MAX_AGE_MS + 1000);
    expect(await ctx.exchangeRates.refreshIfStale(later)).toBe(true);
    expect((await ctx.exchangeRates.current())?.fetchedAt).toBe(later.toISOString());
  });
});

describe('sitemap entries (SPEC §32)', () => {
  it('lists public listings, active professionals and sellers with public listings', async () => {
    const seller = await ctx.signedInUser();
    const quietSeller = await ctx.signedInUser();
    const agent = await ctx.signedInUser(Role.REAL_ESTATE_AGENT);
    const agency = await ctx.signedInUser(Role.REAL_ESTATE_AGENT, SellerType.AGENCY);
    const { slug } = await published(seller.client);

    const entries = (await ctx.client().get(`${PUBLIC}/sitemap`)).body as SitemapEntries;
    const slugs = (list: { slug: string }[]) => list.map((entry) => entry.slug);
    expect(slugs(entries.listings)).toContain(slug);
    expect(slugs(entries.partners)).toContain(agent.user.slug);
    expect(slugs(entries.partners)).toContain(agency.user.slug);
    expect(slugs(entries.sellers)).toContain(seller.user.slug);
    expect(slugs(entries.sellers)).not.toContain(quietSeller.user.slug);
  });
});
