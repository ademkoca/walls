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
import { Role } from '../enums';

export interface InquiryAccessContext {
  /** The listing's creator when the inquiry arrived (SPEC §20). */
  recipientUserId: string;
}

/** Updating an inquiry's status: its recipient, or any Admin/Super Admin. */
export function canManageInquiry(actor: Actor, inquiry: InquiryAccessContext): Decision {
  return firstDenial(
    () => requireActive(actor),
    () =>
      isReviewer(actor) || inquiry.recipientUserId === actor.id
        ? allow()
        : deny(DenialReason.NOT_RESOURCE_PARTICIPANT),
  );
}

/**
 * Writing back to the visitor (the "Reply by email" button and the visitor's contact links):
 * only the recipient does. Admins manage inquiries (status) and can read them, but do not
 * reply (decision, 2026-10-14: privacy).
 */
export function canReplyToInquiry(actor: Actor, inquiry: InquiryAccessContext): Decision {
  return firstDenial(
    () => requireActive(actor),
    () =>
      inquiry.recipientUserId === actor.id ? allow() : deny(DenialReason.NOT_RESOURCE_PARTICIPANT),
  );
}

/** Reading an inquiry: whoever may manage it. */
export function canViewInquiry(actor: Actor, inquiry: InquiryAccessContext): Decision {
  return canManageInquiry(actor, inquiry);
}

/**
 * Private sellers and agents keep a history of the inquiries they send while signed in
 * (decision, Phase 9). Other signed-in users send inquiries like anonymous visitors.
 */
export function keepsSentInquiries(role: Role): boolean {
  return role === Role.PRIVATE_SELLER || role === Role.REAL_ESTATE_AGENT;
}

/** The listing's creator receives its inquiries; they cannot send one. */
export function isOwnListing(userId: string, listing: { createdById: string }): boolean {
  return listing.createdById === userId;
}
