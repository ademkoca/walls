import type { Database, DbExecutor } from '@walls/database';
import {
  type Actor,
  DEFAULT_LOCALE,
  ListingAction,
  type ListingContent,
  type ListingDetail,
  ListingEditMode,
  ListingField,
  ListingStatus,
  type ListingSummary,
  canCreateListing,
  canDeleteDraft,
  canEditListing,
  canPerformListingAction,
  canViewListing,
  checkSubmissionRequirements,
  contentSubmissionSnapshot,
  diffListingContent,
  isReviewer,
  mergeListingContent,
  nextStatus,
  planPublishedEdit,
  requireActive,
} from '@walls/shared';
import type { ListingInput, ListingListQuery } from '@walls/validation';
import { AuditAction, AuditEntity, recordAudit } from '../audit/audit-log';
import { findUserById } from '../auth/auth.repository';
import type { Config } from '../config';
import { enqueueEmail } from '../email/outbox';
import { EmailTemplate } from '../email/templates';
import { assertAllowed, notFound, submissionIncomplete, validationFailed } from '../http/errors';
import { webPageUrl } from '../http/web-links';
import { liveContent, writeContent } from './listing-content';
import {
  accessContext,
  pendingRevision,
  toListingDetail,
  toListingSummary,
  workingImageCount,
} from './listing-view';
import {
  type ListingAggregate,
  deleteRevision,
  findListingAggregate,
  findListingSummaries,
  insertListing,
  insertProperty,
  insertStatusHistory,
  lockListing,
  savePendingRevision,
  updateListing,
  upsertLocation,
} from './listings.repository';

/** Dashboard path of a listing; used for email links. */
export const listingDashboardPath = (id: string) => `/dashboard/listings/${id}`;

/** Loads a listing the actor may view, or throws 404/403. */
export async function loadViewableListing(
  db: DbExecutor,
  actor: Actor,
  id: string,
): Promise<ListingAggregate> {
  const aggregate = await findListingAggregate(db, id);
  if (!aggregate) throw notFound();
  assertAllowed(canViewListing(actor, accessContext(aggregate.listing)));
  return aggregate;
}

/** Every content group, for writing a whole draft. */
export const ALL_CONTENT_FIELDS: ReadonlySet<ListingField> = new Set([
  ListingField.PROPERTY_TYPE,
  ListingField.TRANSACTION_TYPE,
  ListingField.TEXT,
  ListingField.LOCATION,
  ListingField.ATTRIBUTES,
  ListingField.AMENITIES,
  ListingField.PRICE,
  ListingField.EXACT_ADDRESS_VISIBILITY,
]);

/** Minor edits of a published listing that the PATCH body can carry (SPEC §6). */
const IMMEDIATE_CONTENT_FIELDS: ReadonlySet<ListingField> = new Set([
  ListingField.PRICE,
  ListingField.EXACT_ADDRESS_VISIBILITY,
]);

/** Locks a listing the actor may edit now, and tells whether it is a draft or published. */
export async function lockEditable(db: DbExecutor, actor: Actor, id: string) {
  const listing = await lockListing(db, id);
  if (!listing) throw notFound();
  const decision = canEditListing(actor, accessContext(listing));
  assertAllowed(decision);
  return { listing, mode: decision.allowed ? decision.mode : ListingEditMode.DRAFT };
}

/**
 * The base an edit of a published listing applies to: the pending revision's proposal,
 * with the live values of the fields that change immediately (price follows the revision
 * only when the revision changes the transaction type).
 */
function publishedEditBase(aggregate: ListingAggregate): ListingContent {
  const live = liveContent(aggregate);
  const pending = pendingRevision(aggregate);
  if (!pending) return live;
  const priceInReview = pending.content.transactionType !== live.transactionType;
  return {
    ...pending.content,
    price: priceInReview ? pending.content.price : live.price,
    isExactAddressPublic: live.isExactAddressPublic,
  };
}

/** The content values of the given groups, for audit entries. */
function pickFields(content: ListingContent, fields: ReadonlySet<ListingField>) {
  return {
    ...(fields.has(ListingField.PRICE) ? { price: content.price } : {}),
    ...(fields.has(ListingField.EXACT_ADDRESS_VISIBILITY)
      ? { isExactAddressPublic: content.isExactAddressPublic }
      : {}),
  };
}

export class ListingsService {
  constructor(
    private readonly db: Database,
    private readonly config: Config,
  ) {}

  async create(actor: Actor): Promise<{ id: string }> {
    assertAllowed(canCreateListing(actor));
    // canCreateListing allows only accounts with a seller type.
    const sellerType = actor.sellerType!;

    return this.db.transaction(async (tx) => {
      const property = await insertProperty(tx, { createdById: actor.id });
      await upsertLocation(tx, { propertyId: property.id });
      const listing = await insertListing(tx, {
        propertyId: property.id,
        createdById: actor.id,
        sellerType,
      });
      await insertStatusHistory(tx, {
        listingId: listing.id,
        toStatus: ListingStatus.DRAFT,
        actorId: actor.id,
      });
      await recordAudit(tx, {
        actorId: actor.id,
        action: AuditAction.LISTING_CREATED,
        entityType: AuditEntity.LISTING,
        entityId: listing.id,
        after: { sellerType },
      });
      return { id: listing.id };
    });
  }

  /**
   * Dashboard listings: every listing for reviewers (they manage all listings), otherwise
   * the listings the user created.
   */
  async list(actor: Actor, query: ListingListQuery): Promise<ListingSummary[]> {
    assertAllowed(requireActive(actor));
    const rows = await findListingSummaries(this.db, {
      ...(isReviewer(actor) ? {} : { creatorId: actor.id }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.pendingRevision ? { pendingRevision: true } : {}),
    });
    return rows.map(toListingSummary);
  }

  async get(actor: Actor, id: string): Promise<ListingDetail> {
    return toListingDetail(await loadViewableListing(this.db, actor, id), actor);
  }

  /**
   * Saves an edit. Each section present in the input replaces that section; absent sections
   * are kept. Drafts may be incomplete. For published listings, minor changes apply now and
   * major ones become (or update) the pending revision (SPEC §6).
   */
  async update(actor: Actor, id: string, input: ListingInput): Promise<ListingDetail> {
    await this.db.transaction(async (tx) => {
      const { listing, mode } = await lockEditable(tx, actor, id);
      const aggregate = (await findListingAggregate(tx, id))!;
      const base =
        mode === ListingEditMode.PUBLISHED ? publishedEditBase(aggregate) : liveContent(aggregate);
      const merged = mergeListingContent(base, input);
      if (!merged.ok) throw validationFailed(merged.path, merged.message);

      if (mode === ListingEditMode.DRAFT) {
        await writeContent(tx, listing, merged.content, ALL_CONTENT_FIELDS);
      } else {
        await this.savePublishedEdit(tx, actor, aggregate, merged.content);
      }
    });
    return this.get(actor, id);
  }

  /**
   * Re-plans a published listing's edits after its images changed: images added or removed
   * by an editor need review, so the pending revision is created or kept up to date.
   */
  async syncPublishedEdit(tx: DbExecutor, actor: Actor, id: string): Promise<void> {
    const aggregate = (await findListingAggregate(tx, id))!;
    await this.savePublishedEdit(tx, actor, aggregate, publishedEditBase(aggregate));
  }

  /**
   * Applies an edit of a published listing: minor changes now (audited), major ones into the
   * pending revision. The proposed version must stay complete enough to be published.
   */
  private async savePublishedEdit(
    tx: DbExecutor,
    actor: Actor,
    aggregate: ListingAggregate,
    proposed: ListingContent,
  ): Promise<void> {
    const { listing } = aggregate;
    const live = liveContent(aggregate);
    const pending = pendingRevision(aggregate);
    const removedMediaIds = pending?.removedMediaIds ?? [];
    const imagesChanged =
      removedMediaIds.length > 0 || aggregate.images.some((image) => image.approvedAt === null);

    const issues = checkSubmissionRequirements(
      contentSubmissionSnapshot(proposed, workingImageCount(aggregate)),
    );
    if (issues.length > 0) throw submissionIncomplete(issues);

    const changed = diffListingContent(live, proposed);
    if (imagesChanged) changed.push(ListingField.MEDIA_SET);
    const plan = planPublishedEdit(changed);

    const immediate = new Set(
      plan.immediate.filter((field) => IMMEDIATE_CONTENT_FIELDS.has(field)),
    );
    if (immediate.size > 0) {
      await writeContent(tx, listing, proposed, immediate);
      await recordAudit(tx, {
        actorId: actor.id,
        action: AuditAction.LISTING_UPDATED_LIVE,
        entityType: AuditEntity.LISTING,
        entityId: listing.id,
        before: pickFields(live, immediate),
        after: pickFields(proposed, immediate),
      });
    }

    if (plan.requiresReview.length > 0) {
      await savePendingRevision(tx, {
        listingId: listing.id,
        content: proposed,
        removedMediaIds,
        updatedById: actor.id,
      });
      await recordAudit(tx, {
        actorId: actor.id,
        action: AuditAction.LISTING_REVISION_SAVED,
        entityType: AuditEntity.LISTING,
        entityId: listing.id,
        after: { fields: plan.requiresReview },
      });
    } else if (pending) {
      // Every major change was undone: nothing is left to review.
      await deleteRevision(tx, pending.id);
      await recordAudit(tx, {
        actorId: actor.id,
        action: AuditAction.LISTING_REVISION_WITHDRAWN,
        entityType: AuditEntity.LISTING,
        entityId: listing.id,
      });
    }
    await updateListing(tx, listing.id, {});
  }

  /** Soft-deletes a draft; the record and its history are kept (SPEC §24). */
  async deleteDraft(actor: Actor, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const listing = await lockListing(tx, id);
      if (!listing) throw notFound();
      assertAllowed(canDeleteDraft(actor, accessContext(listing)));
      await updateListing(tx, id, { deletedAt: new Date() });
      await recordAudit(tx, {
        actorId: actor.id,
        action: AuditAction.LISTING_DRAFT_DELETED,
        entityType: AuditEntity.LISTING,
        entityId: id,
      });
    });
  }

  /** Sends a complete draft for review (SPEC §6, §39) and confirms it by email. */
  async submit(actor: Actor, id: string): Promise<ListingDetail> {
    await this.db.transaction(async (tx) => {
      const listing = await lockListing(tx, id);
      if (!listing) throw notFound();
      assertAllowed(canPerformListingAction(actor, accessContext(listing), ListingAction.SUBMIT));

      const aggregate = (await findListingAggregate(tx, id))!;
      const issues = checkSubmissionRequirements(
        contentSubmissionSnapshot(liveContent(aggregate), aggregate.images.length),
      );
      if (issues.length > 0) throw submissionIncomplete(issues);

      const toStatus = nextStatus(ListingAction.SUBMIT);
      await updateListing(tx, id, { status: toStatus });
      await insertStatusHistory(tx, {
        listingId: id,
        fromStatus: listing.status,
        toStatus,
        actorId: actor.id,
      });
      await recordAudit(tx, {
        actorId: actor.id,
        action: AuditAction.LISTING_SUBMITTED,
        entityType: AuditEntity.LISTING,
        entityId: id,
        before: { status: listing.status },
        after: { status: toStatus },
      });

      const submitter = await findUserById(tx, actor.id);
      if (submitter) {
        const title = aggregate.texts.find((text) => text.locale === DEFAULT_LOCALE)?.title ?? '';
        await enqueueEmail(tx, {
          template: EmailTemplate.LISTING_SUBMITTED,
          to: submitter.email,
          locale: submitter.preferredLocale,
          payload: {
            displayName: submitter.displayName,
            listingTitle: title,
            link: webPageUrl(
              this.config.webOrigin,
              submitter.preferredLocale,
              listingDashboardPath(id),
            ),
          },
        });
      }
    });
    return this.get(actor, id);
  }

  /** Reopens a rejected listing as a draft; the rejection reason stays visible (SPEC §6). */
  async revise(actor: Actor, id: string): Promise<ListingDetail> {
    await this.db.transaction(async (tx) => {
      const listing = await lockListing(tx, id);
      if (!listing) throw notFound();
      assertAllowed(canPerformListingAction(actor, accessContext(listing), ListingAction.REVISE));

      const toStatus = nextStatus(ListingAction.REVISE);
      await updateListing(tx, id, { status: toStatus });
      await insertStatusHistory(tx, {
        listingId: id,
        fromStatus: listing.status,
        toStatus,
        actorId: actor.id,
      });
      await recordAudit(tx, {
        actorId: actor.id,
        action: AuditAction.LISTING_REVISED,
        entityType: AuditEntity.LISTING,
        entityId: id,
        before: { status: listing.status },
        after: { status: toStatus },
      });
    });
    return this.get(actor, id);
  }
}
