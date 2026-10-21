import type { Database, DbExecutor } from '@walls/database';
import {
  type Actor,
  DEFAULT_LOCALE,
  ListingAction,
  type ListingDetail,
  Role,
  UserStatus,
  ListingField,
  ReviewStatus,
  canAssignAgent,
  canBeAssigned,
  canPerformListingAction,
  canPermanentlyDeleteListing,
  canReviewRevision,
  canSetFeatured,
  listingSlugBase,
  nextFreeSlug,
  nextStatus,
} from '@walls/shared';
import type { AssignAgentInput, SetFeaturedInput } from '@walls/validation';
import { AuditAction, AuditEntity, recordAudit } from '../audit/audit-log';
import { findUserById } from '../auth/auth.repository';
import type { Config } from '../config';
import { enqueueEmail } from '../email/outbox';
import { EmailTemplate } from '../email/templates';
import { assertAllowed, notFound, validationFailed } from '../http/errors';
import { webPageUrl } from '../http/web-links';
import type { Logger } from '../logger';
import type { MediaStorage } from '../media/media-storage';
import { liveContent, writeContent } from './listing-content';
import { accessContext } from './listing-view';
import {
  type ListingRow,
  approvePendingImages,
  closeRevision,
  deleteListingPermanently,
  deleteMediaRows,
  deleteRevision,
  findImages,
  findListingAggregate,
  findPendingRevision,
  findListingSlugsLike,
  findMediaStorageKeys,
  insertAssignment,
  insertStatusHistory,
  lockListing,
  unapprovedImageIds,
  updateListing,
  writeImageOrder,
} from './listings.repository';
import { ListingsService, listingDashboardPath } from './listings.service';

/** Status changes a reviewer makes without extra input, and how each is audited. */
const SIMPLE_TRANSITIONS = {
  [ListingAction.MARK_SOLD]: AuditAction.LISTING_MARKED_SOLD,
  [ListingAction.MARK_RENTED]: AuditAction.LISTING_MARKED_RENTED,
  [ListingAction.ARCHIVE]: AuditAction.LISTING_ARCHIVED,
} as const;
export type SimpleReviewerAction = keyof typeof SIMPLE_TRANSITIONS;

type ReviewOutcomeTemplate =
  | typeof EmailTemplate.LISTING_APPROVED
  | typeof EmailTemplate.LISTING_REJECTED
  | typeof EmailTemplate.LISTING_CHANGES_APPROVED
  | typeof EmailTemplate.LISTING_CHANGES_REJECTED;

/** Revision content written to the live listing on approval (price only with a new transaction type). */
const REVISION_FIELDS: readonly ListingField[] = [
  ListingField.PROPERTY_TYPE,
  ListingField.TRANSACTION_TYPE,
  ListingField.TEXT,
  ListingField.LOCATION,
  ListingField.ATTRIBUTES,
  ListingField.AMENITIES,
];

/**
 * What Admins and Super Admins do with listings (SPEC §2.1, §6, §22, §24): review
 * submissions, change the status of published listings, feature, assign agents and
 * permanently delete. Content itself is only ever edited by the listing's editors.
 */
export class ListingReviewService {
  private readonly listings: ListingsService;

  constructor(
    private readonly db: Database,
    private readonly config: Config,
    private readonly storage: MediaStorage,
    private readonly logger: Logger,
  ) {
    this.listings = new ListingsService(db, config);
  }

  private async lockForAction(tx: DbExecutor, actor: Actor, id: string, action: ListingAction) {
    const listing = await lockListing(tx, id);
    if (!listing) throw notFound();
    assertAllowed(canPerformListingAction(actor, accessContext(listing), action));
    return listing;
  }

  /** Moves the listing to the action's target status, with history and an audit entry. */
  private async transition(
    tx: DbExecutor,
    actor: Actor,
    listing: ListingRow,
    action: ListingAction,
    audit: AuditAction,
    changes: Partial<ListingRow> = {},
    reason?: string,
  ) {
    const toStatus = nextStatus(action);
    await updateListing(tx, listing.id, { ...changes, status: toStatus });
    await insertStatusHistory(tx, {
      listingId: listing.id,
      fromStatus: listing.status,
      toStatus,
      actorId: actor.id,
      ...(reason ? { reason } : {}),
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: audit,
      entityType: AuditEntity.LISTING,
      entityId: listing.id,
      before: { status: listing.status },
      after: { status: toStatus, ...changes },
      ...(reason ? { reason } : {}),
    });
  }

  /** Emails the listing's creator about a review outcome, in their language. */
  private async notifyCreator(
    tx: DbExecutor,
    listing: ListingRow,
    template: ReviewOutcomeTemplate,
    reason?: string,
  ) {
    const creator = await findUserById(tx, listing.createdById);
    if (!creator) return;
    const aggregate = (await findListingAggregate(tx, listing.id))!;
    const listingTitle =
      aggregate.texts.find((text) => text.locale === DEFAULT_LOCALE)?.title ?? '';
    const link = webPageUrl(
      this.config.webOrigin,
      creator.preferredLocale,
      listingDashboardPath(listing.id),
    );
    const base = { to: creator.email, locale: creator.preferredLocale };
    const payload = { displayName: creator.displayName, listingTitle, link };
    if (
      template === EmailTemplate.LISTING_REJECTED ||
      template === EmailTemplate.LISTING_CHANGES_REJECTED
    ) {
      await enqueueEmail(tx, { ...base, template, payload: { ...payload, reason: reason ?? '' } });
    } else {
      await enqueueEmail(tx, { ...base, template, payload });
    }
  }

  /**
   * Publishes a listing in review. The first publication assigns its permanent slug (SPEC
   * §32); every image becomes publicly visible.
   */
  async approve(actor: Actor, id: string): Promise<ListingDetail> {
    await this.db.transaction(async (tx) => {
      const listing = await this.lockForAction(tx, actor, id, ListingAction.APPROVE);
      const changes: Partial<ListingRow> = { rejectionReason: null };
      if (!listing.slug) {
        const aggregate = (await findListingAggregate(tx, id))!;
        const title = aggregate.texts.find((text) => text.locale === DEFAULT_LOCALE)?.title ?? '';
        const base = listingSlugBase(title, aggregate.location?.city ?? null);
        changes.slug = nextFreeSlug(base, new Set(await findListingSlugsLike(tx, base)));
      }
      changes.publishedAt = listing.publishedAt ?? new Date();

      await approvePendingImages(tx, id);
      await this.transition(
        tx,
        actor,
        listing,
        ListingAction.APPROVE,
        AuditAction.LISTING_APPROVED,
        changes,
      );
      await this.notifyCreator(tx, listing, EmailTemplate.LISTING_APPROVED);
    });
    return this.listings.get(actor, id);
  }

  /** Rejects a listing in review with a reason the creator sees and receives by email. */
  async reject(actor: Actor, id: string, reason: string): Promise<ListingDetail> {
    await this.db.transaction(async (tx) => {
      const listing = await this.lockForAction(tx, actor, id, ListingAction.REJECT);
      await this.transition(
        tx,
        actor,
        listing,
        ListingAction.REJECT,
        AuditAction.LISTING_REJECTED,
        { rejectionReason: reason },
        reason,
      );
      await this.notifyCreator(tx, listing, EmailTemplate.LISTING_REJECTED, reason);
    });
    return this.listings.get(actor, id);
  }

  /** Sold, rented or archived (SPEC §6). */
  async changeStatus(
    actor: Actor,
    id: string,
    action: SimpleReviewerAction,
  ): Promise<ListingDetail> {
    const keys = await this.db.transaction(async (tx) => {
      const listing = await this.lockForAction(tx, actor, id, action);
      await this.transition(tx, actor, listing, action, SIMPLE_TRANSITIONS[action]);
      return this.discardPendingRevision(tx, actor, id);
    });
    this.deleteStored(keys);
    return this.listings.get(actor, id);
  }

  /**
   * A listing that leaves PUBLISHED no longer takes edits, so its pending revision (and the
   * images it added) is dropped. Returns storage keys to delete after commit.
   */
  private async discardPendingRevision(tx: DbExecutor, actor: Actor, id: string) {
    const pending = await findPendingRevision(tx, id);
    if (!pending) return [];
    const keys = await deleteMediaRows(tx, id, await unapprovedImageIds(tx, id));
    await deleteRevision(tx, pending.id);
    await recordAudit(tx, {
      actorId: actor.id,
      action: AuditAction.LISTING_REVISION_DISCARDED,
      entityType: AuditEntity.LISTING,
      entityId: id,
    });
    return keys;
  }

  private async lockForRevisionReview(tx: DbExecutor, actor: Actor, id: string) {
    const listing = await lockListing(tx, id);
    if (!listing) throw notFound();
    assertAllowed(canReviewRevision(actor, accessContext(listing)));
    const revision = await findPendingRevision(tx, id);
    if (!revision) throw notFound();
    return { listing, revision };
  }

  /**
   * Approves the pending major edits of a published listing: the proposed content goes
   * live, added images become public and removed ones are deleted (SPEC §6).
   */
  async approveRevision(actor: Actor, id: string): Promise<ListingDetail> {
    const keys = await this.db.transaction(async (tx) => {
      const { listing, revision } = await this.lockForRevisionReview(tx, actor, id);
      const live = liveContent((await findListingAggregate(tx, id))!);
      const fields = new Set(REVISION_FIELDS);
      if (revision.content.transactionType !== live.transactionType) fields.add(ListingField.PRICE);

      await writeContent(tx, listing, revision.content, fields);
      const removedKeys = await deleteMediaRows(tx, id, revision.removedMediaIds);
      await approvePendingImages(tx, id);
      const images = await findImages(tx, id);
      const cover = images.find((image) => image.isPrimary) ?? images[0];
      if (cover)
        await writeImageOrder(
          tx,
          id,
          images.map((image) => image.id),
          cover.id,
        );

      await closeRevision(tx, revision.id, {
        status: ReviewStatus.APPROVED,
        reviewedById: actor.id,
      });
      await recordAudit(tx, {
        actorId: actor.id,
        action: AuditAction.LISTING_REVISION_APPROVED,
        entityType: AuditEntity.LISTING,
        entityId: id,
        before: { ...live },
        after: { ...revision.content, removedMediaIds: revision.removedMediaIds },
      });
      await this.notifyCreator(tx, listing, EmailTemplate.LISTING_CHANGES_APPROVED);
      return removedKeys;
    });
    this.deleteStored(keys);
    return this.listings.get(actor, id);
  }

  /** Rejects the pending major edits; the live listing is unaffected (SPEC §6). */
  async rejectRevision(actor: Actor, id: string, reason: string): Promise<ListingDetail> {
    const keys = await this.db.transaction(async (tx) => {
      const { listing, revision } = await this.lockForRevisionReview(tx, actor, id);
      const keysToDelete = await deleteMediaRows(tx, id, await unapprovedImageIds(tx, id));
      await closeRevision(tx, revision.id, {
        status: ReviewStatus.REJECTED,
        reviewedById: actor.id,
        rejectionReason: reason,
      });
      await recordAudit(tx, {
        actorId: actor.id,
        action: AuditAction.LISTING_REVISION_REJECTED,
        entityType: AuditEntity.LISTING,
        entityId: id,
        reason,
      });
      await this.notifyCreator(tx, listing, EmailTemplate.LISTING_CHANGES_REJECTED, reason);
      return keysToDelete;
    });
    this.deleteStored(keys);
    return this.listings.get(actor, id);
  }

  /** Storage cleanup never fails the request; an orphaned file is only logged. */
  private deleteStored(keys: readonly string[]): void {
    for (const key of keys) {
      this.storage.delete(key).catch((error: unknown) => {
        this.logger.warn({ err: error, key }, 'Failed to delete stored media');
      });
    }
  }

  /** Features or unfeatures a published listing; an end date must lie in the future (SPEC §22). */
  async setFeatured(actor: Actor, id: string, input: SetFeaturedInput): Promise<ListingDetail> {
    const featuredUntil = input.featuredUntil ? new Date(input.featuredUntil) : null;
    if (featuredUntil && featuredUntil.getTime() <= Date.now()) {
      throw validationFailed(['featuredUntil'], 'The end date must be in the future');
    }
    await this.db.transaction(async (tx) => {
      const listing = await lockListing(tx, id);
      if (!listing) throw notFound();
      assertAllowed(canSetFeatured(actor, accessContext(listing)));

      await updateListing(tx, id, { isFeatured: input.featured, featuredUntil });
      await recordAudit(tx, {
        actorId: actor.id,
        action: input.featured ? AuditAction.LISTING_FEATURED : AuditAction.LISTING_UNFEATURED,
        entityType: AuditEntity.LISTING,
        entityId: id,
        before: { isFeatured: listing.isFeatured, featuredUntil: listing.featuredUntil },
        after: { isFeatured: input.featured, featuredUntil },
      });
    });
    return this.listings.get(actor, id);
  }

  /**
   * Assigns an active agent or agency to the listing, or removes the assignment. Investors
   * advertise only their own projects and cannot be assigned. The creator keeps access
   * either way (SPEC §5).
   */
  async assignAgent(actor: Actor, id: string, input: AssignAgentInput): Promise<ListingDetail> {
    await this.db.transaction(async (tx) => {
      const listing = await lockListing(tx, id);
      if (!listing) throw notFound();
      assertAllowed(canAssignAgent(actor, accessContext(listing)));

      if (input.agentId) {
        const agent = await findUserById(tx, input.agentId);
        if (
          agent?.role !== Role.REAL_ESTATE_AGENT ||
          !canBeAssigned(agent.sellerType) ||
          agent.status !== UserStatus.ACTIVE
        ) {
          throw validationFailed(['agentId'], 'Choose an active agent or agency');
        }
      }
      if (input.agentId === listing.assignedAgentId) return;

      await updateListing(tx, id, { assignedAgentId: input.agentId });
      await insertAssignment(tx, { listingId: id, agentId: input.agentId, assignedById: actor.id });
      await recordAudit(tx, {
        actorId: actor.id,
        action: input.agentId
          ? AuditAction.LISTING_AGENT_ASSIGNED
          : AuditAction.LISTING_AGENT_UNASSIGNED,
        entityType: AuditEntity.LISTING,
        entityId: id,
        before: { assignedAgentId: listing.assignedAgentId },
        after: { assignedAgentId: input.agentId },
      });
    });
    return this.listings.get(actor, id);
  }

  /**
   * Permanently deletes an archived listing (Super Admin only, SPEC §24). The audit entry
   * keeps a summary of what was deleted; stored files are removed afterwards.
   */
  async permanentlyDelete(actor: Actor, id: string): Promise<void> {
    const keys = await this.db.transaction(async (tx) => {
      const listing = await lockListing(tx, id);
      if (!listing) throw notFound();
      assertAllowed(canPermanentlyDeleteListing(actor, accessContext(listing)));

      const aggregate = (await findListingAggregate(tx, id))!;
      const storageKeys = await findMediaStorageKeys(tx, id);
      await deleteListingPermanently(tx, listing);
      await recordAudit(tx, {
        actorId: actor.id,
        action: AuditAction.LISTING_PERMANENTLY_DELETED,
        entityType: AuditEntity.LISTING,
        entityId: id,
        before: {
          status: listing.status,
          slug: listing.slug,
          createdById: listing.createdById,
          title: aggregate.texts.find((text) => text.locale === DEFAULT_LOCALE)?.title ?? null,
          imageCount: storageKeys.length,
        },
      });
      return storageKeys;
    });
    this.deleteStored(keys);
  }
}
