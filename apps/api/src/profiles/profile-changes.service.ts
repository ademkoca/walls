import type { Database, DbExecutor } from '@walls/database';
import {
  type Actor,
  DenialReason,
  type Page,
  PhoneVerificationStatus,
  type ProfileChangeRequestDetail,
  type ProfileChangeRequestSummary,
  ReviewStatus,
  canReviewAgentMatters,
  publicProfilePath,
} from '@walls/shared';
import type { ReviewQueueQuery } from '@walls/validation';
import { AuditAction, AuditEntity, recordAudit } from '../audit/audit-log';
import { findUserByEmail, updateUser } from '../auth/auth.repository';
import type { Config } from '../config';
import { enqueueEmail } from '../email/outbox';
import { EmailTemplate } from '../email/templates';
import { assertAllowed, emailInUse, errorFromDenial, notFound } from '../http/errors';
import { toPage } from '../http/paging';
import { webPageUrl } from '../http/web-links';
import type { Logger } from '../logger';
import type { MediaStorage } from '../media/media-storage';
import { lockUser } from '../users/users.repository';
import {
  liveAvatar,
  liveProfile,
  liveProposal,
  proposalChanges,
  proposalOf,
  toChangeRequestView,
  toProfileView,
} from './profile-versions';
import {
  countPendingChangeRequests,
  findChangeRequest,
  findChangeRequests,
  lockChangeRequest,
  updateChangeRequest,
} from './profiles.repository';
import { changeEmail } from './profiles.service';

const PROFILE_DASHBOARD_PATH = '/dashboard/profile';

/** Admin review of agents' profile change requests (SPEC §4). */
export class ProfileChangesService {
  constructor(
    private readonly db: Database,
    private readonly config: Config,
    private readonly media: MediaStorage,
    private readonly logger: Logger,
  ) {}

  async list(actor: Actor, query: ReviewQueueQuery): Promise<Page<ProfileChangeRequestSummary>> {
    assertAllowed(canReviewAgentMatters(actor));
    const rows = await findChangeRequests(this.db, query);
    return toPage(rows, query.page, ({ request, user }) => ({
      id: request.id,
      user: { id: user.id, displayName: user.displayName, email: user.email },
      changes: proposalChanges(user, proposalOf(request)),
      status: request.status,
      updatedAt: request.updatedAt.toISOString(),
    }));
  }

  async get(actor: Actor, id: string): Promise<ProfileChangeRequestDetail> {
    assertAllowed(canReviewAgentMatters(actor));
    const row = await findChangeRequest(this.db, id);
    if (!row) throw notFound();
    const { request, user } = row;
    return {
      ...toChangeRequestView(user, request),
      user: { id: user.id, displayName: user.displayName, email: user.email, slug: user.slug },
      live: toProfileView(liveProposal(user)),
      reviewedBy: row.reviewedBy?.id ? row.reviewedBy : null,
      canReview: request.status === ReviewStatus.PENDING,
    };
  }

  private async lockPending(actor: Actor, tx: DbExecutor, id: string) {
    assertAllowed(canReviewAgentMatters(actor));
    const request = await lockChangeRequest(tx, id);
    if (!request) throw notFound();
    if (request.status !== ReviewStatus.PENDING) throw errorFromDenial(DenialReason.INVALID_STATE);
    const user = (await lockUser(tx, request.userId))!;
    return { request, user };
  }

  /** Publishes the proposed profile; a new email address replaces the sign-in email. */
  async approve(actor: Actor, id: string): Promise<ProfileChangeRequestDetail> {
    let orphanedAvatar: string | null = null;
    await this.db.transaction(async (tx) => {
      const { request, user } = await this.lockPending(actor, tx, id);
      const proposal = proposalOf(request);
      const changes = proposalChanges(user, proposal);

      await updateUser(tx, user.id, {
        ...proposal.profile,
        avatarStorageKey: proposal.avatar?.key ?? null,
        avatarUrl: proposal.avatar?.url ?? null,
        // A different number has not been verified (SPEC §4).
        ...(proposal.profile.phone !== user.phone
          ? { phoneVerificationStatus: PhoneVerificationStatus.UNVERIFIED }
          : {}),
      });
      if (proposal.newEmail && proposal.newEmail.toLowerCase() !== user.email.toLowerCase()) {
        if (await findUserByEmail(tx, proposal.newEmail)) throw emailInUse();
        await changeEmail(tx, user, proposal.newEmail, actor.id);
      }
      const previousAvatar = liveAvatar(user);
      if (previousAvatar && previousAvatar.key !== proposal.avatar?.key) {
        orphanedAvatar = previousAvatar.key;
      }

      await updateChangeRequest(tx, id, {
        status: ReviewStatus.APPROVED,
        reviewedById: actor.id,
        reviewedAt: new Date(),
      });
      await recordAudit(tx, {
        actorId: actor.id,
        action: AuditAction.PROFILE_CHANGE_APPROVED,
        entityType: AuditEntity.USER,
        entityId: user.id,
        before: { ...liveProfile(user), avatar: user.avatarUrl },
        after: { ...proposal.profile, avatar: proposal.avatar?.url ?? null, changes },
      });
      const publicPath = publicProfilePath(user.role, user.slug) ?? PROFILE_DASHBOARD_PATH;
      await enqueueEmail(tx, {
        template: EmailTemplate.PROFILE_CHANGES_APPROVED,
        to: proposal.newEmail ?? user.email,
        locale: user.preferredLocale,
        payload: {
          displayName: proposal.profile.displayName,
          link: webPageUrl(this.config.webOrigin, user.preferredLocale, publicPath),
        },
      });
    });
    if (orphanedAvatar) this.deleteStored(orphanedAvatar);
    return this.get(actor, id);
  }

  /** Keeps the live profile; the reason is emailed to the agent. */
  async reject(actor: Actor, id: string, reason: string): Promise<ProfileChangeRequestDetail> {
    let orphanedAvatar: string | null = null;
    await this.db.transaction(async (tx) => {
      const { request, user } = await this.lockPending(actor, tx, id);
      const proposal = proposalOf(request);
      if (proposal.avatar && proposal.avatar.key !== user.avatarStorageKey) {
        orphanedAvatar = proposal.avatar.key;
      }
      await updateChangeRequest(tx, id, {
        status: ReviewStatus.REJECTED,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        rejectionReason: reason,
      });
      await recordAudit(tx, {
        actorId: actor.id,
        action: AuditAction.PROFILE_CHANGE_REJECTED,
        entityType: AuditEntity.USER,
        entityId: user.id,
        after: { changes: proposalChanges(user, proposal) },
        reason,
      });
      await enqueueEmail(tx, {
        template: EmailTemplate.PROFILE_CHANGES_REJECTED,
        to: user.email,
        locale: user.preferredLocale,
        payload: {
          displayName: user.displayName,
          reason,
          link: webPageUrl(this.config.webOrigin, user.preferredLocale, PROFILE_DASHBOARD_PATH),
        },
      });
    });
    if (orphanedAvatar) this.deleteStored(orphanedAvatar);
    return this.get(actor, id);
  }

  async pendingCount(): Promise<number> {
    return countPendingChangeRequests(this.db);
  }

  private deleteStored(key: string): void {
    this.media.delete(key).catch((error: unknown) => {
      this.logger.warn({ err: error, key }, 'Failed to delete a stored profile picture');
    });
  }
}
