import type { ListingDetail } from '@walls/shared';
import { describe, expect, it } from 'vitest';
import { revisionChanges } from './revision-changes';

const image = (id: string, approved = true) => ({
  id,
  url: `https://media.test/${id}`,
  isPrimary: id === 'a',
  approved,
  width: 1200,
  height: 900,
});

const live = {
  propertyType: 'APARTMENT',
  transactionType: 'SALE',
  texts: [{ locale: 'sr', title: 'Stan', description: 'Opis' }],
  location: { city: 'Beograd', street: 'Njegoševa' },
  attributes: { floorArea: 50 },
  amenityCodes: ['ELEVATOR'],
  price: { mode: 'ON_REQUEST' },
  isExactAddressPublic: false,
  images: [image('a'), image('b'), image('c', false)],
} as unknown as ListingDetail;

describe('revisionChanges', () => {
  it('is null without a pending revision', () => {
    expect(revisionChanges({ ...live, revision: null })).toBeNull();
  });

  it('lists changed groups, ignoring key order, and counts image changes', () => {
    const listing = {
      ...live,
      revision: {
        id: 'r',
        status: 'PENDING',
        content: {
          ...live,
          texts: [{ locale: 'sr', title: 'Novi stan', description: 'Opis' }],
          location: { street: 'Njegoševa', city: 'Beograd' },
        },
        removedImageIds: ['b'],
        rejectionReason: null,
        updatedAt: '2026-10-12T00:00:00.000Z',
      },
    } as unknown as ListingDetail;
    expect(revisionChanges(listing)).toEqual({
      groups: ['texts'],
      addedImages: 1,
      removedImages: 1,
    });
  });
});
