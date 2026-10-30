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
    status: listing.status,
    transactionType: listing.transactionType,
    deletedAt: listing.deletedAt,
    archivedByReviewer: listing.archivedByReviewer,
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
 * The content the creator is working on: the live content, with the title and description a
 * pending revision proposes (only those wait for review, SPEC §6).
 */
export function workingContent(aggregate: ListingAggregate): ListingContent {
  const live = liveContent(aggregate);
  const pending = pendingRevision(aggregate);
  return pending ? { ...live, texts: pending.content.texts } : live;
}

/** The revision as the live content with its proposed title and description. */
function revisionView(aggregate: ListingAggregate): ListingRevisionView | null {
  const { revision } = aggregate;
  if (!revision || revision.status === ReviewStatus.APPROVED) return null;
  return {
    id: revision.id,
    status: revision.status,
    content: contentView({ ...liveContent(aggregate), texts: revision.content.texts }),
    rejectionReason: revision.rejectionReason,
    updatedAt: revision.updatedAt.toISOString(),
  };
}

export function toListingDetail(aggregate: ListingAggregate, actor: Actor): ListingDetail {
  const { listing } = aggregate;
  const context = accessContext(listing);
  const edit = canEditListing(actor, context);
  const live = contentView(liveContent(aggregate));
  // The creator of a published listing sees what blocks their proposed version.
  const checked =
    edit.allowed && edit.mode === ListingEditMode.PUBLISHED
      ? workingContent(aggregate)
      : liveContent(aggregate);

  return {
    id: listing.id,
    status: listing.status,
    sellerType: listing.sellerType,
    creator: aggregate.creator,
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
    revision: revisionView(aggregate),
    permissions: {
      editMode: edit.allowed ? edit.mode : null,
      canDelete: canDeleteDraft(actor, context).allowed,
      actions: availableListingActions(actor, context),
      canSetFeatured: canSetFeatured(actor, context).allowed,
      canPermanentlyDelete: canPermanentlyDeleteListing(actor, context).allowed,
    },
    submissionIssues: checkSubmissionRequirements(
      contentSubmissionSnapshot(checked, aggregate.images.length),
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
