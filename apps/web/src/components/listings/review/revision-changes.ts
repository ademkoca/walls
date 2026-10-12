import { type ListingContentView, type ListingDetail, ReviewStatus } from '@walls/shared';

/** Content groups a revision can change, in display order (keys of `revision.groups`). */
export const REVISION_GROUPS = [
  'propertyType',
  'transactionType',
  'texts',
  'location',
  'attributes',
  'amenityCodes',
  'price',
] as const satisfies readonly (keyof ListingContentView)[];
export type RevisionGroup = (typeof REVISION_GROUPS)[number];

/** JSON with sorted object keys, so equal values compare equal however they were built. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
}

export interface RevisionChanges {
  groups: RevisionGroup[];
  addedImages: number;
  removedImages: number;
}

/** What a pending revision changes compared with the live listing, or null without one. */
export function revisionChanges(listing: ListingDetail): RevisionChanges | null {
  const { revision } = listing;
  if (revision?.status !== ReviewStatus.PENDING) return null;
  return {
    groups: REVISION_GROUPS.filter(
      (group) => canonical(listing[group]) !== canonical(revision.content[group]),
    ),
    addedImages: listing.images.filter((image) => !image.approved).length,
    removedImages: revision.removedImageIds.length,
  };
}
