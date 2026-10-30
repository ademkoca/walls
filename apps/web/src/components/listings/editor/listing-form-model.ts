import {
  Currency,
  DEFAULT_LOCALE,
  type FurnishedStatus,
  type HeatingType,
  type ListingContentView,
  type ListingDetail,
  ListingEditMode,
  ReviewStatus,
  type ListingSubmissionSnapshot,
  Locale,
  PriceMode,
  PropertyType,
  type RentalPeriod,
  TransactionType,
  isAmenityAllowed,
  toMinorUnits,
} from '@walls/shared';
import type { ListingInput } from '@walls/validation';

/**
 * The listing editor's form state and its conversion to and from the API shapes. Plain
 * module (no 'use client') so it can be unit-tested and shared.
 */

/** The platform lists properties in Serbia; the form does not offer other countries. */
export const LISTING_COUNTRY = 'RS';

export const NUMERIC_ATTRIBUTES = [
  'floorArea',
  'plotArea',
  'bedrooms',
  'bathrooms',
  'floor',
  'totalFloors',
  'yearBuilt',
  'parkingSpaces',
] as const;
export type NumericAttribute = (typeof NUMERIC_ATTRIBUTES)[number];
export type AttributeField = NumericAttribute | 'heatingType' | 'furnishedStatus';

const { APARTMENT, HOUSE, VILLA, OFFICE, RETAIL, WAREHOUSE, LAND, GARAGE, OTHER } = PropertyType;

/**
 * Which attribute fields the form shows per property type (presentation only). Every
 * attribute required for submission (`REQUIRED_ATTRIBUTES`) is included; a unit test
 * guards that.
 */
export const VISIBLE_ATTRIBUTES: Readonly<Record<PropertyType, readonly AttributeField[]>> = {
  [APARTMENT]: [
    'floorArea',
    'bedrooms',
    'bathrooms',
    'floor',
    'totalFloors',
    'yearBuilt',
    'parkingSpaces',
    'heatingType',
    'furnishedStatus',
  ],
  [HOUSE]: [
    'floorArea',
    'plotArea',
    'bedrooms',
    'bathrooms',
    'totalFloors',
    'yearBuilt',
    'parkingSpaces',
    'heatingType',
    'furnishedStatus',
  ],
  [VILLA]: [
    'floorArea',
    'plotArea',
    'bedrooms',
    'bathrooms',
    'totalFloors',
    'yearBuilt',
    'parkingSpaces',
    'heatingType',
    'furnishedStatus',
  ],
  [OFFICE]: [
    'floorArea',
    'floor',
    'totalFloors',
    'yearBuilt',
    'parkingSpaces',
    'heatingType',
    'furnishedStatus',
  ],
  [RETAIL]: ['floorArea', 'floor', 'totalFloors', 'yearBuilt', 'parkingSpaces', 'heatingType'],
  [WAREHOUSE]: ['floorArea', 'plotArea', 'yearBuilt', 'parkingSpaces', 'heatingType'],
  [GARAGE]: ['floorArea', 'floor'],
  [OTHER]: ['floorArea', 'plotArea', 'yearBuilt', 'parkingSpaces', 'heatingType'],
  [LAND]: ['plotArea'],
};

/** Integer attributes; the others accept decimals. */
export const INTEGER_ATTRIBUTES: ReadonlySet<NumericAttribute> = new Set([
  'bedrooms',
  'bathrooms',
  'floor',
  'totalFloors',
  'yearBuilt',
  'parkingSpaces',
]);

export interface ListingFormValues {
  propertyType: PropertyType | '';
  transactionType: TransactionType | '';
  texts: Record<Locale, { title: string; description: string }>;
  location: {
    city: string;
    municipality: string;
    neighborhood: string;
    street: string;
    streetNumber: string;
    postalCode: string;
    latitude: number | null;
    longitude: number | null;
  };
  /** Numbers are kept as typed text so "74,5" (Serbian decimal comma) can be entered. */
  attributes: Record<NumericAttribute, string> & {
    heatingType: HeatingType | '';
    furnishedStatus: FurnishedStatus | '';
  };
  amenityCodes: string[];
  price: {
    onRequest: boolean;
    amount: string;
    currency: Currency;
    period: RentalPeriod | '';
    negotiable: boolean;
  };
  isExactAddressPublic: boolean;
}

const numberText = (value: number | null) => (value === null ? '' : String(value));

/** Form values for a listing's content (live, or proposed by a revision). */
export function toFormValues(listing: ListingContentView): ListingFormValues {
  const text = (locale: Locale) => {
    const found = listing.texts.find((candidate) => candidate.locale === locale);
    return { title: found?.title ?? '', description: found?.description ?? '' };
  };
  const { location, attributes, price } = listing;
  return {
    propertyType: listing.propertyType ?? '',
    transactionType: listing.transactionType ?? '',
    texts: { [Locale.SR]: text(Locale.SR), [Locale.EN]: text(Locale.EN) },
    location: {
      city: location.city ?? '',
      municipality: location.municipality ?? '',
      neighborhood: location.neighborhood ?? '',
      street: location.street ?? '',
      streetNumber: location.streetNumber ?? '',
      postalCode: location.postalCode ?? '',
      latitude: location.latitude,
      longitude: location.longitude,
    },
    attributes: {
      ...(Object.fromEntries(
        NUMERIC_ATTRIBUTES.map((key) => [key, numberText(attributes[key])]),
      ) as Record<NumericAttribute, string>),
      heatingType: attributes.heatingType ?? '',
      furnishedStatus: attributes.furnishedStatus ?? '',
    },
    amenityCodes: listing.amenityCodes,
    price:
      price.mode === PriceMode.FIXED
        ? {
            onRequest: false,
            amount: String(price.amount),
            currency: price.currency,
            period: price.period ?? '',
            negotiable: price.negotiable,
          }
        : { onRequest: true, amount: '', currency: Currency.EUR, period: '', negotiable: false },
    isExactAddressPublic: listing.isExactAddressPublic,
  };
}

/** A pending revision's proposed content, if the listing has one. */
export function proposedContent(listing: ListingDetail): ListingContentView | null {
  return listing.revision?.status === ReviewStatus.PENDING ? listing.revision.content : null;
}

/**
 * The content the creator works on: for a published listing with a pending revision, the
 * live content with the proposed title and description (only those wait for review).
 * Mirrors the API's rule.
 */
export function editorContent(listing: ListingDetail): ListingContentView {
  const proposed = proposedContent(listing);
  if (listing.permissions.editMode !== ListingEditMode.PUBLISHED || !proposed) return listing;
  return { ...listing, texts: proposed.texts };
}

/** Parses typed numbers, accepting a decimal comma. Empty → null; garbage → NaN (rejected). */
export function parseNumber(text: string): number | null {
  const normalized = text.trim().replace(/\s/g, '').replace(',', '.');
  return normalized === '' ? null : Number(normalized);
}

const emptyToNull = (value: string) => (value.trim() === '' ? null : value);

export function isAttributeVisible(values: ListingFormValues, field: AttributeField): boolean {
  return values.propertyType !== '' && VISIBLE_ATTRIBUTES[values.propertyType].includes(field);
}

function priceInput(values: ListingFormValues): NonNullable<ListingInput['price']> {
  const { price, transactionType } = values;
  if (price.onRequest) return { mode: PriceMode.ON_REQUEST };
  return {
    mode: PriceMode.FIXED,
    amount: parseNumber(price.amount) ?? Number.NaN,
    currency: price.currency,
    period: transactionType === TransactionType.RENT ? price.period || null : null,
    negotiable: price.negotiable,
  };
}

/**
 * The PATCH body for the whole form. Attributes and features that don't apply to the chosen
 * property type are cleared, so switching type does not keep stale values.
 */
export function toListingInput(values: ListingFormValues): ListingInput {
  const visible = (field: AttributeField) => isAttributeVisible(values, field);
  const numeric = Object.fromEntries(
    NUMERIC_ATTRIBUTES.map((key) => [
      key,
      visible(key) ? parseNumber(values.attributes[key]) : null,
    ]),
  ) as Record<NumericAttribute, number | null>;

  return {
    ...(values.propertyType ? { propertyType: values.propertyType } : {}),
    ...(values.transactionType ? { transactionType: values.transactionType } : {}),
    // Index order matters: `formPathFor` maps validation paths back by position.
    texts: [
      { locale: Locale.SR, ...values.texts[Locale.SR] },
      { locale: Locale.EN, ...values.texts[Locale.EN] },
    ],
    location: {
      country: LISTING_COUNTRY,
      city: emptyToNull(values.location.city),
      municipality: emptyToNull(values.location.municipality),
      neighborhood: emptyToNull(values.location.neighborhood),
      street: emptyToNull(values.location.street),
      streetNumber: emptyToNull(values.location.streetNumber),
      postalCode: emptyToNull(values.location.postalCode),
      latitude: values.location.latitude,
      longitude: values.location.longitude,
    },
    attributes: {
      ...numeric,
      heatingType: visible('heatingType') ? values.attributes.heatingType || null : null,
      furnishedStatus: visible('furnishedStatus')
        ? values.attributes.furnishedStatus || null
        : null,
    },
    amenityCodes: values.amenityCodes.filter((code) =>
      isAmenityAllowed(values.propertyType || null, code),
    ),
    price: priceInput(values),
    isExactAddressPublic: values.isExactAddressPublic,
  };
}

const TEXT_LOCALES = [Locale.SR, Locale.EN] as const;

/** Maps a validation issue path of `toListingInput` output back to the form field path. */
export function formPathFor(path: readonly PropertyKey[]): string | null {
  const [section, second, third] = path;
  if (section === 'texts' && typeof second === 'number' && typeof third === 'string') {
    const locale = TEXT_LOCALES[second];
    return locale ? `texts.${locale}.${third}` : null;
  }
  if (section === 'price' && typeof second === 'string') {
    return second === 'mode' ? 'price.onRequest' : `price.${second}`;
  }
  if (typeof section !== 'string') return null;
  return typeof second === 'string' ? `${section}.${second}` : section;
}

/**
 * The submission snapshot of the current (possibly unsaved) form, so the checklist can use
 * the same rule as the API (`checkSubmissionRequirements`).
 */
export function formSubmissionSnapshot(
  values: ListingFormValues,
  imageCount: number,
): ListingSubmissionSnapshot {
  const input = toListingInput(values);
  const price = input.price!;
  const location = input.location!;
  const attributes = input.attributes!;
  const valid = (value: number | null | undefined) =>
    value === undefined || Number.isNaN(value) ? null : value;
  return {
    propertyType: values.propertyType || null,
    transactionType: values.transactionType || null,
    texts: [{ locale: DEFAULT_LOCALE, ...values.texts[DEFAULT_LOCALE] }],
    location: {
      country: location.country ?? null,
      city: location.city ?? null,
      street: location.street ?? null,
      streetNumber: location.streetNumber ?? null,
      latitude: location.latitude ?? null,
      longitude: location.longitude ?? null,
    },
    attributes: {
      floorArea: valid(attributes.floorArea),
      plotArea: valid(attributes.plotArea),
      bedrooms: valid(attributes.bedrooms),
      bathrooms: valid(attributes.bathrooms),
      floor: valid(attributes.floor),
      totalFloors: valid(attributes.totalFloors),
    },
    price:
      price.mode === PriceMode.FIXED
        ? {
            mode: PriceMode.FIXED,
            amountMinor: Number.isFinite(price.amount)
              ? toMinorUnits(price.amount, price.currency)
              : 0,
            currency: price.currency,
            period: price.period,
            negotiable: price.negotiable,
          }
        : price,
    imageCount,
  };
}
