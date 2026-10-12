import { randomUUID } from 'node:crypto';
import type { Database, DbExecutor } from '@walls/database';
import {
  type Actor,
  ImageIssue,
  type MyProfile,
  PhoneVerificationStatus,
  canEditOwnProfile,
  checkAvatarImage,
  isPhoneRequired,
  profileChangesRequireApproval,
  publicProfilePath,
} from '@walls/shared';
import type { EmailChangeInput, ProfileInput } from '@walls/validation';
import { AuditAction, AuditEntity, recordAudit } from '../audit/audit-log';
import {
  type UserRow,
  deleteUnusedTokens,
  findPendingEmailChange,
  findUserByEmail,
  findUserById,
  updateUser,
} from '../auth/auth.repository';
import type { AuthService } from '../auth/auth.service';
import { enqueueEmail } from '../email/outbox';
import { EmailTemplate } from '../email/templates';
import {
  assertAllowed,
  emailInUse,
  invalidImage,
  unauthenticated,
  validationFailed,
} from '../http/errors';
import type { Logger } from '../logger';
import { inspectImage } from '../media/image-inspection';
import type { MediaStorage } from '../media/media-storage';
import { lockUser } from '../users/users.repository';
import {
  type Avatar,
  type Proposal,
  liveAvatar,
  liveProfile,
  liveProposal,
  profileFromInput,
  proposalChanges,
  proposalColumns,
  proposalOf,
  toChangeRequestView,
  toProfileView,
} from './profile-versions';
import {
  deleteChangeRequest,
  findLatestChangeRequest,
  insertChangeRequest,
  lockPendingChangeRequest,
  updateChangeRequest,
} from './profiles.repository';

/** Files to delete once the transaction that stopped referencing them has committed. */
type Cleanup = string[];

/**
 * A user's own profile (SPEC §4). Private sellers' changes apply immediately and are
 * audited; agents' changes become a single pending change request that an Admin reviews.
 * A new sign-in email always needs verification first.
 */
export class ProfilesService {
  constructor(
    private readonly db: Database,
    private readonly auth: AuthService,
    private readonly media: MediaStorage,
    private readonly logger: Logger,
  ) {}

  async get(actor: Actor): Promise<MyProfile> {
    assertAllowed(canEditOwnProfile(actor));
    const user = await findUserById(this.db, actor.id);
    if (!user) throw unauthenticated();
    const [request, pendingEmail] = await Promise.all([
      findLatestChangeRequest(this.db, user.id),
      findPendingEmailChange(this.db, user.id),
    ]);
    return {
      role: user.role,
      email: user.email,
      slug: user.slug,
      publicPath: publicProfilePath(user.role, user.slug),
      phoneVerificationStatus: user.phoneVerificationStatus,
      changesRequireApproval: profileChangesRequireApproval(user.role),
      live: toProfileView(liveProposal(user)),
      changeRequest: request ? toChangeRequestView(user, request) : null,
      pendingEmail,
    };
  }

  /** Runs `change` on the locked user row, then deletes files it orphaned. */
  private async withUser(
    actor: Actor,
    change: (tx: DbExecutor, user: UserRow, cleanup: Cleanup) => Promise<void>,
  ): Promise<MyProfile> {
    assertAllowed(canEditOwnProfile(actor));
    const cleanup: Cleanup = [];
    await this.db.transaction(async (tx) => {
      const user = await lockUser(tx, actor.id);
      if (!user) throw unauthenticated();
      await change(tx, user, cleanup);
    });
    for (const key of cleanup) this.deleteStored(key);
    return this.get(actor);
  }

  async update(actor: Actor, input: ProfileInput): Promise<MyProfile> {
    return this.withUser(actor, async (tx, user, cleanup) => {
      const profile = profileFromInput(user.role, input);
      if (isPhoneRequired(user.role) && !profile.phone) {
        throw validationFailed(['phone'], 'Agents must keep a phone number on their profile');
      }
      if (profileChangesRequireApproval(user.role)) {
        await this.propose(tx, user, cleanup, (current) => ({ ...current, profile }));
        return;
      }
      await this.applySellerChange(tx, user, { ...liveProposal(user), profile }, cleanup);
    });
  }

  async uploadAvatar(actor: Actor, data: Buffer): Promise<MyProfile> {
    assertAllowed(canEditOwnProfile(actor));
    const measured = inspectImage(data);
    const issues = measured ? checkAvatarImage(measured) : [ImageIssue.UNSUPPORTED_TYPE];
    if (!measured || issues.length > 0) throw invalidImage(issues);

    const stored = await this.media.put({
      key: `avatars/${actor.id}/${randomUUID()}`,
      data,
      contentType: measured.mimeType,
    });
    try {
      return await this.setAvatar(actor, stored);
    } catch (error) {
      this.deleteStored(stored.key);
      throw error;
    }
  }

  async removeAvatar(actor: Actor): Promise<MyProfile> {
    return this.setAvatar(actor, null);
  }

  private setAvatar(actor: Actor, avatar: Avatar | null): Promise<MyProfile> {
    return this.withUser(actor, async (tx, user, cleanup) => {
      if (profileChangesRequireApproval(user.role)) {
        await this.propose(tx, user, cleanup, (current) => ({ ...current, avatar }));
        return;
      }
      await this.applySellerChange(tx, user, { ...liveProposal(user), avatar }, cleanup);
    });
  }

  /** An agent withdraws their pending changes; the live profile stays as it is. */
  async discardChangeRequest(actor: Actor): Promise<MyProfile> {
    return this.withUser(actor, async (tx, user, cleanup) => {
      const pending = await lockPendingChangeRequest(tx, user.id);
      if (pending) await this.withdraw(tx, user, pending.id, proposalOf(pending), cleanup);
    });
  }

  /**
   * Saves an agent's proposal as their single pending change request (SPEC §4), creating it
   * from the live profile when none is pending. A proposal equal to the live profile
   * withdraws the request.
   */
  private async propose(
    tx: DbExecutor,
    user: UserRow,
    cleanup: Cleanup,
    edit: (current: Proposal) => Proposal,
  ): Promise<void> {
    const pending = await lockPendingChangeRequest(tx, user.id);
    const current = pending ? proposalOf(pending) : liveProposal(user);
    const next = edit(current);
    // A replaced, never-approved picture is no longer referenced by anything.
    if (current.avatar && current.avatar.key !== next.avatar?.key) {
      if (current.avatar.key !== user.avatarStorageKey) cleanup.push(current.avatar.key);
    }

    const changes = proposalChanges(user, next);
    if (changes.length === 0) {
      if (pending) await this.withdraw(tx, user, pending.id, next, cleanup);
      return;
    }
    if (pending) {
      await updateChangeRequest(tx, pending.id, proposalColumns(next));
    } else {
      await insertChangeRequest(tx, { userId: user.id, ...proposalColumns(next) });
    }
    await recordAudit(tx, {
      actorId: user.id,
      action: AuditAction.PROFILE_CHANGE_SAVED,
      entityType: AuditEntity.USER,
      entityId: user.id,
      after: { changes },
    });
  }

  private async withdraw(
    tx: DbExecutor,
    user: UserRow,
    requestId: string,
    proposal: Proposal,
    cleanup: Cleanup,
  ): Promise<void> {
    await deleteChangeRequest(tx, requestId);
    if (proposal.avatar && proposal.avatar.key !== user.avatarStorageKey) {
      cleanup.push(proposal.avatar.key);
    }
    await recordAudit(tx, {
      actorId: user.id,
      action: AuditAction.PROFILE_CHANGE_WITHDRAWN,
      entityType: AuditEntity.USER,
      entityId: user.id,
    });
  }

  /** A private seller's change: applied immediately and audited (SPEC §4). */
  private async applySellerChange(
    tx: DbExecutor,
    user: UserRow,
    next: Proposal,
    cleanup: Cleanup,
  ): Promise<void> {
    const changes = proposalChanges(user, next);
    if (changes.length === 0) return;
    const before = { ...liveProfile(user), avatar: liveAvatar(user)?.url ?? null };
    await updateUser(tx, user.id, {
      ...next.profile,
      avatarStorageKey: next.avatar?.key ?? null,
      avatarUrl: next.avatar?.url ?? null,
      // A different number has not been verified (SPEC §4).
      ...(next.profile.phone !== user.phone
        ? { phoneVerificationStatus: PhoneVerificationStatus.UNVERIFIED }
        : {}),
    });
    const previousAvatar = liveAvatar(user);
    if (previousAvatar && previousAvatar.key !== next.avatar?.key) cleanup.push(previousAvatar.key);
    await recordAudit(tx, {
      actorId: user.id,
      action: AuditAction.USER_PROFILE_UPDATED,
      entityType: AuditEntity.USER,
      entityId: user.id,
      before,
      after: { ...next.profile, avatar: next.avatar?.url ?? null, changes },
    });
  }

  /**
   * Starts an email change: the current password is checked and a link goes to the new
   * address. Nothing changes until the link is used.
   */
  async requestEmailChange(actor: Actor, input: EmailChangeInput): Promise<MyProfile> {
    assertAllowed(canEditOwnProfile(actor));
    const user = await findUserById(this.db, actor.id);
    if (!user) throw unauthenticated();
    await this.auth.verifyCurrentPassword(user, input.currentPassword);
    if (input.newEmail.toLowerCase() === user.email.toLowerCase()) {
      throw validationFailed(['newEmail'], 'This is already your email address');
    }
    await this.db.transaction(async (tx) => {
      if (await findUserByEmail(tx, input.newEmail)) throw emailInUse();
      await this.auth.sendEmailChangeLink(tx, user, input.newEmail);
      await recordAudit(tx, {
        actorId: user.id,
        action: AuditAction.USER_EMAIL_CHANGE_REQUESTED,
        entityType: AuditEntity.USER,
        entityId: user.id,
        after: { newEmail: input.newEmail },
      });
    });
    return this.get(actor);
  }

  async cancelEmailChange(actor: Actor): Promise<MyProfile> {
    assertAllowed(canEditOwnProfile(actor));
    await deleteUnusedTokens(this.db, actor.id, 'EMAIL_CHANGE');
    return this.get(actor);
  }

  /**
   * Redeems the link sent to the new address. A private seller's email changes now; an
   * agent's verified address joins their change request for Admin approval (SPEC §4).
   */
  async confirmEmailChange(token: string): Promise<{ awaitingApproval: boolean }> {
    const cleanup: Cleanup = [];
    const awaitingApproval = await this.db.transaction(async (tx) => {
      const { user: found, newEmail } = await this.auth.consumeEmailChangeToken(tx, token);
      const user = (await lockUser(tx, found.id))!;
      if (await findUserByEmail(tx, newEmail)) throw emailInUse();

      if (profileChangesRequireApproval(user.role)) {
        await this.propose(tx, user, cleanup, (current) => ({ ...current, newEmail }));
        return true;
      }
      await changeEmail(tx, user, newEmail, user.id);
      return false;
    });
    for (const key of cleanup) this.deleteStored(key);
    return { awaitingApproval };
  }

  /** Storage cleanup never fails the request; an orphaned file is only logged. */
  private deleteStored(key: string): void {
    this.media.delete(key).catch((error: unknown) => {
      this.logger.warn({ err: error, key }, 'Failed to delete a stored profile picture');
    });
  }
}

/**
 * Replaces the sign-in email with a verified new address, audits it and tells the old
 * address, so an unexpected change gets noticed.
 */
export async function changeEmail(
  tx: DbExecutor,
  user: UserRow,
  newEmail: string,
  actorId: string,
): Promise<void> {
  await updateUser(tx, user.id, { email: newEmail, emailVerifiedAt: new Date() });
  await recordAudit(tx, {
    actorId,
    action: AuditAction.USER_EMAIL_CHANGED,
    entityType: AuditEntity.USER,
    entityId: user.id,
    before: { email: user.email },
    after: { email: newEmail },
  });
  await enqueueEmail(tx, {
    template: EmailTemplate.EMAIL_CHANGED,
    to: user.email,
    locale: user.preferredLocale,
    payload: { displayName: user.displayName, newEmail },
  });
}
