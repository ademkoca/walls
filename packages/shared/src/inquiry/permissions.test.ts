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
} from './permissions';

describe('inquiry access', () => {
  const received = { recipientUserId: agent.id };

  it('lets the recipient and admins manage the inquiry', () => {
    expect(canManageInquiry(agent, received).allowed).toBe(true);
    expect(canManageInquiry(admin, received).allowed).toBe(true);
  });

  it('lets only the recipient reply, not admins', () => {
    expect(canReplyToInquiry(agent, received).allowed).toBe(true);
    expect(canReplyToInquiry(admin, received)).toEqual({
      allowed: false,
      reason: DenialReason.NOT_RESOURCE_PARTICIPANT,
    });
    expect(canReplyToInquiry({ ...agent, status: UserStatus.DEACTIVATED }, received).allowed).toBe(
      false,
    );
  });

  it('denies unrelated users', () => {
    expect(canViewInquiry(otherAgent, received).allowed).toBe(false);
    expect(canViewInquiry(otherSeller, received).allowed).toBe(false);
  });

  it('denies an inactive recipient', () => {
    const inactiveRecipient = { ...agent, status: UserStatus.DEACTIVATED };
    expect(canViewInquiry(inactiveRecipient, received)).toEqual({
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

  it('treats the creator as the owner of the listing', () => {
    const listing = { createdById: seller.id };
    expect(isOwnListing(seller.id, listing)).toBe(true);
    expect(isOwnListing(otherSeller.id, listing)).toBe(false);
  });
});
