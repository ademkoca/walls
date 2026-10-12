import {
  Currency,
  FurnishedStatus,
  HeatingType,
  LISTING_IMAGE_RULES,
  Locale,
  PriceMode,
  PropertyType,
  RentalPeriod,
  TransactionType,
  enumValues,
} from '@walls/shared';
import { z } from 'zod';
import { reasonSchema } from './common';

/**
 * Technical input limits. Business requirements for submission (which fields are required)
 * live in `@walls/shared` (`checkSubmissionRequirements`); these schemas validate shape and
 * ranges so that drafts can be saved incomplete.
 */
export const LISTING_INPUT_LIMITS = {
  titleMaxLength: 150,
  descriptionMaxLength: 10_000,
  cityMaxLength: 100,
  areaNameMaxLength: 100,
  streetMaxLength: 150,
  streetNumberMaxLength: 20,
  postalCodeMaxLength: 10,
  maxAreaM2: 10_000_000,
  maxRooms: 100,
  minFloor: -5,
  maxFloor: 200,
  minYearBuilt: 1800,
  maxYearBuiltAhead: 10,
  maxParkingSpaces: 1000,
  maxPriceAmount: 10_000_000_000,
  priceDecimals: 2,
  maxAmenities: 50,
} as const;

const L = LISTING_INPUT_LIMITS;
const PRICE_SCALE = 10 ** L.priceDecimals;
/** Tolerance for floating-point representation when checking decimal places. */
const DECIMAL_EPSILON = 1e-6;

const trimmed = (max: number) => z.string().trim().max(max);
const optionalNullable = <T extends z.ZodType>(schema: T) => schema.nullable().optional();

export const listingTextInputSchema = z.strictObject({
  locale: z.enum(enumValues(Locale)),
  title: trimmed(L.titleMaxLength),
  description: trimmed(L.descriptionMaxLength),
});

/** ISO 3166-1 alpha-2 country code, e.g. "RS". */
export const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Expected a two-letter country code');

export const listingLocationInputSchema = z.strictObject({
  country: optionalNullable(countryCodeSchema),
  city: optionalNullable(trimmed(L.cityMaxLength)),
  municipality: optionalNullable(trimmed(L.areaNameMaxLength)),
  neighborhood: optionalNullable(trimmed(L.areaNameMaxLength)),
  street: optionalNullable(trimmed(L.streetMaxLength)),
  /** Text, because Serbian addresses use forms like "12a" and "bb" (bez broja). */
  streetNumber: optionalNullable(trimmed(L.streetNumberMaxLength)),
  postalCode: optionalNullable(trimmed(L.postalCodeMaxLength)),
  latitude: optionalNullable(z.number().min(-90).max(90)),
  longitude: optionalNullable(z.number().min(-180).max(180)),
});

const area = z.number().positive().max(L.maxAreaM2);
const roomCount = z.number().int().min(0).max(L.maxRooms);

export const propertyAttributesInputSchema = z
  .strictObject({
    floorArea: optionalNullable(area),
    plotArea: optionalNullable(area),
    bedrooms: optionalNullable(roomCount),
    bathrooms: optionalNullable(roomCount),
    floor: optionalNullable(z.number().int().min(L.minFloor).max(L.maxFloor)),
    totalFloors: optionalNullable(z.number().int().min(1).max(L.maxFloor)),
    yearBuilt: optionalNullable(
      z
        .number()
        .int()
        .min(L.minYearBuilt)
        .refine((year) => year <= new Date().getFullYear() + L.maxYearBuiltAhead, {
          message: 'Year built is too far in the future',
        }),
    ),
    parkingSpaces: optionalNullable(z.number().int().min(0).max(L.maxParkingSpaces)),
    heatingType: optionalNullable(z.enum(enumValues(HeatingType))),
    furnishedStatus: optionalNullable(z.enum(enumValues(FurnishedStatus))),
  })
  .refine(
    ({ floor, totalFloors }) => floor == null || totalFloors == null || floor <= totalFloors,
    { message: 'Floor cannot be above the total number of floors', path: ['floor'] },
  );

const hasAtMostPriceDecimals = (amount: number) =>
  Math.abs(Math.round(amount * PRICE_SCALE) - amount * PRICE_SCALE) < DECIMAL_EPSILON;

/** Amount in major units (e.g. 1200.50). Converted to minor units by the API. */
export const priceAmountSchema = z
  .number()
  .positive()
  .max(L.maxPriceAmount)
  .refine(hasAtMostPriceDecimals, { message: `At most ${L.priceDecimals} decimal places` });

/**
 * Either a fixed price or "price on request" — never both (SPEC §11). The form's switch
 * maps directly to `mode`; the strict "on request" variant rejects a stray amount.
 */
export const priceInputSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal(PriceMode.ON_REQUEST) }),
  z.strictObject({
    mode: z.literal(PriceMode.FIXED),
    amount: priceAmountSchema,
    currency: z.enum(enumValues(Currency)),
    period: z.enum(enumValues(RentalPeriod)).nullable(),
    negotiable: z.boolean(),
  }),
]);
export type PriceInput = z.infer<typeof priceInputSchema>;

/** Stable amenity code, e.g. "AIR_CONDITIONING". */
export const amenityCodeSchema = z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'Invalid amenity code');

/**
 * Creating or updating a listing as an editor. Every field is optional so drafts can be
 * saved incomplete. Ownership, seller type, status and agent assignment are deliberately
 * absent: they are derived server-side, and strict parsing rejects them if sent.
 */
export const listingInputSchema = z
  .strictObject({
    propertyType: z.enum(enumValues(PropertyType)).optional(),
    transactionType: z.enum(enumValues(TransactionType)).optional(),
    texts: z
      .array(listingTextInputSchema)
      .max(enumValues(Locale).length)
      .refine((texts) => new Set(texts.map((text) => text.locale)).size === texts.length, {
        message: 'Each locale may appear only once',
      })
      .optional(),
    location: listingLocationInputSchema.optional(),
    attributes: propertyAttributesInputSchema.optional(),
    amenityCodes: z
      .array(amenityCodeSchema)
      .max(L.maxAmenities)
      .refine((codes) => new Set(codes).size === codes.length, { message: 'Duplicate amenity' })
      .optional(),
    price: priceInputSchema.optional(),
    /** Hidden by default (SPEC §13); the UI confirms before setting this to true. */
    isExactAddressPublic: z.boolean().optional(),
  })
  .superRefine((input, ctx) => {
    const { price, transactionType } = input;
    if (price?.mode !== PriceMode.FIXED || !transactionType) return;
    if (transactionType === TransactionType.RENT && price.period === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'Rental period is required',
        path: ['price', 'period'],
      });
    }
    if (transactionType === TransactionType.SALE && price.period !== null) {
      ctx.addIssue({
        code: 'custom',
        message: 'Sale listings have no rental period',
        path: ['price', 'period'],
      });
    }
  });
export type ListingInput = z.infer<typeof listingInputSchema>;

/** Rejecting a listing in review always needs a reason (SPEC §6). */
export const rejectListingInputSchema = z.strictObject({
  reason: reasonSchema,
});
export type RejectListingInput = z.infer<typeof rejectListingInputSchema>;

/** Route parameter identifying a listing or media item. */
export const idParamSchema = z.uuid();

/**
 * New order of a listing's images, first to last, and the cover image. Must list every
 * current image exactly once (checked by the API against the stored images).
 */
export const mediaOrderInputSchema = z
  .strictObject({
    mediaIds: z
      .array(z.uuid())
      .min(1)
      .max(LISTING_IMAGE_RULES.maxImagesPerListing)
      .refine((ids) => new Set(ids).size === ids.length, { message: 'Duplicate image' }),
    primaryMediaId: z.uuid(),
  })
  .refine(({ mediaIds, primaryMediaId }) => mediaIds.includes(primaryMediaId), {
    message: 'The cover image must be one of the listed images',
    path: ['primaryMediaId'],
  });
export type MediaOrderInput = z.infer<typeof mediaOrderInputSchema>;
