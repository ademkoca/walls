import { describe, expect, it } from 'vitest';
import { ListingStatus, TransactionType } from '../enums';
import { ListingAction, isTransitionValid, nextStatus } from './lifecycle';

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
