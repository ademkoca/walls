import {
  type Actor,
  type ListingAccessContext,
  type ListingContent,
  type ListingDetail,
  ListingEditMode,
  type ListingImage,
  type ListingRevisionView,
  type ListingSummary,
  ReviewStatus,
  availableListingActions,
  canAssignAgent,
  canDeleteDraft,
  canEditListing,
  canPermanentlyDeleteListing,
  canSetFeatured,
  checkSubmissionRequirements,
  contentSubmissionSnapshot,
} from '@walls/shared';
import { contentView, liveContent } from './listing-content';
import type {
  ListingAggregate,
  ListingRow,
  ListingSummaryRow,
  MediaRow,
  RevisionRow,
} from './listings.repository';

export function accessContext(listing: ListingRow): ListingAccessContext {
  return {
    createdById: listing.createdById,
    assignedAgentId: listing.assignedAgentId,
    status: listing.status,
    transactionType: listing.transactionType,
    deletedAt: listing.deletedAt,
  };
}

export function toListingImage(image: MediaRow): ListingImage {
  return {
    id: image.id,
    url: image.url,
    isPrimary: image.isPrimary,
    approved: image.approvedAt !== null,
    width: image.width,
    height: image.height,
  };
}

/** The pending revision of an aggregate, if any (not a rejected one). */
export function pendingRevision(aggregate: ListingAggregate): RevisionRow | null {
  return aggregate.revision?.status === ReviewStatus.PENDING ? aggregate.revision : null;
}

/**
 * The content editors are working on: the pending revision's proposal for a published
 * listing, otherwise the live content.
 */
export function workingContent(aggregate: ListingAggregate): ListingContent {
  return pendingRevision(aggregate)?.content ?? liveContent(aggregate);
}

/** Images of the working version: everything except images a pending revision removes. */
export function workingImageCount(aggregate: ListingAggregate): number {
  const removed = new Set(pendingRevision(aggregate)?.removedMediaIds ?? []);
  return aggregate.images.filter((image) => !removed.has(image.id)).length;
}

function revisionView(revision: RevisionRow | null): ListingRevisionView | null {
  if (!revision || revision.status === ReviewStatus.APPROVED) return null;
  return {
    id: revision.id,
    status: revision.status,
    content: contentView(revision.content),
    removedImageIds: revision.removedMediaIds,
    rejectionReason: revision.rejectionReason,
    updatedAt: revision.updatedAt.toISOString(),
  };
}

export function toListingDetail(aggregate: ListingAggregate, actor: Actor): ListingDetail {
  const { listing } = aggregate;
  const context = accessContext(listing);
  const edit = canEditListing(actor, context);
  const live = contentView(liveContent(aggregate));
  // Editors of a published listing see what blocks their proposed version.
  const checked =
    edit.allowed && edit.mode === ListingEditMode.PUBLISHED
      ? workingContent(aggregate)
      : liveContent(aggregate);

  return {
    id: listing.id,
    status: listing.status,
    sellerType: listing.sellerType,
    creator: aggregate.creator,
    assignedAgent: aggregate.assignedAgent,
    slug: listing.slug,
    publishedAt: listing.publishedAt?.toISOString() ?? null,
    isFeatured: listing.isFeatured,
    featuredUntil: listing.featuredUntil?.toISOString() ?? null,
    propertyType: live.propertyType,
    transactionType: live.transactionType,
    texts: live.texts,
    location: live.location,
    attributes: live.attributes,
    amenityCodes: live.amenityCodes,
    price: live.price,
    isExactAddressPublic: live.isExactAddressPublic,
    rejectionReason: listing.rejectionReason,
    images: aggregate.images.map(toListingImage),
    revision: revisionView(aggregate.revision),
    permissions: {
      editMode: edit.allowed ? edit.mode : null,
      canDelete: canDeleteDraft(actor, context).allowed,
      actions: availableListingActions(actor, context),
      canAssignAgent: canAssignAgent(actor, context).allowed,
      canSetFeatured: canSetFeatured(actor, context).allowed,
      canPermanentlyDelete: canPermanentlyDeleteListing(actor, context).allowed,
    },
    submissionIssues: checkSubmissionRequirements(
      contentSubmissionSnapshot(checked, workingImageCount(aggregate)),
    ),
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}

export function toListingSummary(row: ListingSummaryRow): ListingSummary {
  return {
    id: row.listing.id,
    status: row.listing.status,
    propertyType: row.propertyType,
    transactionType: row.listing.transactionType,
    title: row.title?.trim() ? row.title : null,
    city: row.city,
    coverImageUrl: row.coverImageUrl,
    imageCount: row.imageCount,
    creator: row.creator,
    isFeatured: row.listing.isFeatured,
    hasPendingRevision: row.hasPendingRevision,
    updatedAt: row.listing.updatedAt.toISOString(),
  };
}
