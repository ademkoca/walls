import { describe, expect, it } from 'vitest';
import { listingInputSchema, priceInputSchema, rejectListingInputSchema } from './listing';

const fixedEur = {
  mode: 'FIXED',
  amount: 185_000,
  currency: 'EUR',
  period: null,
  negotiable: false,
};

describe('listing input', () => {
  it('accepts an empty draft', () => {
    expect(listingInputSchema.parse({})).toEqual({});
  });

  it('accepts a complete listing and trims text', () => {
    const result = listingInputSchema.parse({
      propertyType: 'APARTMENT',
      transactionType: 'SALE',
      texts: [{ locale: 'sr', title: '  Dvosoban stan  ', description: 'Svetao stan.' }],
      location: {
        country: 'rs',
        city: 'Beograd',
        street: 'Njegoševa',
        streetNumber: 'bb',
        latitude: 44.8,
        longitude: 20.47,
      },
      attributes: { floorArea: 54.5, bedrooms: 2, bathrooms: 1, floor: 0, totalFloors: 5 },
      amenityCodes: ['ELEVATOR', 'AIR_CONDITIONING'],
      price: fixedEur,
      isExactAddressPublic: false,
    });
    expect(result.texts?.[0]?.title).toBe('Dvosoban stan');
    expect(result.location?.country).toBe('RS');
  });

  it.each([
    ['createdBy', { createdBy: 'user-1' }],
    ['sellerType', { sellerType: 'REAL_ESTATE_AGENT' }],
    ['assignedAgentId', { assignedAgentId: 'agent-1' }],
    ['status', { status: 'PUBLISHED' }],
  ])('rejects the server-controlled field %s', (_field, input) => {
    expect(listingInputSchema.safeParse(input).success).toBe(false);
  });

  it('rejects unknown enum values', () => {
    expect(listingInputSchema.safeParse({ propertyType: 'Stan' }).success).toBe(false);
  });

  it('rejects duplicate locales and duplicate amenities', () => {
    const text = { locale: 'sr', title: 'a', description: 'b' };
    expect(listingInputSchema.safeParse({ texts: [text, text] }).success).toBe(false);
    expect(listingInputSchema.safeParse({ amenityCodes: ['GARDEN', 'GARDEN'] }).success).toBe(
      false,
    );
  });

  it('rejects a floor above the total floors', () => {
    expect(listingInputSchema.safeParse({ attributes: { floor: 6, totalFloors: 5 } }).success).toBe(
      false,
    );
  });

  it('checks the rental period against the transaction type when both are sent', () => {
    expect(listingInputSchema.safeParse({ transactionType: 'RENT', price: fixedEur }).success).toBe(
      false,
    );
    expect(
      listingInputSchema.safeParse({
        transactionType: 'SALE',
        price: { ...fixedEur, period: 'MONTH' },
      }).success,
    ).toBe(false);
    expect(
      listingInputSchema.safeParse({
        transactionType: 'RENT',
        price: { ...fixedEur, period: 'MONTH' },
      }).success,
    ).toBe(true);
  });
});

describe('price input (SPEC §11)', () => {
  it('accepts "price on request" with no amount', () => {
    expect(priceInputSchema.parse({ mode: 'ON_REQUEST' })).toEqual({ mode: 'ON_REQUEST' });
  });

  it('rejects an amount combined with "price on request"', () => {
    expect(priceInputSchema.safeParse({ mode: 'ON_REQUEST', amount: 1000 }).success).toBe(false);
  });

  it('requires an amount and currency for a fixed price', () => {
    expect(
      priceInputSchema.safeParse({ mode: 'FIXED', negotiable: false, period: null }).success,
    ).toBe(false);
  });

  it('accepts at most two decimal places', () => {
    expect(priceInputSchema.safeParse({ ...fixedEur, amount: 1200.55 }).success).toBe(true);
    expect(priceInputSchema.safeParse({ ...fixedEur, amount: 1200.555 }).success).toBe(false);
  });

  it.each([0, -100])('rejects the non-positive amount %d', (amount) => {
    expect(priceInputSchema.safeParse({ ...fixedEur, amount }).success).toBe(false);
  });
});

describe('rejection reason', () => {
  it('requires a non-blank reason', () => {
    expect(rejectListingInputSchema.safeParse({ reason: '   ' }).success).toBe(false);
    expect(rejectListingInputSchema.parse({ reason: ' Missing photos ' })).toEqual({
      reason: 'Missing photos',
    });
  });
});
