import { describe, expect, it } from 'vitest';
import { ListingStatus, TransactionType, UserStatus } from '../enums';
import {
  ListingAction,
  isListingPubliclyVisible,
  isTransitionValid,
  nextStatus,
} from './lifecycle';

const { DRAFT, PENDING_REVIEW, PUBLISHED, REJECTED, SOLD, RENTED, ARCHIVED } = ListingStatus;
const { SALE, RENT } = TransactionType;

describe('listing lifecycle (SPEC §6)', () => {
  it.each([
    [ListingAction.SUBMIT, DRAFT, PENDING_REVIEW],
    [ListingAction.REVISE, REJECTED, DRAFT],
    [ListingAction.APPROVE, PENDING_REVIEW, PUBLISHED],
    [ListingAction.REJECT, PENDING_REVIEW, REJECTED],
    [ListingAction.ARCHIVE, PUBLISHED, ARCHIVED],
    [ListingAction.ARCHIVE, SOLD, ARCHIVED],
    [ListingAction.ARCHIVE, RENTED, ARCHIVED],
    [ListingAction.REOPEN, SOLD, PUBLISHED],
    [ListingAction.REOPEN, RENTED, PUBLISHED],
    [ListingAction.UNARCHIVE, ARCHIVED, PUBLISHED],
  ])('%s moves %s to %s', (action, from, to) => {
    expect(isTransitionValid(action, from, SALE)).toBe(true);
    expect(nextStatus(action)).toBe(to);
  });

  it('marks only sale listings as sold and only rental listings as rented', () => {
    expect(isTransitionValid(ListingAction.MARK_SOLD, PUBLISHED, SALE)).toBe(true);
    expect(isTransitionValid(ListingAction.MARK_SOLD, PUBLISHED, RENT)).toBe(false);
    expect(isTransitionValid(ListingAction.MARK_RENTED, PUBLISHED, RENT)).toBe(true);
    expect(isTransitionValid(ListingAction.MARK_RENTED, PUBLISHED, SALE)).toBe(false);
  });

  it.each([
    [ListingAction.SUBMIT, PUBLISHED],
    [ListingAction.SUBMIT, PENDING_REVIEW],
    [ListingAction.APPROVE, DRAFT],
    [ListingAction.APPROVE, REJECTED],
    [ListingAction.REJECT, PUBLISHED],
    [ListingAction.REVISE, DRAFT],
    [ListingAction.ARCHIVE, DRAFT],
    [ListingAction.ARCHIVE, PENDING_REVIEW],
    [ListingAction.ARCHIVE, ARCHIVED],
    [ListingAction.MARK_SOLD, SOLD],
    [ListingAction.REOPEN, PUBLISHED],
    [ListingAction.REOPEN, ARCHIVED],
    [ListingAction.UNARCHIVE, PUBLISHED],
    [ListingAction.UNARCHIVE, SOLD],
  ])('rejects %s from %s', (action, from) => {
    expect(isTransitionValid(action, from, SALE)).toBe(false);
  });

  it('has no way out of review except approval or rejection', () => {
    const fromPending = Object.values(ListingAction).filter((action) =>
      isTransitionValid(action, PENDING_REVIEW, SALE),
    );
    expect(fromPending.sort()).toEqual([ListingAction.APPROVE, ListingAction.REJECT].sort());
  });
});

describe('public visibility (SPEC §2.1, §46)', () => {
  const published = { status: ListingStatus.PUBLISHED, deletedAt: null };

  it('shows published listings of active creators only', () => {
    expect(isListingPubliclyVisible(published, UserStatus.ACTIVE)).toBe(true);
    expect(isListingPubliclyVisible(published, UserStatus.DEACTIVATED)).toBe(false);
    expect(
      isListingPubliclyVisible({ ...published, status: ListingStatus.SOLD }, UserStatus.ACTIVE),
    ).toBe(false);
  });
});
