import { DEFAULT_LOCALE, type Locale, PropertyType, type TransactionType } from '../enums';
import { LISTING_IMAGE_RULES } from '../media/image-rules';
import { type Price, type PriceIssue, checkPrice } from '../pricing/price';

/** Numeric property attributes that can be required for submission. */
export interface SubmissionAttributes {
  /** Usable floor area in m². */
  floorArea: number | null;
  /** Plot (land) area in m². */
  plotArea: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  /** Floor the unit is on; 0 is the ground floor, negative values are below ground. */
  floor: number | null;
  totalFloors: number | null;
}
export type SubmissionAttributeKey = keyof SubmissionAttributes;

/** The listing data needed to decide whether it can be submitted for review. */
export interface ListingSubmissionSnapshot {
  propertyType: PropertyType | null;
  transactionType: TransactionType | null;
  texts: readonly { locale: Locale; title: string; description: string }[];
  location: {
    country: string | null;
    city: string | null;
    street: string | null;
    streetNumber: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  attributes: SubmissionAttributes;
  price: Price;
  /** Number of stored listing images; every stored image already passed upload validation. */
  imageCount: number;
}

const { APARTMENT, HOUSE, VILLA, OFFICE, RETAIL, WAREHOUSE, LAND, GARAGE, OTHER } = PropertyType;

/** Attributes required for submission, per property type (SPEC §39). */
export const REQUIRED_ATTRIBUTES: Readonly<
  Record<PropertyType, readonly SubmissionAttributeKey[]>
> = {
  [APARTMENT]: ['floorArea', 'bedrooms', 'bathrooms', 'floor', 'totalFloors'],
  [HOUSE]: ['floorArea', 'bedrooms', 'bathrooms'],
  [VILLA]: ['floorArea', 'bedrooms', 'bathrooms'],
  [OFFICE]: ['floorArea'],
  [RETAIL]: ['floorArea'],
  [WAREHOUSE]: ['floorArea'],
  [GARAGE]: ['floorArea'],
  [OTHER]: ['floorArea'],
  [LAND]: ['plotArea'],
};

export const SubmissionIssueCode = {
  REQUIRED: 'REQUIRED',
  TOO_FEW_IMAGES: 'TOO_FEW_IMAGES',
  FLOOR_ABOVE_TOTAL_FLOORS: 'FLOOR_ABOVE_TOTAL_FLOORS',
  INVALID_PRICE: 'INVALID_PRICE',
} as const;
export type SubmissionIssueCode = (typeof SubmissionIssueCode)[keyof typeof SubmissionIssueCode];

export type SubmissionField =
  | 'propertyType'
  | 'transactionType'
  | 'title'
  | 'description'
  | `location.${keyof ListingSubmissionSnapshot['location']}`
  | `attributes.${SubmissionAttributeKey}`
  | 'price'
  | 'images';

export type SubmissionIssue =
  | { code: Exclude<SubmissionIssueCode, 'INVALID_PRICE'>; field: SubmissionField }
  | { code: typeof SubmissionIssueCode.INVALID_PRICE; field: 'price'; priceIssue: PriceIssue };

const isBlank = (value: string | null | undefined): boolean => !value || value.trim() === '';

const required = (field: SubmissionField): SubmissionIssue => ({
  code: SubmissionIssueCode.REQUIRED,
  field,
});

/**
 * Lists everything that prevents the listing from being submitted for review; an empty
 * list means the content requirements are met. Who may submit is a separate check
 * (`canPerformListingAction`).
 */
export function checkSubmissionRequirements(listing: ListingSubmissionSnapshot): SubmissionIssue[] {
  const issues: SubmissionIssue[] = [];

  if (!listing.propertyType) issues.push(required('propertyType'));
  if (!listing.transactionType) issues.push(required('transactionType'));

  const defaultText = listing.texts.find((text) => text.locale === DEFAULT_LOCALE);
  if (isBlank(defaultText?.title)) issues.push(required('title'));
  if (isBlank(defaultText?.description)) issues.push(required('description'));

  const { location } = listing;
  for (const key of ['country', 'city', 'street', 'streetNumber'] as const) {
    if (isBlank(location[key])) issues.push(required(`location.${key}`));
  }
  for (const key of ['latitude', 'longitude'] as const) {
    if (location[key] === null) issues.push(required(`location.${key}`));
  }

  if (listing.propertyType) {
    for (const key of REQUIRED_ATTRIBUTES[listing.propertyType]) {
      if (listing.attributes[key] === null) issues.push(required(`attributes.${key}`));
    }
  }
  const { floor, totalFloors } = listing.attributes;
  if (floor !== null && totalFloors !== null && floor > totalFloors) {
    issues.push({ code: SubmissionIssueCode.FLOOR_ABOVE_TOTAL_FLOORS, field: 'attributes.floor' });
  }

  if (listing.transactionType) {
    for (const priceIssue of checkPrice(listing.price, listing.transactionType)) {
      issues.push({ code: SubmissionIssueCode.INVALID_PRICE, field: 'price', priceIssue });
    }
  }

  if (listing.imageCount < LISTING_IMAGE_RULES.minImagesForSubmission) {
    issues.push({ code: SubmissionIssueCode.TOO_FEW_IMAGES, field: 'images' });
  }

  return issues;
}
