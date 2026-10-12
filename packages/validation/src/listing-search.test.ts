import { describe, expect, it } from 'vitest';
import {
  hasListingFilters,
  listingSearchQuerySchema,
  listingSearchToQuery,
  parseListingSearch,
} from './listing-search';

describe('listing search query (SPEC §17)', () => {
  it('parses every filter from URL strings, with defaults for sort and page', () => {
    expect(
      listingSearchQuerySchema.parse({
        q: ' stan ',
        location: 'Vračar',
        transactionType: 'SALE',
        propertyType: 'APARTMENT',
        minPrice: '100000',
        maxPrice: '250000.5',
        currency: 'EUR',
        minArea: '40',
        bedrooms: '2',
        amenities: 'ELEVATOR,PARKING,ELEVATOR',
      }),
    ).toEqual({
      q: 'stan',
      location: 'Vračar',
      transactionType: 'SALE',
      propertyType: 'APARTMENT',
      minPrice: 100000,
      maxPrice: 250000.5,
      currency: 'EUR',
      minArea: 40,
      bedrooms: 2,
      amenities: ['ELEVATOR', 'PARKING'],
      sort: 'NEWEST',
      page: 1,
    });
  });

  it('rejects invalid values and unknown parameters in the API', () => {
    for (const query of [
      { propertyType: 'CASTLE' },
      { minPrice: '-1' },
      { bedrooms: '0' },
      { amenities: 'ELEVATOR,JACUZZI' },
      { sort: 'RANDOM' },
      { page: '0' },
      { utm_source: 'x' },
    ]) {
      expect(listingSearchQuerySchema.safeParse(query).success, JSON.stringify(query)).toBe(false);
    }
  });

  it('drops invalid values from page URLs instead of failing', () => {
    expect(
      parseListingSearch({
        q: 'kuća',
        propertyType: 'CASTLE',
        minPrice: 'abc',
        bedrooms: ['2', '3'],
        sort: 'PRICE_ASC',
        page: '-4',
        utm_source: 'newsletter',
        location: '   ',
      }),
    ).toEqual({ q: 'kuća', sort: 'PRICE_ASC', page: 1 });
  });

  it('writes a search back to a minimal URL query, round-tripping', () => {
    const search = parseListingSearch({
      transactionType: 'RENT',
      maxPrice: '800',
      currency: 'EUR',
      amenities: 'PETS_ALLOWED',
      sort: 'NEWEST',
      page: '2',
    });
    const query = listingSearchToQuery(search);
    expect(query).toEqual({
      transactionType: 'RENT',
      maxPrice: '800',
      currency: 'EUR',
      amenities: 'PETS_ALLOWED',
      page: '2',
    });
    expect(parseListingSearch(query)).toEqual(search);
    // A currency without a price bound means nothing.
    expect(listingSearchToQuery({ currency: 'RSD', sort: 'NEWEST', page: 1 })).toEqual({});
  });

  it('tells a filtered search from a plain one', () => {
    expect(hasListingFilters(parseListingSearch({ sort: 'PRICE_DESC', page: '3' }))).toBe(false);
    expect(hasListingFilters(parseListingSearch({ bathrooms: '2' }))).toBe(true);
  });
});
