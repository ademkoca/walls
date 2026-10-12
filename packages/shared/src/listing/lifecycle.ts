import { ListingStatus, TransactionType } from '../enums';

/** Status-changing actions on a listing (SPEC §6). */
export const ListingAction = {
  /** Creator/editor sends a draft for review. */
  SUBMIT: 'SUBMIT',
  /** Creator/editor reopens a rejected listing as a draft to revise it. */
  REVISE: 'REVISE',
  APPROVE: 'APPROVE',
  /** Requires a rejection reason. */
  REJECT: 'REJECT',
  MARK_SOLD: 'MARK_SOLD',
  MARK_RENTED: 'MARK_RENTED',
  ARCHIVE: 'ARCHIVE',
} as const;
export type ListingAction = (typeof ListingAction)[keyof typeof ListingAction];

/** Who may perform an action, relative to the listing. */
export const ListingActorKind = {
  /** The listing's creator or assigned agent. */
  EDITOR: 'EDITOR',
  /** An Admin or Super Admin. */
  REVIEWER: 'REVIEWER',
} as const;
export type ListingActorKind = (typeof ListingActorKind)[keyof typeof ListingActorKind];

interface TransitionRule {
  from: readonly ListingStatus[];
  to: ListingStatus;
  performedBy: ListingActorKind;
  /** Restricts the action to listings of this transaction type. */
  transactionType?: TransactionType;
}

const { DRAFT, PENDING_REVIEW, PUBLISHED, REJECTED, SOLD, RENTED, ARCHIVED } = ListingStatus;

export const LISTING_TRANSITIONS: Readonly<Record<ListingAction, TransitionRule>> = {
  SUBMIT: { from: [DRAFT], to: PENDING_REVIEW, performedBy: ListingActorKind.EDITOR },
  REVISE: { from: [REJECTED], to: DRAFT, performedBy: ListingActorKind.EDITOR },
  APPROVE: { from: [PENDING_REVIEW], to: PUBLISHED, performedBy: ListingActorKind.REVIEWER },
  REJECT: { from: [PENDING_REVIEW], to: REJECTED, performedBy: ListingActorKind.REVIEWER },
  // A sale listing can only be sold and a rental listing can only be rented.
  MARK_SOLD: {
    from: [PUBLISHED],
    to: SOLD,
    performedBy: ListingActorKind.REVIEWER,
    transactionType: TransactionType.SALE,
  },
  MARK_RENTED: {
    from: [PUBLISHED],
    to: RENTED,
    performedBy: ListingActorKind.REVIEWER,
    transactionType: TransactionType.RENT,
  },
  ARCHIVE: {
    from: [PUBLISHED, SOLD, RENTED],
    to: ARCHIVED,
    performedBy: ListingActorKind.REVIEWER,
  },
};

/** Statuses visible to anonymous visitors (SPEC §46). */
export const PUBLIC_LISTING_STATUSES: readonly ListingStatus[] = [PUBLISHED];

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
