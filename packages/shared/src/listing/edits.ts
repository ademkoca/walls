/** Groups of listing content that an edit can change. */
export const ListingField = {
  PROPERTY_TYPE: 'PROPERTY_TYPE',
  TRANSACTION_TYPE: 'TRANSACTION_TYPE',
  /** Title and description in any locale. */
  TEXT: 'TEXT',
  LOCATION: 'LOCATION',
  ATTRIBUTES: 'ATTRIBUTES',
  AMENITIES: 'AMENITIES',
  /** Adding or removing media. */
  MEDIA_SET: 'MEDIA_SET',
  /** Reordering already-approved media or changing the cover image. */
  MEDIA_ORDER: 'MEDIA_ORDER',
  /** Amount, currency, rental period, negotiable flag, or switching to/from "on request". */
  PRICE: 'PRICE',
  EXACT_ADDRESS_VISIBILITY: 'EXACT_ADDRESS_VISIBILITY',
} as const;
export type ListingField = (typeof ListingField)[keyof typeof ListingField];

/** Changes to a published listing that apply immediately, without review (SPEC §6). */
const MINOR_FIELDS: ReadonlySet<ListingField> = new Set([
  ListingField.PRICE,
  ListingField.EXACT_ADDRESS_VISIBILITY,
  ListingField.MEDIA_ORDER,
]);

export interface PublishedEditPlan {
  /** Applied to the live listing right away (and audited). */
  immediate: ListingField[];
  /** Saved as a pending revision for Admin/Super Admin review. */
  requiresReview: ListingField[];
}

/**
 * Splits an edit to a published listing into changes that apply now and changes that need review.
 *
 * A price change travels with a transaction-type change into review, because the valid
 * price shape (rental period or not) depends on the transaction type.
 */
export function planPublishedEdit(changedFields: readonly ListingField[]): PublishedEditPlan {
  const fields = [...new Set(changedFields)];
  const requiresReview = fields.filter((field) => !MINOR_FIELDS.has(field));
  const priceFollowsTransactionType =
    requiresReview.includes(ListingField.TRANSACTION_TYPE) && fields.includes(ListingField.PRICE);

  if (priceFollowsTransactionType) requiresReview.push(ListingField.PRICE);

  return {
    immediate: fields.filter((field) => !requiresReview.includes(field)),
    requiresReview,
  };
}
