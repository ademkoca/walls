/** Groups of listing content that an edit can change. */
export const ListingField = {
  PROPERTY_TYPE: 'PROPERTY_TYPE',
  TRANSACTION_TYPE: 'TRANSACTION_TYPE',
  /** Title and description in any locale. */
  TEXT: 'TEXT',
  LOCATION: 'LOCATION',
  ATTRIBUTES: 'ATTRIBUTES',
  AMENITIES: 'AMENITIES',
  /** Adding images. Removing approved ones applies immediately. */
  IMAGES_ADDED: 'IMAGES_ADDED',
  /** Reordering already-approved media or changing the cover image. */
  MEDIA_ORDER: 'MEDIA_ORDER',
  /** Amount, currency, rental period, negotiable flag, or switching to/from "on request". */
  PRICE: 'PRICE',
  EXACT_ADDRESS_VISIBILITY: 'EXACT_ADDRESS_VISIBILITY',
} as const;
export type ListingField = (typeof ListingField)[keyof typeof ListingField];

/**
 * Changes to a published listing that wait for Admin/Super Admin review: the title and
 * description, and new images (SPEC §6, decision 2026-10-30). Everything else applies at once.
 */
const REVIEWED_FIELDS: ReadonlySet<ListingField> = new Set([
  ListingField.TEXT,
  ListingField.IMAGES_ADDED,
]);

export interface PublishedEditPlan {
  /** Applied to the live listing right away (and audited). */
  immediate: ListingField[];
  /** Saved as a pending revision for Admin/Super Admin review. */
  requiresReview: ListingField[];
}

/** Splits an edit to a published listing into changes that apply now and changes that need review. */
export function planPublishedEdit(changedFields: readonly ListingField[]): PublishedEditPlan {
  const fields = [...new Set(changedFields)];
  return {
    immediate: fields.filter((field) => !REVIEWED_FIELDS.has(field)),
    requiresReview: fields.filter((field) => REVIEWED_FIELDS.has(field)),
  };
}
