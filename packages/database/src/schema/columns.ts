import {
  Currency,
  FurnishedStatus,
  HeatingType,
  InquiryStatus,
  ListingStatus,
  Locale,
  MediaType,
  PhoneVerificationStatus,
  PriceMode,
  PropertyType,
  RentalPeriod,
  ReviewStatus,
  Role,
  SellerType,
  TransactionType,
  UserStatus,
  enumValues,
} from '@walls/shared';
import { customType, pgEnum, timestamp, uuid } from 'drizzle-orm/pg-core';

// Postgres enum types, generated from the stable domain identifiers in @walls/shared.
export const roleEnum = pgEnum('role', enumValues(Role));
export const userStatusEnum = pgEnum('user_status', enumValues(UserStatus));
export const sellerTypeEnum = pgEnum('seller_type', enumValues(SellerType));
export const listingStatusEnum = pgEnum('listing_status', enumValues(ListingStatus));
export const transactionTypeEnum = pgEnum('transaction_type', enumValues(TransactionType));
export const propertyTypeEnum = pgEnum('property_type', enumValues(PropertyType));
export const heatingTypeEnum = pgEnum('heating_type', enumValues(HeatingType));
export const furnishedStatusEnum = pgEnum('furnished_status', enumValues(FurnishedStatus));
export const currencyEnum = pgEnum('currency', enumValues(Currency));
export const rentalPeriodEnum = pgEnum('rental_period', enumValues(RentalPeriod));
export const priceModeEnum = pgEnum('price_mode', enumValues(PriceMode));
export const inquiryStatusEnum = pgEnum('inquiry_status', enumValues(InquiryStatus));
export const phoneVerificationStatusEnum = pgEnum(
  'phone_verification_status',
  enumValues(PhoneVerificationStatus),
);
export const mediaTypeEnum = pgEnum('media_type', enumValues(MediaType));
export const reviewStatusEnum = pgEnum('review_status', enumValues(ReviewStatus));
export const localeEnum = pgEnum('locale', enumValues(Locale));

/** Case-insensitive text (Postgres `citext` extension), used for email addresses. */
export const citext = customType<{ data: string }>({
  dataType: () => 'citext',
});

export const id = () => uuid().primaryKey().defaultRandom();

export const timestamptz = () => timestamp({ withTimezone: true, mode: 'date' });

/** `created_at` / `updated_at` columns; `updated_at` is refreshed on every Drizzle update. */
export const timestamps = () => ({
  createdAt: timestamptz().notNull().defaultNow(),
  updatedAt: timestamptz()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
