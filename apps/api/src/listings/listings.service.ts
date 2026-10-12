import type { Database, DbExecutor } from '@walls/database';
import {
  type Actor,
  DEFAULT_LOCALE,
  ListingAction,
  type ListingDetail,
  ListingEditMode,
  ListingStatus,
  type ListingSummary,
  PriceMode,
  TransactionType,
  canCreateListing,
  canDeleteDraft,
  canEditListing,
  canPerformListingAction,
  canViewListing,
  checkSubmissionRequirements,
  isAmenityAllowed,
  nextStatus,
  sellerTypeForRole,
  toMinorUnits,
} from '@walls/shared';
import type { ListingInput } from '@walls/validation';
import { AuditAction, AuditEntity, recordAudit } from '../audit/audit-log';
import { findUserById } from '../auth/auth.repository';
import type { Config } from '../config';
import { enqueueEmail } from '../email/outbox';
import { EmailTemplate } from '../email/templates';
import {
  AppError,
  ErrorCode,
  assertAllowed,
  notFound,
  submissionIncomplete,
  validationFailed,
} from '../http/errors';
import { webPageUrl } from '../http/web-links';
import {
  accessContext,
  submissionSnapshot,
  toListingDetail,
  toListingSummary,
} from './listing-view';
import {
  type ListingAggregate,
  type NewListing,
  findListingAggregate,
  findListingsForEditor,
  insertListing,
  insertProperty,
  insertStatusHistory,
  lockListing,
  replaceAmenities,
  replaceTexts,
  updateListing,
  updateProperty,
  upsertLocation,
} from './listings.repository';

const STATUS_CONFLICT = 409;

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

/**
 * Locks a listing the actor may edit as a draft. Published listings are edited through
 * revisions (Phase 6), so they are rejected here for now.
 */
export async function lockEditableDraft(db: DbExecutor, actor: Actor, id: string) {
  const listing = await lockListing(db, id);
  if (!listing) throw notFound();
  const decision = canEditListing(actor, accessContext(listing));
  assertAllowed(decision);
  if (decision.allowed && decision.mode !== ListingEditMode.DRAFT) {
    throw new AppError(
      STATUS_CONFLICT,
      ErrorCode.INVALID_STATE,
      'Editing published listings is not available yet',
    );
  }
  return listing;
}

/** English text is optional (SPEC §31): an empty translation is not stored, so pages fall back to Serbian. */
function textsToStore(texts: NonNullable<ListingInput['texts']>) {
  return texts.filter(
    (text) => text.locale === DEFAULT_LOCALE || text.title !== '' || text.description !== '',
  );
}

function priceColumns(price: NonNullable<ListingInput['price']>): Partial<NewListing> {
  if (price.mode === PriceMode.ON_REQUEST) {
    return {
      priceMode: PriceMode.ON_REQUEST,
      priceAmountMinor: null,
      priceCurrency: null,
      pricePeriod: null,
      priceNegotiable: false,
    };
  }
  return {
    priceMode: PriceMode.FIXED,
    priceAmountMinor: toMinorUnits(price.amount, price.currency),
    priceCurrency: price.currency,
    pricePeriod: price.period,
    priceNegotiable: price.negotiable,
  };
}

export class ListingsService {
  constructor(
    private readonly db: Database,
    private readonly config: Config,
  ) {}

  async create(actor: Actor): Promise<{ id: string }> {
    assertAllowed(canCreateListing(actor));
    const sellerType = sellerTypeForRole(actor.role)!;

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

  async listForEditor(actor: Actor): Promise<ListingSummary[]> {
    const rows = await findListingsForEditor(this.db, actor.id);
    return rows.map(toListingSummary);
  }

  async get(actor: Actor, id: string): Promise<ListingDetail> {
    return toListingDetail(await loadViewableListing(this.db, actor, id), actor);
  }

  /**
   * Saves a draft. Each section present in the input replaces that section; absent
   * sections are left unchanged. Drafts may be incomplete.
   */
  async updateDraft(actor: Actor, id: string, input: ListingInput): Promise<ListingDetail> {
    await this.db.transaction(async (tx) => {
      const listing = await lockEditableDraft(tx, actor, id);

      const transactionType =
        input.transactionType === undefined ? listing.transactionType : input.transactionType;
      const price = input.price ? priceColumns(input.price) : {};
      // The database only allows a rental period on RENT listings; check the merged state.
      const period = input.price ? (price.pricePeriod ?? null) : listing.pricePeriod;
      if (period !== null && transactionType !== TransactionType.RENT) {
        throw validationFailed(['price', 'period'], 'Only rental listings have a rental period');
      }

      // Features must apply to the (possibly new) property type (SPEC §10).
      const current = (await findListingAggregate(tx, id))!;
      const propertyType = input.propertyType ?? current.property.propertyType;
      if (input.amenityCodes) {
        if (!input.amenityCodes.every((code) => isAmenityAllowed(propertyType, code))) {
          throw validationFailed(
            ['amenityCodes'],
            'A feature does not apply to this property type',
          );
        }
        await replaceAmenities(tx, listing.propertyId, input.amenityCodes);
      } else if (input.propertyType) {
        const kept = current.amenityCodes.filter((code) => isAmenityAllowed(propertyType, code));
        if (kept.length !== current.amenityCodes.length) {
          await replaceAmenities(tx, listing.propertyId, kept);
        }
      }
      if (input.texts) await replaceTexts(tx, id, textsToStore(input.texts));
      if (input.location) {
        await upsertLocation(tx, {
          propertyId: listing.propertyId,
          country: input.location.country ?? null,
          city: input.location.city ?? null,
          municipality: input.location.municipality ?? null,
          neighborhood: input.location.neighborhood ?? null,
          street: input.location.street ?? null,
          streetNumber: input.location.streetNumber ?? null,
          postalCode: input.location.postalCode ?? null,
          latitude: input.location.latitude ?? null,
          longitude: input.location.longitude ?? null,
        });
      }
      await updateProperty(tx, listing.propertyId, {
        ...(input.propertyType ? { propertyType: input.propertyType } : {}),
        ...(input.attributes
          ? {
              floorArea: input.attributes.floorArea ?? null,
              plotArea: input.attributes.plotArea ?? null,
              bedrooms: input.attributes.bedrooms ?? null,
              bathrooms: input.attributes.bathrooms ?? null,
              floor: input.attributes.floor ?? null,
              totalFloors: input.attributes.totalFloors ?? null,
              yearBuilt: input.attributes.yearBuilt ?? null,
              parkingSpaces: input.attributes.parkingSpaces ?? null,
              heatingType: input.attributes.heatingType ?? null,
              furnishedStatus: input.attributes.furnishedStatus ?? null,
            }
          : {}),
      });
      await updateListing(tx, id, {
        ...(input.transactionType ? { transactionType: input.transactionType } : {}),
        ...price,
        ...(input.isExactAddressPublic === undefined
          ? {}
          : { isExactAddressPublic: input.isExactAddressPublic }),
      });
    });
    return this.get(actor, id);
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
      const issues = checkSubmissionRequirements(submissionSnapshot(aggregate));
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
