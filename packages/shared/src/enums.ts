/**
 * Stable internal identifiers for domain values (SPEC §31). Business logic uses these
 * values; user-facing labels come from translation files.
 *
 * Each enum is a frozen object (for `Role.ADMIN`-style access without magic strings)
 * plus a union type of its values.
 */

type ValueOf<T> = T[keyof T];

export const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  REAL_ESTATE_AGENT: 'REAL_ESTATE_AGENT',
  PRIVATE_SELLER: 'PRIVATE_SELLER',
} as const;
export type Role = ValueOf<typeof Role>;

export const UserStatus = {
  /** Registered private seller who has not verified their email yet. */
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  /** Approved agent or invited admin who has not completed account setup yet. */
  PENDING_SETUP: 'PENDING_SETUP',
  ACTIVE: 'ACTIVE',
  DEACTIVATED: 'DEACTIVATED',
} as const;
export type UserStatus = ValueOf<typeof UserStatus>;

/**
 * What kind of advertiser a user is, and so who advertises a listing (SPEC §5). Agents,
 * agencies and investors are approved professionals: all three have the `REAL_ESTATE_AGENT`
 * role, which decides their permissions.
 */
export const SellerType = {
  PRIVATE_SELLER: 'PRIVATE_SELLER',
  REAL_ESTATE_AGENT: 'REAL_ESTATE_AGENT',
  AGENCY: 'AGENCY',
  INVESTOR: 'INVESTOR',
} as const;
export type SellerType = ValueOf<typeof SellerType>;

export const ListingStatus = {
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  PUBLISHED: 'PUBLISHED',
  REJECTED: 'REJECTED',
  SOLD: 'SOLD',
  RENTED: 'RENTED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type ListingStatus = ValueOf<typeof ListingStatus>;

export const TransactionType = {
  SALE: 'SALE',
  RENT: 'RENT',
} as const;
export type TransactionType = ValueOf<typeof TransactionType>;

export const PropertyType = {
  APARTMENT: 'APARTMENT',
  HOUSE: 'HOUSE',
  VILLA: 'VILLA',
  OFFICE: 'OFFICE',
  RETAIL: 'RETAIL',
  WAREHOUSE: 'WAREHOUSE',
  LAND: 'LAND',
  GARAGE: 'GARAGE',
  OTHER: 'OTHER',
} as const;
export type PropertyType = ValueOf<typeof PropertyType>;

/** Main heating system (SPEC §10). Serbian listings commonly abbreviate these as CG, EG, TA. */
export const HeatingType = {
  /** District heating ("centralno grejanje", CG). */
  DISTRICT: 'DISTRICT',
  /** Central heating for a single unit or building, e.g. a gas boiler ("etažno grejanje", EG). */
  INDIVIDUAL_CENTRAL: 'INDIVIDUAL_CENTRAL',
  /** Electric radiators or heaters. */
  ELECTRIC: 'ELECTRIC',
  GAS: 'GAS',
  /** Electric storage heaters ("TA peći"). */
  STORAGE_HEATERS: 'STORAGE_HEATERS',
  UNDERFLOOR: 'UNDERFLOOR',
  HEAT_PUMP: 'HEAT_PUMP',
  /** Wood, coal or pellets. */
  SOLID_FUEL: 'SOLID_FUEL',
  OTHER: 'OTHER',
  NONE: 'NONE',
} as const;
export type HeatingType = ValueOf<typeof HeatingType>;

export const FurnishedStatus = {
  FURNISHED: 'FURNISHED',
  SEMI_FURNISHED: 'SEMI_FURNISHED',
  UNFURNISHED: 'UNFURNISHED',
} as const;
export type FurnishedStatus = ValueOf<typeof FurnishedStatus>;

export const Currency = {
  EUR: 'EUR',
  RSD: 'RSD',
} as const;
export type Currency = ValueOf<typeof Currency>;

export const RentalPeriod = {
  DAY: 'DAY',
  WEEK: 'WEEK',
  MONTH: 'MONTH',
} as const;
export type RentalPeriod = ValueOf<typeof RentalPeriod>;

export const InquiryStatus = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  CLOSED: 'CLOSED',
} as const;
export type InquiryStatus = ValueOf<typeof InquiryStatus>;

export const PhoneVerificationStatus = {
  UNVERIFIED: 'UNVERIFIED',
  VERIFIED: 'VERIFIED',
} as const;
export type PhoneVerificationStatus = ValueOf<typeof PhoneVerificationStatus>;

export const MediaType = {
  IMAGE: 'IMAGE',
  FLOOR_PLAN: 'FLOOR_PLAN',
  VIDEO: 'VIDEO',
  VIRTUAL_TOUR: 'VIRTUAL_TOUR',
} as const;
export type MediaType = ValueOf<typeof MediaType>;

/** Review outcome of an agent application or other request needing Admin approval. */
export const ReviewStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type ReviewStatus = ValueOf<typeof ReviewStatus>;

export const Locale = {
  SR: 'sr',
  EN: 'en',
} as const;
export type Locale = ValueOf<typeof Locale>;

/** Serbian is the default locale and the one required for listing text (SPEC §31). */
export const DEFAULT_LOCALE: Locale = Locale.SR;

/** Returns the values of an enum object as a non-empty tuple (for Zod `z.enum`). */
export function enumValues<T extends Record<string, string>>(
  enumObject: T,
): [ValueOf<T>, ...ValueOf<T>[]] {
  return Object.values(enumObject) as [ValueOf<T>, ...ValueOf<T>[]];
}
