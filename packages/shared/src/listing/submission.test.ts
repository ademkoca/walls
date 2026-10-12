import { describe, expect, it } from 'vitest';
import { Currency, Locale, PropertyType, RentalPeriod, TransactionType } from '../enums';
import { PriceIssue, PriceMode } from '../pricing/price';
import {
  type ListingSubmissionSnapshot,
  SubmissionIssueCode,
  checkSubmissionRequirements,
} from './submission';

function completeApartment(
  overrides: Partial<ListingSubmissionSnapshot> = {},
): ListingSubmissionSnapshot {
  return {
    propertyType: PropertyType.APARTMENT,
    transactionType: TransactionType.SALE,
    texts: [{ locale: Locale.SR, title: 'Dvosoban stan na Vračaru', description: 'Svetao stan.' }],
    location: {
      country: 'RS',
      city: 'Beograd',
      street: 'Njegoševa',
      streetNumber: '12a',
      latitude: 44.8,
      longitude: 20.47,
    },
    attributes: {
      floorArea: 54,
      plotArea: null,
      bedrooms: 2,
      bathrooms: 1,
      floor: 3,
      totalFloors: 5,
    },
    price: {
      mode: PriceMode.FIXED,
      amountMinor: 18_500_000,
      currency: Currency.EUR,
      period: null,
      negotiable: false,
    },
    imageCount: 3,
    ...overrides,
  };
}

const fields = (snapshot: ListingSubmissionSnapshot) =>
  checkSubmissionRequirements(snapshot).map((issue) => issue.field);

describe('submission requirements (SPEC §39)', () => {
  it('accepts a complete listing', () => {
    expect(checkSubmissionRequirements(completeApartment())).toEqual([]);
  });

  it('accepts "price on request"', () => {
    expect(
      checkSubmissionRequirements(completeApartment({ price: { mode: PriceMode.ON_REQUEST } })),
    ).toEqual([]);
  });

  it('reports every missing common field', () => {
    const empty: ListingSubmissionSnapshot = {
      propertyType: null,
      transactionType: null,
      texts: [],
      location: {
        country: null,
        city: null,
        street: null,
        streetNumber: null,
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
      },
      price: { mode: PriceMode.ON_REQUEST },
      imageCount: 0,
    };
    expect(fields(empty)).toEqual([
      'propertyType',
      'transactionType',
      'title',
      'description',
      'location.country',
      'location.city',
      'location.street',
      'location.streetNumber',
      'location.latitude',
      'location.longitude',
      'images',
    ]);
  });

  it('requires the Serbian text even when English is provided', () => {
    const englishOnly = completeApartment({
      texts: [{ locale: Locale.EN, title: 'Two-bedroom flat', description: 'Bright flat.' }],
    });
    expect(fields(englishOnly)).toEqual(['title', 'description']);
  });

  it('treats whitespace-only text as missing', () => {
    const blank = completeApartment({
      texts: [{ locale: Locale.SR, title: '  ', description: 'Opis' }],
    });
    expect(fields(blank)).toEqual(['title']);
  });

  it('requires at least three images', () => {
    expect(checkSubmissionRequirements(completeApartment({ imageCount: 2 }))).toEqual([
      { code: SubmissionIssueCode.TOO_FEW_IMAGES, field: 'images' },
    ]);
  });

  describe('property-type attributes', () => {
    const noAttributes = {
      floorArea: null,
      plotArea: null,
      bedrooms: null,
      bathrooms: null,
      floor: null,
      totalFloors: null,
    };

    it.each([
      [PropertyType.APARTMENT, ['floorArea', 'bedrooms', 'bathrooms', 'floor', 'totalFloors']],
      [PropertyType.HOUSE, ['floorArea', 'bedrooms', 'bathrooms']],
      [PropertyType.VILLA, ['floorArea', 'bedrooms', 'bathrooms']],
      [PropertyType.OFFICE, ['floorArea']],
      [PropertyType.GARAGE, ['floorArea']],
      [PropertyType.LAND, ['plotArea']],
    ])('%s requires %j', (propertyType, required) => {
      const snapshot = completeApartment({ propertyType, attributes: noAttributes });
      expect(fields(snapshot)).toEqual(required.map((key) => `attributes.${key}`));
    });
  });

  it('rejects a floor above the total number of floors', () => {
    const snapshot = completeApartment({
      attributes: { ...completeApartment().attributes, floor: 6, totalFloors: 5 },
    });
    expect(checkSubmissionRequirements(snapshot)).toEqual([
      { code: SubmissionIssueCode.FLOOR_ABOVE_TOTAL_FLOORS, field: 'attributes.floor' },
    ]);
  });

  it('requires a rental period for a priced rent listing', () => {
    const snapshot = completeApartment({ transactionType: TransactionType.RENT });
    expect(checkSubmissionRequirements(snapshot)).toEqual([
      {
        code: SubmissionIssueCode.INVALID_PRICE,
        field: 'price',
        priceIssue: PriceIssue.PERIOD_REQUIRED_FOR_RENT,
      },
    ]);
  });

  it('rejects a rental period on a sale listing', () => {
    const snapshot = completeApartment({
      price: {
        mode: PriceMode.FIXED,
        amountMinor: 100_000,
        currency: Currency.EUR,
        period: RentalPeriod.MONTH,
        negotiable: false,
      },
    });
    expect(checkSubmissionRequirements(snapshot)).toEqual([
      {
        code: SubmissionIssueCode.INVALID_PRICE,
        field: 'price',
        priceIssue: PriceIssue.PERIOD_NOT_ALLOWED_FOR_SALE,
      },
    ]);
  });
});
