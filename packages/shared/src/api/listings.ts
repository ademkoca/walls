import type {
  Currency,
  FurnishedStatus,
  HeatingType,
  ListingStatus,
  Locale,
  PropertyType,
  RentalPeriod,
  ReviewStatus,
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
  /** False for images added by a pending revision (not public until it is approved). */
  approved: boolean;
  width: number | null;
  height: number | null;
}

/** A user shown next to a listing (creator, assigned agent). */
export interface UserReference {
  id: string;
  displayName: string;
}

/** What the current user may do with the listing, decided by the server's policies. */
export interface ListingPermissions {
  /** Null when the listing cannot be edited now (in review, rejected, sold, …). */
  editMode: ListingEditMode | null;
  /** Soft-deleting a draft (creator only). */
  canDelete: boolean;
  /** Lifecycle actions: SUBMIT/REVISE for editors, APPROVE/REJECT/… for reviewers. */
  actions: ListingAction[];
  canAssignAgent: boolean;
  canSetFeatured: boolean;
  canPermanentlyDelete: boolean;
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
  creator: UserReference;
  isFeatured: boolean;
  /** A published listing with major edits waiting for review. */
  hasPendingRevision: boolean;
  updatedAt: string;
}

/** The editable content of a listing (live or proposed by a revision). */
export interface ListingContentView {
  propertyType: PropertyType | null;
  transactionType: TransactionType | null;
  texts: ListingText[];
  location: ListingLocationView;
  attributes: PropertyAttributesView;
  amenityCodes: string[];
  price: PriceView;
  isExactAddressPublic: boolean;
}

/**
 * Major edits of a published listing (SPEC §6): pending review, or the latest rejected one
 * so its editors can see the reason.
 */
export interface ListingRevisionView {
  id: string;
  status: typeof ReviewStatus.PENDING | typeof ReviewStatus.REJECTED;
  content: ListingContentView;
  /** Approved images the revision removes. Added images are those with `approved: false`. */
  removedImageIds: string[];
  rejectionReason: string | null;
  updatedAt: string;
}

export interface ListingDetail {
  id: string;
  status: ListingStatus;
  sellerType: SellerType;
  creator: UserReference;
  assignedAgent: UserReference | null;
  /** Assigned at first publication; null before. */
  slug: string | null;
  publishedAt: string | null;
  isFeatured: boolean;
  featuredUntil: string | null;
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
  revision: ListingRevisionView | null;
  permissions: ListingPermissions;
  /**
   * What still blocks submission for review (drafts) or saving major edits (published
   * listings, checked on the proposed version); empty when nothing is missing.
   */
  submissionIssues: SubmissionIssue[];
  createdAt: string;
  updatedAt: string;
}
