import type { ListingDetail } from '@walls/shared';
import { expect } from 'vitest';
import { testImage } from './helpers';

export const LISTINGS = '/api/v1/listings';

/** The client returned by `signedInUser`. */
export interface TestClient {
  post: (path: string, body?: object) => PromiseLike<{ status: number; body: unknown }>;
  upload: (path: string, file: Buffer) => PromiseLike<{ status: number; body: unknown }>;
  patch: (path: string, body?: object) => PromiseLike<{ status: number; body: unknown }>;
}

export const detailOf = (response: { body: unknown }) =>
  (response.body as { listing: ListingDetail }).listing;
export const imagesOf = (response: { body: unknown }) =>
  (response.body as { images: ListingDetail['images'] }).images;

export async function createListing(client: TestClient): Promise<string> {
  const response = await client.post(LISTINGS);
  expect(response.status).toBe(201);
  return (response.body as { id: string }).id;
}

/** Everything SPEC §39 requires for an apartment, apart from the images. */
export const completeApartment = {
  propertyType: 'APARTMENT',
  transactionType: 'SALE',
  texts: [
    { locale: 'sr', title: 'Trosoban stan na Vračaru', description: 'Svetao stan blizu Hrama.' },
    { locale: 'en', title: '', description: '' },
  ],
  location: {
    country: 'RS',
    city: 'Beograd',
    municipality: 'Vračar',
    street: 'Njegoševa',
    streetNumber: '12a',
    latitude: 44.8,
    longitude: 20.47,
  },
  attributes: {
    floorArea: 74.5,
    bedrooms: 2,
    bathrooms: 1,
    floor: 3,
    totalFloors: 5,
    heatingType: 'DISTRICT',
    furnishedStatus: 'SEMI_FURNISHED',
  },
  amenityCodes: ['ELEVATOR', 'BALCONY'],
  price: { mode: 'FIXED', amount: 189000, currency: 'EUR', period: null, negotiable: true },
};

let sharedImage: Buffer | undefined;
export async function image(): Promise<Buffer> {
  sharedImage ??= await testImage();
  return sharedImage;
}

export async function addImages(client: TestClient, id: string, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    const response = await client.upload(`${LISTINGS}/${id}/images`, await image());
    expect(response.status).toBe(201);
  }
}

/** A complete apartment listing submitted for review by `client`. */
export async function submittedListing(
  client: TestClient,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const id = await createListing(client);
  expect(
    (await client.patch(`${LISTINGS}/${id}`, { ...completeApartment, ...overrides })).status,
  ).toBe(200);
  await addImages(client, id, 3);
  expect((await client.post(`${LISTINGS}/${id}/submit`)).status).toBe(200);
  return id;
}
