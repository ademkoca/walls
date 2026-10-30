import { describe, expect, it } from 'vitest';
import { ListingField, planPublishedEdit } from './edits';

describe('editing a published listing (SPEC §6)', () => {
  it.each([
    ListingField.PROPERTY_TYPE,
    ListingField.TRANSACTION_TYPE,
    ListingField.LOCATION,
    ListingField.ATTRIBUTES,
    ListingField.AMENITIES,
    ListingField.MEDIA_ORDER,
    ListingField.PRICE,
    ListingField.EXACT_ADDRESS_VISIBILITY,
  ])('applies %s changes immediately', (field) => {
    expect(planPublishedEdit([field])).toEqual({ immediate: [field], requiresReview: [] });
  });

  it.each([ListingField.TEXT, ListingField.IMAGES_ADDED])('sends %s changes to review', (field) => {
    expect(planPublishedEdit([field])).toEqual({ immediate: [], requiresReview: [field] });
  });

  it('splits a mixed edit', () => {
    expect(
      planPublishedEdit([ListingField.TEXT, ListingField.TRANSACTION_TYPE, ListingField.PRICE]),
    ).toEqual({
      immediate: [ListingField.TRANSACTION_TYPE, ListingField.PRICE],
      requiresReview: [ListingField.TEXT],
    });
  });

  it('ignores duplicate fields', () => {
    expect(planPublishedEdit([ListingField.PRICE, ListingField.PRICE]).immediate).toEqual([
      ListingField.PRICE,
    ]);
  });
});
