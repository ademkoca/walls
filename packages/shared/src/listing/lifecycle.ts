import { ListingStatus, TransactionType, UserStatus } from '../enums';

/** Status-changing actions on a listing (SPEC §6). */
export const ListingAction = {
  /** The creator sends a draft for review. */
  SUBMIT: 'SUBMIT',
  /** The creator reopens a rejected listing as a draft to revise it. */
  REVISE: 'REVISE',
  APPROVE: 'APPROVE',
  /** Requires a rejection reason. */
  REJECT: 'REJECT',
  MARK_SOLD: 'MARK_SOLD',
  MARK_RENTED: 'MARK_RENTED',
  ARCHIVE: 'ARCHIVE',
  /** A sold or rented listing goes back on the market, e.g. when a sale falls through. */
  REOPEN: 'REOPEN',
  /** Straight back to published, without another review (decision 2026-10-30). */
  UNARCHIVE: 'UNARCHIVE',
} as const;
export type ListingAction = (typeof ListingAction)[keyof typeof ListingAction];

/** Who may perform an action, relative to the listing. */
export const ListingActorKind = {
  /** The listing's creator. */
  CREATOR: 'CREATOR',
  /** An Admin or Super Admin. */
  REVIEWER: 'REVIEWER',
} as const;
export type ListingActorKind = (typeof ListingActorKind)[keyof typeof ListingActorKind];

interface TransitionRule {
  from: readonly ListingStatus[];
  to: ListingStatus;
  performedBy: readonly ListingActorKind[];
  /** Restricts the action to listings of this transaction type. */
  transactionType?: TransactionType;
}

const { DRAFT, PENDING_REVIEW, PUBLISHED, REJECTED, SOLD, RENTED, ARCHIVED } = ListingStatus;

const CREATOR_ONLY = [ListingActorKind.CREATOR] as const;
const REVIEWER_ONLY = [ListingActorKind.REVIEWER] as const;
/** The end of a listing's life is managed by its creator as well as by reviewers. */
const CREATOR_OR_REVIEWER = [ListingActorKind.CREATOR, ListingActorKind.REVIEWER] as const;

export const LISTING_TRANSITIONS: Readonly<Record<ListingAction, TransitionRule>> = {
  SUBMIT: { from: [DRAFT], to: PENDING_REVIEW, performedBy: CREATOR_ONLY },
  REVISE: { from: [REJECTED], to: DRAFT, performedBy: CREATOR_ONLY },
  APPROVE: { from: [PENDING_REVIEW], to: PUBLISHED, performedBy: REVIEWER_ONLY },
  REJECT: { from: [PENDING_REVIEW], to: REJECTED, performedBy: REVIEWER_ONLY },
  // A sale listing can only be sold and a rental listing can only be rented.
  MARK_SOLD: {
    from: [PUBLISHED],
    to: SOLD,
    performedBy: CREATOR_OR_REVIEWER,
    transactionType: TransactionType.SALE,
  },
  MARK_RENTED: {
    from: [PUBLISHED],
    to: RENTED,
    performedBy: CREATOR_OR_REVIEWER,
    transactionType: TransactionType.RENT,
  },
  ARCHIVE: { from: [PUBLISHED, SOLD, RENTED], to: ARCHIVED, performedBy: CREATOR_OR_REVIEWER },
  REOPEN: { from: [SOLD, RENTED], to: PUBLISHED, performedBy: CREATOR_OR_REVIEWER },
  // The creator may not unarchive a listing a reviewer archived (`canPerformListingAction`).
  UNARCHIVE: { from: [ARCHIVED], to: PUBLISHED, performedBy: CREATOR_OR_REVIEWER },
};

/** Statuses visible to anonymous visitors (SPEC §46). */
export const PUBLIC_LISTING_STATUSES: readonly ListingStatus[] = [PUBLISHED];

/**
 * Whether visitors can see the listing: published, and its creator's account is not
 * deactivated (SPEC §2.1: a deactivated user's listings are hidden until reactivation).
 */
export function isListingPubliclyVisible(
  listing: { status: ListingStatus; deletedAt: Date | null },
  creatorStatus: UserStatus,
): boolean {
  return (
    PUBLIC_LISTING_STATUSES.includes(listing.status) &&
    listing.deletedAt === null &&
    creatorStatus !== UserStatus.DEACTIVATED
  );
}

/** Whether the state machine permits `action` from `status`, ignoring who performs it. */
export function isTransitionValid(
  action: ListingAction,
  status: ListingStatus,
  transactionType: TransactionType | null,
): boolean {
  const rule = LISTING_TRANSITIONS[action];
  if (!rule.from.includes(status)) return false;
  return rule.transactionType === undefined || rule.transactionType === transactionType;
}

export function nextStatus(action: ListingAction): ListingStatus {
  return LISTING_TRANSITIONS[action].to;
}
