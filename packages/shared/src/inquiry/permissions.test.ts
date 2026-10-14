import { describe, expect, it } from 'vitest';
import { DenialReason } from '../access/decision';
import { Role, UserStatus } from '../enums';
import { admin, agent, otherAgent, otherSeller, seller } from '../testing/fixtures';
import {
  canManageInquiry,
  canReplyToInquiry,
  canViewInquiry,
  isOwnListing,
  keepsSentInquiries,
  resolveInquiryRecipientId,
} from './permissions';

describe('inquiry routing (SPEC §20)', () => {
  it('routes to the advertiser when no agent is assigned', () => {
    expect(resolveInquiryRecipientId({ createdById: seller.id, assignedAgent: null })).toBe(
      seller.id,
    );
  });

  it('routes to the assigned agent only, when there is one', () => {
    expect(
      resolveInquiryRecipientId({
        createdById: seller.id,
        assignedAgent: { id: agent.id, status: UserStatus.ACTIVE },
      }),
    ).toBe(agent.id);
  });

  it('routes to the advertiser when the assigned agent was deactivated (decision, Phase 9)', () => {
    expect(
      resolveInquiryRecipientId({
        createdById: seller.id,
        assignedAgent: { id: agent.id, status: UserStatus.DEACTIVATED },
      }),
    ).toBe(seller.id);
  });
});

describe('inquiry access', () => {
  const assigned = { recipientUserId: agent.id, listingCreatedById: seller.id };

  it('lets the recipient and admins manage the inquiry', () => {
    expect(canManageInquiry(agent, assigned).allowed).toBe(true);
    expect(canManageInquiry(admin, assigned).allowed).toBe(true);
  });

  it('lets only the recipient reply: not admins, not the creator with read-only access', () => {
    expect(canReplyToInquiry(agent, assigned).allowed).toBe(true);
    expect(canReplyToInquiry(admin, assigned)).toEqual({
      allowed: false,
      reason: DenialReason.NOT_RESOURCE_PARTICIPANT,
    });
    expect(canReplyToInquiry(seller, assigned).allowed).toBe(false);
    expect(canReplyToInquiry({ ...agent, status: UserStatus.DEACTIVATED }, assigned).allowed).toBe(
      false,
    );
  });

  it('gives the listing creator read-only access when an agent handles the inquiry', () => {
    expect(canViewInquiry(seller, assigned).allowed).toBe(true);
    expect(canManageInquiry(seller, assigned)).toEqual({
      allowed: false,
      reason: DenialReason.NOT_RESOURCE_PARTICIPANT,
    });
  });

  it('denies unrelated users', () => {
    expect(canViewInquiry(otherAgent, assigned).allowed).toBe(false);
    expect(canViewInquiry(otherSeller, assigned).allowed).toBe(false);
  });

  it('denies inactive accounts even for the listing creator', () => {
    const inactiveCreator = { ...seller, status: UserStatus.DEACTIVATED };
    expect(canViewInquiry(inactiveCreator, assigned)).toEqual({
      allowed: false,
      reason: DenialReason.ACCOUNT_INACTIVE,
    });
  });
});

describe('inquiries sent by signed-in users (decision, Phase 9)', () => {
  it('keeps a sent history for private sellers and agents only', () => {
    expect(keepsSentInquiries(Role.PRIVATE_SELLER)).toBe(true);
    expect(keepsSentInquiries(Role.REAL_ESTATE_AGENT)).toBe(true);
    expect(keepsSentInquiries(Role.ADMIN)).toBe(false);
    expect(keepsSentInquiries(Role.SUPER_ADMIN)).toBe(false);
  });

  it('treats the creator and the assigned agent as owners of the listing', () => {
    const listing = { createdById: seller.id, assignedAgentId: agent.id };
    expect(isOwnListing(seller.id, listing)).toBe(true);
    expect(isOwnListing(agent.id, listing)).toBe(true);
    expect(isOwnListing(otherSeller.id, listing)).toBe(false);
  });
});
