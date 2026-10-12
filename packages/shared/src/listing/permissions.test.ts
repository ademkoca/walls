import { describe, expect, it } from 'vitest';
import { DenialReason } from '../access/decision';
import { ListingStatus, TransactionType, UserStatus } from '../enums';
import {
  admin,
  agent,
  listing,
  otherAgent,
  otherSeller,
  seller,
  superAdmin,
} from '../testing/fixtures';
import { ListingAction } from './lifecycle';
import {
  ListingEditMode,
  availableListingActions,
  canAssignAgent,
  canDeleteDraft,
  canEditListing,
  canPerformListingAction,
  canPermanentlyDeleteListing,
  canSetFeatured,
  canViewListing,
} from './permissions';

const denied = (reason: DenialReason) => ({ allowed: false, reason });
const allowed = { allowed: true };

describe('viewing listings in the dashboard', () => {
  it('lets a private seller see only their own listings', () => {
    expect(canViewListing(seller, listing())).toEqual(allowed);
    expect(canViewListing(otherSeller, listing())).toEqual(
      denied(DenialReason.NOT_RESOURCE_PARTICIPANT),
    );
  });

  it('lets an agent see listings they created or are assigned to, and no others', () => {
    expect(canViewListing(agent, listing({ createdById: agent.id }))).toEqual(allowed);
    expect(canViewListing(agent, listing({ assignedAgentId: agent.id }))).toEqual(allowed);
    expect(canViewListing(otherAgent, listing({ assignedAgentId: agent.id }))).toEqual(
      denied(DenialReason.NOT_RESOURCE_PARTICIPANT),
    );
  });

  it('keeps the creator’s access after an agent is assigned', () => {
    expect(canViewListing(seller, listing({ assignedAgentId: agent.id }))).toEqual(allowed);
  });

  it('lets admins see every listing, including deleted drafts', () => {
    expect(canViewListing(admin, listing({ deletedAt: new Date() }))).toEqual(allowed);
    expect(canViewListing(superAdmin, listing())).toEqual(allowed);
  });

  it('hides deleted drafts from their creator', () => {
    expect(canViewListing(seller, listing({ deletedAt: new Date() }))).toEqual(
      denied(DenialReason.RESOURCE_DELETED),
    );
  });

  it('denies inactive accounts', () => {
    const deactivated = { ...seller, status: UserStatus.DEACTIVATED };
    expect(canViewListing(deactivated, listing())).toEqual(denied(DenialReason.ACCOUNT_INACTIVE));
  });
});

describe('editing listing content', () => {
  it('allows direct edits to drafts and rule-based edits to published listings', () => {
    expect(canEditListing(seller, listing())).toEqual({
      allowed: true,
      mode: ListingEditMode.DRAFT,
    });
    expect(canEditListing(seller, listing({ status: ListingStatus.PUBLISHED }))).toEqual({
      allowed: true,
      mode: ListingEditMode.PUBLISHED,
    });
  });

  it('lets the assigned agent edit', () => {
    expect(canEditListing(agent, listing({ assignedAgentId: agent.id })).allowed).toBe(true);
  });

  it.each([
    ListingStatus.PENDING_REVIEW,
    ListingStatus.REJECTED,
    ListingStatus.SOLD,
    ListingStatus.RENTED,
    ListingStatus.ARCHIVED,
  ])('locks listings in %s', (status) => {
    expect(canEditListing(seller, listing({ status }))).toEqual(denied(DenialReason.INVALID_STATE));
  });

  it('does not let another seller or an unassigned agent edit', () => {
    expect(canEditListing(otherSeller, listing())).toEqual(
      denied(DenialReason.NOT_RESOURCE_PARTICIPANT),
    );
    expect(canEditListing(otherAgent, listing({ assignedAgentId: agent.id }))).toEqual(
      denied(DenialReason.NOT_RESOURCE_PARTICIPANT),
    );
  });

  it('denies admins direct content edits until that rule is decided', () => {
    expect(canEditListing(admin, listing()).allowed).toBe(false);
  });
});

describe('lifecycle actions', () => {
  it('lets the creator submit a draft, but not publish it', () => {
    expect(canPerformListingAction(seller, listing(), ListingAction.SUBMIT)).toEqual(allowed);
    const pending = listing({ status: ListingStatus.PENDING_REVIEW });
    expect(canPerformListingAction(seller, pending, ListingAction.APPROVE)).toEqual(
      denied(DenialReason.ROLE_NOT_PERMITTED),
    );
  });

  it('lets an agent submit a listing they created and receive the same review', () => {
    const agentListing = listing({ createdById: agent.id });
    expect(canPerformListingAction(agent, agentListing, ListingAction.SUBMIT)).toEqual(allowed);
    expect(
      canPerformListingAction(
        agent,
        { ...agentListing, status: ListingStatus.PENDING_REVIEW },
        ListingAction.APPROVE,
      ),
    ).toEqual(denied(DenialReason.ROLE_NOT_PERMITTED));
  });

  it('requires a verified email to submit', () => {
    const unverified = { ...seller, emailVerified: false };
    expect(canPerformListingAction(unverified, listing(), ListingAction.SUBMIT)).toEqual(
      denied(DenialReason.EMAIL_NOT_VERIFIED),
    );
  });

  it('does not let admins submit on behalf of the creator', () => {
    expect(canPerformListingAction(admin, listing(), ListingAction.SUBMIT)).toEqual(
      denied(DenialReason.NOT_RESOURCE_PARTICIPANT),
    );
  });

  it('gives the creator no actions while the listing is in review (no withdrawal)', () => {
    expect(
      availableListingActions(seller, listing({ status: ListingStatus.PENDING_REVIEW })),
    ).toEqual([]);
  });

  it('lets the creator revise a rejected listing', () => {
    expect(availableListingActions(seller, listing({ status: ListingStatus.REJECTED }))).toEqual([
      ListingAction.REVISE,
    ]);
  });

  it('offers reviewers approve/reject for pending listings', () => {
    expect(
      availableListingActions(admin, listing({ status: ListingStatus.PENDING_REVIEW })),
    ).toEqual([ListingAction.APPROVE, ListingAction.REJECT]);
  });

  it('offers reviewers the outcome matching the transaction type', () => {
    const published = listing({ status: ListingStatus.PUBLISHED });
    expect(availableListingActions(admin, published)).toEqual([
      ListingAction.MARK_SOLD,
      ListingAction.ARCHIVE,
    ]);
    expect(
      availableListingActions(admin, { ...published, transactionType: TransactionType.RENT }),
    ).toEqual([ListingAction.MARK_RENTED, ListingAction.ARCHIVE]);
  });

  it('rejects invalid transitions as a state problem', () => {
    expect(
      canPerformListingAction(
        admin,
        listing({ status: ListingStatus.DRAFT }),
        ListingAction.APPROVE,
      ),
    ).toEqual(denied(DenialReason.INVALID_STATE));
  });

  it('blocks actions on deleted drafts', () => {
    expect(
      canPerformListingAction(seller, listing({ deletedAt: new Date() }), ListingAction.SUBMIT),
    ).toEqual(denied(DenialReason.RESOURCE_DELETED));
  });
});

describe('deleting drafts', () => {
  it('lets only the creator delete, and only while in draft', () => {
    expect(canDeleteDraft(seller, listing())).toEqual(allowed);
    expect(canDeleteDraft(seller, listing({ status: ListingStatus.PENDING_REVIEW }))).toEqual(
      denied(DenialReason.INVALID_STATE),
    );
    expect(canDeleteDraft(agent, listing({ assignedAgentId: agent.id }))).toEqual(
      denied(DenialReason.NOT_RESOURCE_PARTICIPANT),
    );
  });
});

describe('admin-only operations', () => {
  it('lets only reviewers assign agents', () => {
    expect(canAssignAgent(admin, listing())).toEqual(allowed);
    expect(canAssignAgent(agent, listing({ createdById: agent.id }))).toEqual(
      denied(DenialReason.ROLE_NOT_PERMITTED),
    );
  });

  it('features only published listings', () => {
    expect(canSetFeatured(admin, listing({ status: ListingStatus.PUBLISHED }))).toEqual(allowed);
    expect(canSetFeatured(admin, listing())).toEqual(denied(DenialReason.INVALID_STATE));
    expect(canSetFeatured(seller, listing({ status: ListingStatus.PUBLISHED }))).toEqual(
      denied(DenialReason.ROLE_NOT_PERMITTED),
    );
  });

  it('lets only Super Admins permanently delete, and only archived listings', () => {
    const archived = listing({ status: ListingStatus.ARCHIVED });
    expect(canPermanentlyDeleteListing(superAdmin, archived)).toEqual(allowed);
    expect(canPermanentlyDeleteListing(admin, archived)).toEqual(
      denied(DenialReason.ROLE_NOT_PERMITTED),
    );
    expect(
      canPermanentlyDeleteListing(superAdmin, listing({ status: ListingStatus.PUBLISHED })),
    ).toEqual(denied(DenialReason.INVALID_STATE));
  });
});
