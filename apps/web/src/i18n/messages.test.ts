import {
  AMENITIES,
  ApiErrorCode,
  FurnishedStatus,
  HeatingType,
  ImageIssue,
  ListingStatus,
  PriceMode,
  PropertyType,
  RentalPeriod,
  Role,
  SellerType,
  TransactionType,
  checkSubmissionRequirements,
} from '@walls/shared';
import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import sr from '../../messages/sr.json';

type Tree = { [key: string]: string | Tree };

/** Flattens nested messages into "a.b.c" → text. */
function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((all, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string'
      ? { ...all, [path]: value }
      : { ...all, ...flatten(value, path) };
  }, {});
}

/**
 * ICU argument names used in a message, e.g. {email} or {min, plural, …}. A plural branch
 * such as `one {grad}` is text, not an argument.
 */
function argumentsOf(message: string): string[] {
  const argument = /(?<!\b(?:zero|one|two|few|many|other|=\d+)\s*)\{\s*([a-zA-Z]+)\s*[,}]/g;
  return [...message.matchAll(argument)].map((match) => match[1] ?? '').sort();
}

const catalogues = { sr: flatten(sr), en: flatten(en) };

describe('translation catalogues (SPEC §31)', () => {
  it('have exactly the same keys in Serbian and English', () => {
    expect(Object.keys(catalogues.en).sort()).toEqual(Object.keys(catalogues.sr).sort());
  });

  it('use the same placeholders in both languages', () => {
    for (const [key, message] of Object.entries(catalogues.sr)) {
      expect(argumentsOf(catalogues.en[key] ?? ''), key).toEqual(argumentsOf(message));
    }
  });

  it('have no empty messages', () => {
    for (const [locale, messages] of Object.entries(catalogues)) {
      for (const [key, message] of Object.entries(messages)) {
        expect(message.trim(), `${locale}: ${key}`).not.toBe('');
      }
    }
  });

  it('translate every API error code', () => {
    for (const code of Object.values(ApiErrorCode)) {
      expect(catalogues.sr[`errors.${code}`], code).toBeDefined();
    }
  });

  it('translate every role', () => {
    for (const role of Object.values(Role)) {
      expect(catalogues.sr[`roles.${role}`], role).toBeDefined();
    }
  });

  it('name every kind of advertiser for the signed-in user', () => {
    for (const sellerType of Object.values(SellerType)) {
      expect(catalogues.sr[`accountKinds.${sellerType}`], sellerType).toBeDefined();
    }
  });

  it('label every listing enum value', () => {
    const enums = {
      propertyType: PropertyType,
      transactionType: TransactionType,
      listingStatus: ListingStatus,
      heatingType: HeatingType,
      furnishedStatus: FurnishedStatus,
      rentalPeriod: RentalPeriod,
      sellerType: SellerType,
    };
    for (const [name, values] of Object.entries(enums)) {
      for (const value of Object.values(values)) {
        expect(catalogues.sr[`enums.${name}.${value}`], `${name}.${value}`).toBeDefined();
      }
    }
    for (const amenity of AMENITIES) {
      expect(catalogues.sr[`enums.amenity.${amenity}`], amenity).toBeDefined();
    }
    for (const issue of Object.values(ImageIssue)) {
      expect(catalogues.sr[`listings.editor.images.issues.${issue}`], issue).toBeDefined();
    }
  });

  it('describe every field the submission checklist can report', () => {
    // An empty listing of each type triggers every "required" issue for that type.
    for (const propertyType of Object.values(PropertyType)) {
      const issues = checkSubmissionRequirements({
        propertyType,
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
      });
      for (const { field } of issues) {
        expect(catalogues.sr[`listings.editor.checklist.fields.${field}`], field).toBeDefined();
      }
    }
    expect(catalogues.sr['listings.editor.checklist.fields.price']).toBeDefined();
  });
});
