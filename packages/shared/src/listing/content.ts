import type { ListingLocationView, ListingText, PropertyAttributesView } from '../api/listings';
import {
  type Currency,
  DEFAULT_LOCALE,
  Locale,
  type PropertyType,
  type RentalPeriod,
  TransactionType,
} from '../enums';
import { toMinorUnits } from '../pricing/money';
import { type Price, PriceMode } from '../pricing/price';
import { AMENITIES, isAmenityAllowed } from './amenities';
import { ListingField } from './edits';
import type { ListingSubmissionSnapshot } from './submission';

/**
 * Everything an editor can change about a listing, in one normalized shape. The live
 * listing is stored relationally; this shape is used to merge edits, to compare a proposed
 * version with the live one (published-edit revisions, SPEC §6), and to store revisions.
 */
export interface ListingContent {
  propertyType: PropertyType | null;
  transactionType: TransactionType | null;
  /** Serbian first; an English text only when it has content (SPEC §31). */
  texts: ListingText[];
  location: ListingLocationView;
  attributes: PropertyAttributesView;
  /** In catalogue order. */
  amenityCodes: string[];
  price: Price;
  isExactAddressPublic: boolean;
}

type Nullable<T> = { [K in keyof T]?: T[K] | null };

/** The edit an editor sends (structurally the `listingInputSchema` output). */
export interface ListingContentPatch {
  propertyType?: PropertyType;
  transactionType?: TransactionType;
  texts?: readonly { locale: Locale; title: string; description: string }[];
  location?: Nullable<ListingLocationView>;
  attributes?: Nullable<PropertyAttributesView>;
  amenityCodes?: readonly string[];
  price?:
    | { mode: typeof PriceMode.ON_REQUEST }
    | {
        mode: typeof PriceMode.FIXED;
        /** Major units, e.g. 1200.5. */
        amount: number;
        currency: Currency;
        period: RentalPeriod | null;
        negotiable: boolean;
      };
  isExactAddressPublic?: boolean;
}

export type MergeResult =
  { ok: true; content: ListingContent } | { ok: false; path: string[]; message: string };

const LOCALE_ORDER: readonly Locale[] = [Locale.SR, Locale.EN];

function normalizeTexts(texts: readonly ListingText[]): ListingText[] {
  return LOCALE_ORDER.flatMap((locale) => {
    const text = texts.find((candidate) => candidate.locale === locale);
    if (!text) return [];
    const keep = locale === DEFAULT_LOCALE || text.title !== '' || text.description !== '';
    return keep ? [{ locale, title: text.title, description: text.description }] : [];
  });
}

const orderAmenities = (codes: readonly string[]) => {
  const chosen = new Set(codes);
  return AMENITIES.filter((amenity) => chosen.has(amenity));
};

function nullsFor<T extends object>(template: T, patch: Nullable<T>): T {
  return Object.fromEntries(
    Object.keys(template).map((key) => [key, patch[key as keyof T] ?? null]),
  ) as T;
}

/**
 * Applies an edit to `base`. Each section present in the patch replaces that section;
 * absent sections are kept. Features that no longer apply to the property type are dropped
 * (SPEC §10). Fails when the result breaks a rule the data model enforces.
 */
export function mergeListingContent(base: ListingContent, patch: ListingContentPatch): MergeResult {
  const propertyType = patch.propertyType ?? base.propertyType;
  const transactionType = patch.transactionType ?? base.transactionType;

  if (
    patch.amenityCodes &&
    !patch.amenityCodes.every((code) => isAmenityAllowed(propertyType, code))
  ) {
    return {
      ok: false,
      path: ['amenityCodes'],
      message: 'A feature does not apply to this property type',
    };
  }
  const amenityCodes = orderAmenities(
    (patch.amenityCodes ?? base.amenityCodes).filter((code) =>
      isAmenityAllowed(propertyType, code),
    ),
  );

  let price = base.price;
  if (patch.price) {
    price =
      patch.price.mode === PriceMode.ON_REQUEST
        ? { mode: PriceMode.ON_REQUEST }
        : {
            mode: PriceMode.FIXED,
            amountMinor: toMinorUnits(patch.price.amount, patch.price.currency),
            currency: patch.price.currency,
            period: patch.price.period,
            negotiable: patch.price.negotiable,
          };
  }
  if (
    price.mode === PriceMode.FIXED &&
    price.period !== null &&
    transactionType !== TransactionType.RENT
  ) {
    return {
      ok: false,
      path: ['price', 'period'],
      message: 'Only rental listings have a rental period',
    };
  }

  return {
    ok: true,
    content: {
      propertyType,
      transactionType,
      texts: patch.texts ? normalizeTexts(patch.texts) : base.texts,
      location: patch.location ? nullsFor(base.location, patch.location) : base.location,
      attributes: patch.attributes ? nullsFor(base.attributes, patch.attributes) : base.attributes,
      amenityCodes,
      price,
      isExactAddressPublic: patch.isExactAddressPublic ?? base.isExactAddressPublic,
    },
  };
}

/** JSON with object keys sorted, so stored copies (e.g. Postgres jsonb, which reorders keys) compare equal. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
}

const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);

/** Which groups of content differ between two versions (input to `planPublishedEdit`). */
export function diffListingContent(live: ListingContent, proposed: ListingContent): ListingField[] {
  const fields: ListingField[] = [];
  if (live.propertyType !== proposed.propertyType) fields.push(ListingField.PROPERTY_TYPE);
  if (live.transactionType !== proposed.transactionType) fields.push(ListingField.TRANSACTION_TYPE);
  if (!same(normalizeTexts(live.texts), normalizeTexts(proposed.texts)))
    fields.push(ListingField.TEXT);
  if (!same(live.location, proposed.location)) fields.push(ListingField.LOCATION);
  if (!same(live.attributes, proposed.attributes)) fields.push(ListingField.ATTRIBUTES);
  if (!same(orderAmenities(live.amenityCodes), orderAmenities(proposed.amenityCodes))) {
    fields.push(ListingField.AMENITIES);
  }
  if (!same(live.price, proposed.price)) fields.push(ListingField.PRICE);
  if (live.isExactAddressPublic !== proposed.isExactAddressPublic) {
    fields.push(ListingField.EXACT_ADDRESS_VISIBILITY);
  }
  return fields;
}

/** The submission snapshot of a content version with `imageCount` images. */
export function contentSubmissionSnapshot(
  content: ListingContent,
  imageCount: number,
): ListingSubmissionSnapshot {
  const { location, attributes } = content;
  return {
    propertyType: content.propertyType,
    transactionType: content.transactionType,
    texts: content.texts,
    location: {
      country: location.country,
      city: location.city,
      street: location.street,
      streetNumber: location.streetNumber,
      latitude: location.latitude,
      longitude: location.longitude,
    },
    attributes: {
      floorArea: attributes.floorArea,
      plotArea: attributes.plotArea,
      bedrooms: attributes.bedrooms,
      bathrooms: attributes.bathrooms,
      floor: attributes.floor,
      totalFloors: attributes.totalFloors,
    },
    price: content.price,
    imageCount,
  };
}
