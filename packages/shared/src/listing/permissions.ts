import {
  type Actor,
  type Decision,
  DenialReason,
  allow,
  deny,
  firstDenial,
  isReviewer,
  requireActive,
} from '../access/decision';
import { ListingStatus, Role, type TransactionType } from '../enums';
import { isSellerTypeValidForRole } from '../user/seller-type';
import {
  LISTING_TRANSITIONS,
  ListingAction,
  ListingActorKind,
  isTransitionValid,
} from './lifecycle';

/** The listing fields that access rules depend on, loaded server-side. */
export interface ListingAccessContext {
  createdById: string;
  assignedAgentId: string | null;
  status: ListingStatus;
  transactionType: TransactionType | null;
  /** Set when the creator deleted the draft (soft delete). */
  deletedAt: Date | null;
}

export function isListingCreator(actor: Actor, listing: ListingAccessContext): boolean {
  return listing.createdById === actor.id;
}

export function isAssignedAgent(actor: Actor, listing: ListingAccessContext): boolean {
  return actor.role === Role.REAL_ESTATE_AGENT && listing.assignedAgentId === actor.id;
}

/**
 * Editors manage a listing's content and submit it for review: the creator, plus the
 * assigned agent if there is one. Assignment never removes the creator's access (SPEC §5).
 */
export function isListingEditor(actor: Actor, listing: ListingAccessContext): boolean {
  return isListingCreator(actor, listing) || isAssignedAgent(actor, listing);
}

const notDeleted = (listing: ListingAccessContext) => (): Decision =>
  listing.deletedAt === null ? allow() : deny(DenialReason.RESOURCE_DELETED);

const reviewerOnly = (actor: Actor) => (): Decision =>
  isReviewer(actor) ? allow() : deny(DenialReason.ROLE_NOT_PERMITTED);

const editorOnly = (actor: Actor, listing: ListingAccessContext) => (): Decision =>
  isListingEditor(actor, listing) ? allow() : deny(DenialReason.NOT_RESOURCE_PARTICIPANT);

const inStatus =
  (listing: ListingAccessContext, statuses: readonly ListingStatus[]) => (): Decision =>
    statuses.includes(listing.status) ? allow() : deny(DenialReason.INVALID_STATE);

/**
 * Whether an account advertises listings: private sellers and approved professionals do;
 * Admins and Super Admins have no kind of advertiser (SPEC §2.1).
 */
export function advertisesListings(account: Pick<Actor, 'role' | 'sellerType'>): boolean {
  return account.sellerType !== null && isSellerTypeValidForRole(account.role, account.sellerType);
}

/**
 * Creating a listing: private sellers and approved professionals advertise properties
 * (SPEC §2.1). A new listing's seller type is its creator's stored one, never client input.
 * Admins manage listings but do not create them; like direct content edits by admins, that
 * is an open product question, so it is denied by default.
 */
export function canCreateListing(actor: Actor): Decision {
  return firstDenial(
    () => requireActive(actor),
    () => (advertisesListings(actor) ? allow() : deny(DenialReason.ROLE_NOT_PERMITTED)),
  );
}

/** Viewing a listing in the dashboard (public visibility is a separate rule). */
export function canViewListing(actor: Actor, listing: ListingAccessContext): Decision {
  if (isReviewer(actor)) return requireActive(actor);
  return firstDenial(() => requireActive(actor), editorOnly(actor, listing), notDeleted(listing));
}

export const ListingEditMode = {
  /** Draft: every change is saved directly. */
  DRAFT: 'DRAFT',
  /** Published: minor changes apply immediately, major ones go to review (see `edits.ts`). */
  PUBLISHED: 'PUBLISHED',
} as const;
export type ListingEditMode = (typeof ListingEditMode)[keyof typeof ListingEditMode];

export type EditDecision =
  { allowed: true; mode: ListingEditMode } | Extract<Decision, { allowed: false }>;

/**
 * Editing listing content. Listings are locked while in review and after they are sold,
 * rented, rejected (revise first) or archived.
 *
 * Admins and Super Admins do not edit listing content directly; whether they should is an
 * open product question (Phase 6), so it is denied by default.
 */
export function canEditListing(actor: Actor, listing: ListingAccessContext): EditDecision {
  const decision = firstDenial(
    () => requireActive(actor),
    editorOnly(actor, listing),
    notDeleted(listing),
    inStatus(listing, [ListingStatus.DRAFT, ListingStatus.PUBLISHED]),
  );
  if (!decision.allowed) return decision;
  return {
    allowed: true,
    mode:
      listing.status === ListingStatus.DRAFT ? ListingEditMode.DRAFT : ListingEditMode.PUBLISHED,
  };
}

/**
 * Performing a lifecycle action. Submitting also requires a verified email (SPEC §39);
 * the listing's content requirements are checked separately by `checkSubmissionRequirements`.
 */
export function canPerformListingAction(
  actor: Actor,
  listing: ListingAccessContext,
  action: ListingAction,
): Decision {
  const rule = LISTING_TRANSITIONS[action];
  return firstDenial(
    () => requireActive(actor),
    rule.performedBy === ListingActorKind.REVIEWER
      ? reviewerOnly(actor)
      : editorOnly(actor, listing),
    () =>
      action === ListingAction.SUBMIT && !actor.emailVerified
        ? deny(DenialReason.EMAIL_NOT_VERIFIED)
        : allow(),
    notDeleted(listing),
    () =>
      isTransitionValid(action, listing.status, listing.transactionType)
        ? allow()
        : deny(DenialReason.INVALID_STATE),
  );
}

/** Lifecycle actions the actor may perform right now, for rendering action buttons. */
export function availableListingActions(
  actor: Actor,
  listing: ListingAccessContext,
): ListingAction[] {
  return (Object.keys(LISTING_TRANSITIONS) as ListingAction[]).filter(
    (action) => canPerformListingAction(actor, listing, action).allowed,
  );
}

/** Only the creator may delete their own draft; it is a soft delete (SPEC §24). */
export function canDeleteDraft(actor: Actor, listing: ListingAccessContext): Decision {
  return firstDenial(
    () => requireActive(actor),
    () =>
      isListingCreator(actor, listing) ? allow() : deny(DenialReason.NOT_RESOURCE_PARTICIPANT),
    notDeleted(listing),
    inStatus(listing, [ListingStatus.DRAFT]),
  );
}

/** Assigning or unassigning an agent (SPEC §5). The target must be an active agent (checked by the service). */
export function canAssignAgent(actor: Actor, listing: ListingAccessContext): Decision {
  return firstDenial(() => requireActive(actor), reviewerOnly(actor), notDeleted(listing));
}

/** Approving or rejecting the pending major edits of a published listing (SPEC §6). */
export function canReviewRevision(actor: Actor, listing: ListingAccessContext): Decision {
  return firstDenial(
    () => requireActive(actor),
    reviewerOnly(actor),
    notDeleted(listing),
    inStatus(listing, [ListingStatus.PUBLISHED]),
  );
}

/** Featuring only makes sense for listings visitors can see. */
export function canSetFeatured(actor: Actor, listing: ListingAccessContext): Decision {
  return firstDenial(
    () => requireActive(actor),
    reviewerOnly(actor),
    notDeleted(listing),
    inStatus(listing, [ListingStatus.PUBLISHED]),
  );
}

/** Only Super Admins may permanently delete, and only archived listings (SPEC §24). */
export function canPermanentlyDeleteListing(actor: Actor, listing: ListingAccessContext): Decision {
  return firstDenial(
    () => requireActive(actor),
    () => (actor.role === Role.SUPER_ADMIN ? allow() : deny(DenialReason.ROLE_NOT_PERMITTED)),
    inStatus(listing, [ListingStatus.ARCHIVED]),
  );
}
