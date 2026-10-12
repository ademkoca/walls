import { describe, expect, it } from 'vitest';
import { DenialReason } from '../access/decision';
import { UserStatus } from '../enums';
import { admin, agent, otherAgent, otherSeller, seller } from '../testing/fixtures';
import { canManageInquiry, canViewInquiry, resolveInquiryRecipientId } from './permissions';

describe('inquiry routing (SPEC §20)', () => {
  it('routes to the advertiser when no agent is assigned', () => {
    expect(resolveInquiryRecipientId({ createdById: seller.id, assignedAgentId: null })).toBe(
      seller.id,
    );
  });

  it('routes to the assigned agent only, when there is one', () => {
    expect(resolveInquiryRecipientId({ createdById: seller.id, assignedAgentId: agent.id })).toBe(
      agent.id,
    );
  });
});

describe('inquiry access', () => {
  const assigned = { recipientUserId: agent.id, listingCreatedById: seller.id };

  it('lets the recipient and admins manage the inquiry', () => {
    expect(canManageInquiry(agent, assigned).allowed).toBe(true);
    expect(canManageInquiry(admin, assigned).allowed).toBe(true);
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
