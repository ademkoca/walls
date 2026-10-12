import { describe, expect, it } from 'vitest';
import { PriceMode } from '../pricing/price';
import { type ListingContent, diffListingContent, mergeListingContent } from './content';
import { ListingField } from './edits';

const live: ListingContent = {
  propertyType: 'APARTMENT',
  transactionType: 'SALE',
  texts: [{ locale: 'sr', title: 'Stan', description: 'Opis.' }],
  location: {
    country: 'RS',
    city: 'Beograd',
    municipality: 'Vračar',
    neighborhood: null,
    street: 'Njegoševa',
    streetNumber: '12a',
    postalCode: null,
    latitude: 44.8,
    longitude: 20.47,
  },
  attributes: {
    floorArea: 74.5,
    plotArea: null,
    bedrooms: 2,
    bathrooms: 1,
    floor: 3,
    totalFloors: 5,
    yearBuilt: null,
    parkingSpaces: null,
    heatingType: 'DISTRICT',
    furnishedStatus: null,
  },
  amenityCodes: ['ELEVATOR', 'BALCONY'],
  price: {
    mode: PriceMode.FIXED,
    amountMinor: 18_900_000,
    currency: 'EUR',
    period: null,
    negotiable: false,
  },
  isExactAddressPublic: false,
};

function merged(patch: Parameters<typeof mergeListingContent>[1]): ListingContent {
  const result = mergeListingContent(live, patch);
  if (!result.ok) throw new Error(result.message);
  return result.content;
}

describe('mergeListingContent', () => {
  it('replaces only the sections in the patch', () => {
    const content = merged({ location: { city: 'Novi Sad' } });
    expect(content.location).toMatchObject({ city: 'Novi Sad', street: null, country: null });
    expect(content.texts).toEqual(live.texts);
  });

  it('drops an empty English text and keeps Serbian first', () => {
    const content = merged({
      texts: [
        { locale: 'en', title: '', description: '' },
        { locale: 'sr', title: 'Novi naslov', description: 'Opis.' },
      ],
    });
    expect(content.texts).toEqual([{ locale: 'sr', title: 'Novi naslov', description: 'Opis.' }]);
  });

  it('converts the price to minor units', () => {
    const content = merged({
      price: {
        mode: PriceMode.FIXED,
        amount: 1200.5,
        currency: 'EUR',
        period: null,
        negotiable: true,
      },
    });
    expect(content.price).toMatchObject({ amountMinor: 120_050, negotiable: true });
  });

  it('drops features that stop applying when the property type changes', () => {
    expect(merged({ propertyType: 'GARAGE' }).amenityCodes).toEqual(['ELEVATOR']);
  });

  it('refuses features that do not apply and a rental period on a sale', () => {
    expect(mergeListingContent(live, { amenityCodes: ['ELECTRICITY'] })).toMatchObject({
      ok: false,
      path: ['amenityCodes'],
    });
    expect(
      mergeListingContent(live, {
        price: {
          mode: PriceMode.FIXED,
          amount: 500,
          currency: 'EUR',
          period: 'MONTH',
          negotiable: false,
        },
      }),
    ).toMatchObject({ ok: false, path: ['price', 'period'] });
  });
});

describe('diffListingContent', () => {
  it('reports nothing for an unchanged listing', () => {
    expect(diffListingContent(live, merged({ amenityCodes: ['BALCONY', 'ELEVATOR'] }))).toEqual([]);
  });

  it('ignores the order of object keys (stored copies may reorder them)', () => {
    const reordered = JSON.parse(
      JSON.stringify({ ...live, location: { ...live.location } }),
      (_key, value: unknown) =>
        value && typeof value === 'object' && !Array.isArray(value)
          ? Object.fromEntries(Object.entries(value).reverse())
          : value,
    ) as ListingContent;
    expect(diffListingContent(live, reordered)).toEqual([]);
  });

  it('names each changed group', () => {
    const proposed = merged({
      texts: [{ locale: 'sr', title: 'Drugi naslov', description: 'Opis.' }],
      isExactAddressPublic: true,
      price: { mode: PriceMode.ON_REQUEST },
    });
    expect(diffListingContent(live, proposed)).toEqual([
      ListingField.TEXT,
      ListingField.PRICE,
      ListingField.EXACT_ADDRESS_VISIBILITY,
    ]);
  });
});
