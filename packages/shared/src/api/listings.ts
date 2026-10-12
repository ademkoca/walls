import type {
  Currency,
  FurnishedStatus,
  HeatingType,
  ListingStatus,
  Locale,
  PropertyType,
  RentalPeriod,
  SellerType,
  TransactionType,
} from '../enums';
import type { ListingAction } from '../listing/lifecycle';
import type { ListingEditMode } from '../listing/permissions';
import type { SubmissionIssue } from '../listing/submission';
import type { PriceMode } from '../pricing/price';

/** Listing shapes returned by the dashboard listing endpoints. Dates are ISO 8601 strings. */

export interface ListingText {
  locale: Locale;
  title: string;
  description: string;
}

export interface ListingLocationView {
  country: string | null;
  city: string | null;
  municipality: string | null;
  neighborhood: string | null;
  street: string | null;
  streetNumber: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface PropertyAttributesView {
  floorArea: number | null;
  plotArea: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  totalFloors: number | null;
  yearBuilt: number | null;
  parkingSpaces: number | null;
  heatingType: HeatingType | null;
  furnishedStatus: FurnishedStatus | null;
}

/** Price in major units (e.g. 1200.5), as entered; the API stores minor units. */
export type PriceView =
  | { mode: typeof PriceMode.ON_REQUEST }
  | {
      mode: typeof PriceMode.FIXED;
      amount: number;
      currency: Currency;
      period: RentalPeriod | null;
      negotiable: boolean;
    };

export interface ListingImage {
  id: string;
  url: string;
  isPrimary: boolean;
  width: number | null;
  height: number | null;
}

/** What the current user may do with the listing, decided by the server's policies. */
export interface ListingPermissions {
  /** Null when the listing cannot be edited now (in review, rejected, sold, …). */
  editMode: ListingEditMode | null;
  canDelete: boolean;
  actions: ListingAction[];
}

export interface ListingSummary {
  id: string;
  status: ListingStatus;
  propertyType: PropertyType | null;
  transactionType: TransactionType | null;
  /** Serbian title, or null while it is empty. */
  title: string | null;
  city: string | null;
  coverImageUrl: string | null;
  imageCount: number;
  updatedAt: string;
}

export interface ListingDetail {
  id: string;
  status: ListingStatus;
  sellerType: SellerType;
  propertyType: PropertyType | null;
  transactionType: TransactionType | null;
  texts: ListingText[];
  location: ListingLocationView;
  attributes: PropertyAttributesView;
  amenityCodes: string[];
  price: PriceView;
  isExactAddressPublic: boolean;
  /** Latest rejection reason; shown while the listing is rejected or revised. */
  rejectionReason: string | null;
  /** In display order; the cover image has `isPrimary`. */
  images: ListingImage[];
  permissions: ListingPermissions;
  /** What still blocks submission for review; empty when the listing can be submitted. */
  submissionIssues: SubmissionIssue[];
  createdAt: string;
  updatedAt: string;
}
