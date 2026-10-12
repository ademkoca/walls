import { describe, expect, it } from 'vitest';
import { ListingField, planPublishedEdit } from './edits';

describe('editing a published listing (SPEC §6)', () => {
  it('applies price, address visibility and media order changes immediately', () => {
    expect(
      planPublishedEdit([
        ListingField.PRICE,
        ListingField.EXACT_ADDRESS_VISIBILITY,
        ListingField.MEDIA_ORDER,
      ]),
    ).toEqual({
      immediate: [
        ListingField.PRICE,
        ListingField.EXACT_ADDRESS_VISIBILITY,
        ListingField.MEDIA_ORDER,
      ],
      requiresReview: [],
    });
  });

  it.each([
    ListingField.TEXT,
    ListingField.PROPERTY_TYPE,
    ListingField.TRANSACTION_TYPE,
    ListingField.LOCATION,
    ListingField.ATTRIBUTES,
    ListingField.AMENITIES,
    ListingField.MEDIA_SET,
  ])('sends %s changes to review', (field) => {
    expect(planPublishedEdit([field])).toEqual({ immediate: [], requiresReview: [field] });
  });

  it('splits a mixed edit', () => {
    expect(planPublishedEdit([ListingField.TEXT, ListingField.PRICE])).toEqual({
      immediate: [ListingField.PRICE],
      requiresReview: [ListingField.TEXT],
    });
  });

  it('keeps a price change with a transaction-type change in review', () => {
    expect(planPublishedEdit([ListingField.TRANSACTION_TYPE, ListingField.PRICE])).toEqual({
      immediate: [],
      requiresReview: [ListingField.TRANSACTION_TYPE, ListingField.PRICE],
    });
  });

  it('ignores duplicate fields', () => {
    expect(planPublishedEdit([ListingField.PRICE, ListingField.PRICE]).immediate).toEqual([
      ListingField.PRICE,
    ]);
  });
});
