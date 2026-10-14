import type { Database } from '@walls/database';
import {
  type Actor,
  DenialReason,
  type InquiryCounts,
  type InquiryDetail,
  type InquiryStatus,
  type InquirySummary,
  type Page,
  type SentInquiry,
  UserStatus,
  canManageInquiry,
  canReplyToInquiry,
  canViewInquiry,
  isOwnListing,
  isReviewer,
  keepsSentInquiries,
  requireActive,
  resolveInquiryRecipientId,
} from '@walls/shared';
import type { InquiryData, InquiryListQuery } from '@walls/validation';
import { AuditAction, AuditEntity, recordAudit } from '../audit/audit-log';
import { findUserById } from '../auth/auth.repository';
import type { Config } from '../config';
import { enqueueEmail } from '../email/outbox';
import { EmailTemplate } from '../email/templates';
import { AppError, ErrorCode, assertAllowed, errorFromDenial, notFound } from '../http/errors';
import { toPage } from '../http/paging';
import { webPageUrl } from '../http/web-links';
import type { Logger } from '../logger';
import {
  type InquiryViewRow,
  countNewInquiries,
  countRecentInquiries,
  findInquirableListing,
  findInquiries,
  findInquiry,
  findSentInquiries,
  insertInquiry,
  lockInquiry,
  updateInquiryStatus,
} from './inquiries.repository';

const HOUR_MS = 3_600_000;
const STATUS_TOO_MANY_REQUESTS = 429;
const STATUS_FORBIDDEN = 403;
/** Inquiries one email address may send about one listing per day (decision, Phase 9). */
export const MAX_INQUIRIES_PER_EMAIL_PER_LISTING = 3;
const EMAIL_LIMIT_WINDOW_MS = 24 * HOUR_MS;
const PREVIEW_LENGTH = 140;

/** Dashboard path of an inquiry; used for email links. */
export const inquiryDashboardPath = (id: string) => `/dashboard/inquiries/${id}`;

function preview(message: string): string {
  const flat = message.replace(/\s+/g, ' ').trim();
  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH - 1)}…` : flat;
}

function accessOf(row: InquiryViewRow) {
  return {
    recipientUserId: row.inquiry.recipientUserId,
    listingCreatedById: row.listing.createdById,
  };
}

function toSummary(row: InquiryViewRow, actor: Actor): InquirySummary {
  const { inquiry, listing } = row;
  return {
    id: inquiry.id,
    listing: { id: listing.id, title: row.title, slug: listing.slug, status: listing.status },
    visitorName: inquiry.visitorName,
    preview: preview(inquiry.message),
    status: inquiry.status,
    canManage: canManageInquiry(actor, accessOf(row)).allowed,
    createdAt: inquiry.createdAt.toISOString(),
  };
}

function toDetail(row: InquiryViewRow, actor: Actor): InquiryDetail {
  const { inquiry } = row;
  return {
    ...toSummary(row, actor),
    visitorEmail: inquiry.visitorEmail,
    visitorPhone: inquiry.visitorPhone,
    canReply: canReplyToInquiry(actor, accessOf(row)).allowed,
    message: inquiry.message,
    fromRegisteredUser: inquiry.senderUserId !== null,
    recipient: row.recipient,
    assignedAgent: row.agent?.id ? { id: row.agent.id, displayName: row.agent.displayName } : null,
    updatedAt: inquiry.updatedAt.toISOString(),
  };
}

/**
 * Visitor inquiries (SPEC §20). The recipient is decided here, from the listing, when the
 * inquiry arrives; it is stored and never changes.
 */
export class InquiriesService {
  constructor(
    private readonly db: Database,
    private readonly config: Config,
    private readonly logger: Logger,
  ) {}

  /**
   * A visitor's inquiry about a public listing. A filled-in trap field marks a bot: the
   * inquiry is dropped without telling the sender, who gets the normal answer.
   *
   * A signed-in private seller or agent sends it under their account's name and email, and
   * it is linked to them for their "Sent" history. Nobody can ask about their own listing.
   */
  async create(slug: string, input: InquiryData, sender: Actor | null): Promise<void> {
    const { phone, message, website } = input;
    if (website !== '') {
      this.logger.info({ slug }, 'Inquiry dropped: trap field filled in');
      return;
    }
    const target = await findInquirableListing(this.db, slug);
    if (!target) throw notFound();
    const { listing } = target;
    if (sender && isOwnListing(sender.id, listing)) {
      throw new AppError(
        STATUS_FORBIDDEN,
        ErrorCode.FORBIDDEN,
        'You cannot send an inquiry about your own listing',
      );
    }
    const account =
      sender && sender.status === UserStatus.ACTIVE && keepsSentInquiries(sender.role)
        ? await findUserById(this.db, sender.id)
        : undefined;
    const name = account?.displayName ?? input.name;
    const email = account?.email ?? input.email;

    const since = new Date(Date.now() - EMAIL_LIMIT_WINDOW_MS);
    const recent = await countRecentInquiries(this.db, listing.id, email, since);
    if (recent >= MAX_INQUIRIES_PER_EMAIL_PER_LISTING) {
      throw new AppError(
        STATUS_TOO_MANY_REQUESTS,
        ErrorCode.RATE_LIMITED,
        'Too many inquiries about this listing from this email address',
      );
    }

    const recipientId = resolveInquiryRecipientId({
      createdById: listing.createdById,
      assignedAgent: target.assignedAgent,
    });
    const recipient = recipientId === target.creator.id ? target.creator : target.assignedAgent!;

    await this.db.transaction(async (tx) => {
      const inquiry = await insertInquiry(tx, {
        listingId: listing.id,
        recipientUserId: recipient.id,
        assignedAgentId: listing.assignedAgentId,
        senderUserId: account?.id ?? null,
        visitorName: name,
        visitorEmail: email,
        visitorPhone: phone || null,
        message,
      });
      await enqueueEmail(tx, {
        template: EmailTemplate.INQUIRY_RECEIVED,
        to: recipient.email,
        locale: recipient.preferredLocale,
        payload: {
          displayName: recipient.displayName,
          listingTitle: target.title ?? slug,
          visitorName: name,
          visitorEmail: email,
          visitorPhone: phone || null,
          message,
          link: webPageUrl(
            this.config.webOrigin,
            recipient.preferredLocale,
            inquiryDashboardPath(inquiry.id),
          ),
        },
      });
    });
  }

  async list(actor: Actor, query: InquiryListQuery): Promise<Page<InquirySummary>> {
    assertAllowed(requireActive(actor));
    const rows = await findInquiries(this.db, isReviewer(actor) ? null : actor.id, query);
    return toPage(rows, query.page, (row) => toSummary(row, actor));
  }

  async get(actor: Actor, id: string): Promise<InquiryDetail> {
    const row = await findInquiry(this.db, id);
    if (!row) throw notFound();
    assertAllowed(canViewInquiry(actor, accessOf(row)));
    return toDetail(row, actor);
  }

  async setStatus(actor: Actor, id: string, status: InquiryStatus): Promise<InquiryDetail> {
    await this.db.transaction(async (tx) => {
      const inquiry = await lockInquiry(tx, id);
      if (!inquiry) throw notFound();
      const row = await findInquiry(tx, id);
      assertAllowed(canManageInquiry(actor, accessOf(row!)));
      if (inquiry.status === status) return;
      await updateInquiryStatus(tx, id, status);
      await recordAudit(tx, {
        actorId: actor.id,
        action: AuditAction.INQUIRY_STATUS_CHANGED,
        entityType: AuditEntity.INQUIRY,
        entityId: id,
        before: { status: inquiry.status },
        after: { status },
      });
    });
    return this.get(actor, id);
  }

  /** The signed-in private seller's or agent's own sent inquiries (decision, Phase 9). */
  async sent(actor: Actor, page: number): Promise<Page<SentInquiry>> {
    assertAllowed(requireActive(actor));
    if (!keepsSentInquiries(actor.role)) throw errorFromDenial(DenialReason.ROLE_NOT_PERMITTED);
    const rows = await findSentInquiries(this.db, actor.id, page);
    return toPage(rows, page, (row) => ({
      id: row.inquiry.id,
      listing: {
        id: row.listing.id,
        title: row.title,
        slug: row.listing.slug,
        status: row.listing.status,
      },
      recipientName: row.recipientName,
      message: row.inquiry.message,
      createdAt: row.inquiry.createdAt.toISOString(),
    }));
  }

  async counts(actor: Actor): Promise<InquiryCounts> {
    assertAllowed(requireActive(actor));
    return { new: await countNewInquiries(this.db, isReviewer(actor) ? null : actor.id) };
  }
}
