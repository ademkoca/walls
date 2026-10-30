import { type ListingContentView, type ListingDetail, ReviewStatus } from '@walls/shared';

/**
 * Content groups a revision can change (keys of `revision.groups`): only the title and
 * description wait for review (SPEC §6).
 */
export const REVISION_GROUPS = ['texts'] as const satisfies readonly (keyof ListingContentView)[];
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
  };
}
