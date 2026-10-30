import {
  type ListingDetail,
  PropertyType,
  REQUIRED_ATTRIBUTES,
  checkSubmissionRequirements,
} from '@walls/shared';
import { listingInputSchema } from '@walls/validation';
import { describe, expect, it } from 'vitest';
import {
  VISIBLE_ATTRIBUTES,
  editorContent,
  remainingImageCount,
  formPathFor,
  formSubmissionSnapshot,
  parseNumber,
  toFormValues,
  toListingInput,
} from './listing-form-model';

const emptyListing: ListingDetail = {
  id: 'listing-1',
  status: 'DRAFT',
  sellerType: 'PRIVATE_SELLER',
  creator: { id: 'seller-1', displayName: 'Ana Anić' },
  slug: null,
  publishedAt: null,
  isFeatured: false,
  featuredUntil: null,
  propertyType: null,
  transactionType: null,
  texts: [],
  location: {
    country: null,
    city: null,
    municipality: null,
    neighborhood: null,
    street: null,
    streetNumber: null,
    postalCode: null,
    latitude: null,
    longitude: null,
  },
  attributes: {
    floorArea: null,
    plotArea: null,
    bedrooms: null,
    bathrooms: null,
    floor: null,
    totalFloors: null,
    yearBuilt: null,
    parkingSpaces: null,
    heatingType: null,
    furnishedStatus: null,
  },
  amenityCodes: [],
  price: { mode: 'ON_REQUEST' },
  isExactAddressPublic: false,
  rejectionReason: null,
  images: [],
  permissions: {
    editMode: 'DRAFT',
    canDelete: true,
    actions: ['SUBMIT'],
    canSetFeatured: false,
    canPermanentlyDelete: false,
  },
  revision: null,
  submissionIssues: [],
  createdAt: '2026-10-12T00:00:00.000Z',
  updatedAt: '2026-10-12T00:00:00.000Z',
};

describe('attribute visibility', () => {
  it.each(Object.values(PropertyType))('shows every attribute required for %s', (type) => {
    for (const required of REQUIRED_ATTRIBUTES[type]) {
      expect(VISIBLE_ATTRIBUTES[type]).toContain(required);
    }
  });
});

describe('parseNumber', () => {
  it('accepts a decimal comma and treats empty as null', () => {
    expect(parseNumber('74,5')).toBe(74.5);
    expect(parseNumber(' 1 200 ')).toBe(1200);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNaN();
  });
});

describe('form ↔ API conversion', () => {
  it('produces a valid draft input from an empty listing', () => {
    const input = toListingInput(toFormValues(emptyListing));
    expect(listingInputSchema.safeParse(input).success).toBe(true);
    expect(input.price).toEqual({ mode: 'ON_REQUEST' });
    expect(input.location?.country).toBe('RS');
  });

  it('clears attributes the chosen property type does not show', () => {
    const values = toFormValues(emptyListing);
    values.propertyType = 'LAND';
    values.attributes.bedrooms = '3';
    values.attributes.plotArea = '500';
    const input = toListingInput(values);
    expect(input.attributes).toMatchObject({ bedrooms: null, plotArea: 500 });
  });

  it('clears features that do not apply to the chosen property type', () => {
    const values = toFormValues(emptyListing);
    values.propertyType = 'APARTMENT';
    values.amenityCodes = ['ELEVATOR', 'BALCONY'];
    expect(toListingInput(values).amenityCodes).toEqual(['ELEVATOR', 'BALCONY']);
    values.propertyType = 'LAND';
    expect(toListingInput(values).amenityCodes).toEqual([]);
  });

  it('only sends a rental period for rental listings', () => {
    const values = toFormValues(emptyListing);
    values.price = {
      onRequest: false,
      amount: '600',
      currency: 'EUR',
      period: 'MONTH',
      negotiable: false,
    };
    values.transactionType = 'SALE';
    expect(toListingInput(values).price).toMatchObject({ mode: 'FIXED', period: null });
    values.transactionType = 'RENT';
    expect(toListingInput(values).price).toMatchObject({ period: 'MONTH' });
  });

  it('maps validation paths back to form fields', () => {
    expect(formPathFor(['texts', 0, 'title'])).toBe('texts.sr.title');
    expect(formPathFor(['texts', 1, 'description'])).toBe('texts.en.description');
    expect(formPathFor(['attributes', 'floor'])).toBe('attributes.floor');
    expect(formPathFor(['price', 'amount'])).toBe('price.amount');
    expect(formPathFor(['propertyType'])).toBe('propertyType');
  });
});

describe('live submission checklist', () => {
  it('uses the shared submission rule on unsaved form values', () => {
    const values = toFormValues(emptyListing);
    values.propertyType = 'LAND';
    values.transactionType = 'SALE';
    values.texts.sr = { title: 'Plac', description: 'Građevinski plac.' };
    values.location = {
      ...values.location,
      city: 'Novi Sad',
      street: 'Futoški put',
      streetNumber: 'bb',
      latitude: 45.25,
      longitude: 19.8,
    };
    values.attributes.plotArea = '600';
    expect(checkSubmissionRequirements(formSubmissionSnapshot(values, 3))).toEqual([]);
    expect(
      checkSubmissionRequirements(formSubmissionSnapshot(values, 2)).map((issue) => issue.field),
    ).toEqual(['images']);
  });
});

describe('editing a published listing', () => {
  const published: ListingDetail = {
    ...emptyListing,
    status: 'PUBLISHED',
    transactionType: 'SALE',
    price: { mode: 'FIXED', amount: 100000, currency: 'EUR', period: null, negotiable: false },
    permissions: { ...emptyListing.permissions, editMode: 'PUBLISHED', actions: [] },
  };
  const revision = (content: Partial<ListingDetail>) => ({
    id: 'revision-1',
    status: 'PENDING' as const,
    content: { ...published, ...content },
    removedImageIds: ['image-1'],
    rejectionReason: null,
    updatedAt: published.updatedAt,
  });

  it('starts from the proposal, keeping the live price that changes immediately', () => {
    const listing = {
      ...published,
      revision: revision({
        texts: [{ locale: 'sr' as const, title: 'Predlog', description: 'Opis' }],
        price: { mode: 'ON_REQUEST' as const },
      }),
    };
    expect(editorContent(listing).texts[0]?.title).toBe('Predlog');
    expect(editorContent(listing).price).toEqual(published.price);
    expect(remainingImageCount(listing, 4)).toBe(3);
  });

  it('takes the proposed price when the revision changes the transaction type', () => {
    const rent = {
      mode: 'FIXED' as const,
      amount: 700,
      currency: 'EUR' as const,
      period: 'MONTH' as const,
      negotiable: false,
    };
    const listing = { ...published, revision: revision({ transactionType: 'RENT', price: rent }) };
    expect(editorContent(listing).price).toEqual(rent);
  });
});
