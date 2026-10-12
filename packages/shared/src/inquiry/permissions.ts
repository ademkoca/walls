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

/**
 * The user who receives and manages a new inquiry: the assigned agent if the listing has
 * one, otherwise the listing's creator/advertiser (SPEC §20). Resolved when the inquiry is
 * created and stored on it.
 */
export function resolveInquiryRecipientId(listing: {
  createdById: string;
  assignedAgentId: string | null;
}): string {
  return listing.assignedAgentId ?? listing.createdById;
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
