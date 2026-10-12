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
import { Role, UserStatus } from '../enums';

/**
 * The user who receives and manages a new inquiry: the assigned agent if the listing has
 * one, otherwise the listing's creator/advertiser (SPEC §20). Resolved when the inquiry is
 * created and stored on it. A deactivated assigned agent cannot sign in, so their
 * inquiries go to the creator instead (decision, Phase 9).
 */
export function resolveInquiryRecipientId(listing: {
  createdById: string;
  assignedAgent: { id: string; status: UserStatus } | null;
}): string {
  const agent = listing.assignedAgent;
  return agent && agent.status !== UserStatus.DEACTIVATED ? agent.id : listing.createdById;
}

export interface InquiryAccessContext {
  recipientUserId: string;
  /** Creator of the listing the inquiry is about. */
  listingCreatedById: string;
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

/** Reading an inquiry: anyone who can manage it, plus the listing creator (read-only). */
export function canViewInquiry(actor: Actor, inquiry: InquiryAccessContext): Decision {
  const manage = canManageInquiry(actor, inquiry);
  if (manage.allowed || manage.reason === DenialReason.ACCOUNT_INACTIVE) return manage;
  return inquiry.listingCreatedById === actor.id ? allow() : manage;
}

/**
 * Private sellers and agents keep a history of the inquiries they send while signed in
 * (decision, Phase 9). Other signed-in users send inquiries like anonymous visitors.
 */
export function keepsSentInquiries(role: Role): boolean {
  return role === Role.PRIVATE_SELLER || role === Role.REAL_ESTATE_AGENT;
}

/** The listing's creator and assigned agent receive its inquiries; they cannot send one. */
export function isOwnListing(
  userId: string,
  listing: { createdById: string; assignedAgentId: string | null },
): boolean {
  return listing.createdById === userId || listing.assignedAgentId === userId;
}
