import type { Database } from '@walls/database';
import {
  type Actor,
  type AuditLogEntry,
  type Page,
  Role,
  type UserDetail,
  UserStatus,
  type UserSummary,
  canDeactivateUser,
  canInviteUser,
  canReactivateUser,
  canViewAdministration,
  statusAfterReactivation,
} from '@walls/shared';
import type { AuditLogQuery, InviteAdminInput, UserListQuery } from '@walls/validation';
import { findApplicationOfUser } from '../agents/agent-applications.repository';
import { AuditAction, AuditEntity, recordAudit } from '../audit/audit-log';
import {
  type UserRow,
  deleteSessionsForUser,
  findUserById,
  updateUser,
} from '../auth/auth.repository';
import type { AuthService } from '../auth/auth.service';
import type { Config } from '../config';
import { enqueueEmail } from '../email/outbox';
import { EmailTemplate } from '../email/templates';
import { assertAllowed, notFound } from '../http/errors';
import { webPageUrl } from '../http/web-links';
import { toPage } from '../http/paging';
import { countListingsCreatedBy, findAuditEntries, findUsers, lockUser } from './users.repository';

function toUserSummary(user: UserRow): UserSummary {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    deactivatedAt: user.deactivatedAt?.toISOString() ?? null,
  };
}

/**
 * User administration (SPEC §2.1): listing accounts, deactivating and reactivating them,
 * inviting Admins, and reading the audit log.
 */
export class UsersService {
  constructor(
    private readonly db: Database,
    private readonly config: Config,
    private readonly auth: AuthService,
  ) {}

  async list(actor: Actor, query: UserListQuery): Promise<Page<UserSummary>> {
    assertAllowed(canViewAdministration(actor));
    const rows = await findUsers(this.db, {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q ? { q: query.q } : {}),
      page: query.page,
    });
    return toPage(rows, query.page, toUserSummary);
  }

  async get(actor: Actor, id: string): Promise<UserDetail> {
    assertAllowed(canViewAdministration(actor));
    const user = await findUserById(this.db, id);
    if (!user) throw notFound();
    const application = await findApplicationOfUser(this.db, id);
    return {
      ...toUserSummary(user),
      emailVerified: user.emailVerifiedAt !== null,
      listingCount: await countListingsCreatedBy(this.db, id),
      agentApplication: application
        ? {
            id: application.application.id,
            reviewedAt: application.application.reviewedAt?.toISOString() ?? null,
            files: application.files.map((file) => ({
              id: file.id,
              fileName: file.originalFileName,
              mimeType: file.mimeType,
              bytes: file.bytes,
            })),
          }
        : null,
      permissions: {
        canDeactivate: canDeactivateUser(actor, user).allowed,
        canReactivate: canReactivateUser(actor, user).allowed,
      },
    };
  }

  /**
   * Deactivates an account: the user is signed out everywhere, cannot sign in, and their
   * listings are hidden from the public site until reactivation (SPEC §2.1).
   */
  async deactivate(actor: Actor, id: string, reason: string): Promise<UserDetail> {
    await this.db.transaction(async (tx) => {
      const user = await lockUser(tx, id);
      if (!user) throw notFound();
      assertAllowed(canDeactivateUser(actor, user));

      await updateUser(tx, id, { status: UserStatus.DEACTIVATED, deactivatedAt: new Date() });
      await deleteSessionsForUser(tx, id);
      await recordAudit(tx, {
        actorId: actor.id,
        action: AuditAction.USER_DEACTIVATED,
        entityType: AuditEntity.USER,
        entityId: id,
        before: { status: user.status },
        after: { status: UserStatus.DEACTIVATED },
        reason,
      });
      await enqueueEmail(tx, {
        template: EmailTemplate.ACCOUNT_DEACTIVATED,
        to: user.email,
        locale: user.preferredLocale,
        payload: { displayName: user.displayName, reason },
      });
    });
    return this.get(actor, id);
  }

  /** Reactivates an account, returning it to where its signup stopped. */
  async reactivate(actor: Actor, id: string, reason: string): Promise<UserDetail> {
    await this.db.transaction(async (tx) => {
      const user = await lockUser(tx, id);
      if (!user) throw notFound();
      assertAllowed(canReactivateUser(actor, user));

      const status = statusAfterReactivation({
        hasPassword: user.passwordHash !== null,
        emailVerified: user.emailVerifiedAt !== null,
      });
      await updateUser(tx, id, { status, deactivatedAt: null });
      await recordAudit(tx, {
        actorId: actor.id,
        action: AuditAction.USER_REACTIVATED,
        entityType: AuditEntity.USER,
        entityId: id,
        before: { status: user.status },
        after: { status },
        reason,
      });
      await enqueueEmail(tx, {
        template: EmailTemplate.ACCOUNT_REACTIVATED,
        to: user.email,
        locale: user.preferredLocale,
        payload: {
          displayName: user.displayName,
          reason,
          loginLink: webPageUrl(this.config.webOrigin, user.preferredLocale, '/login'),
        },
      });
    });
    return this.get(actor, id);
  }

  /** A Super Admin invites an Admin; the invitee sets their password from the email. */
  async inviteAdmin(actor: Actor, input: InviteAdminInput): Promise<UserDetail> {
    assertAllowed(canInviteUser(actor, Role.ADMIN));
    const user = await this.auth.inviteUser({ ...input, role: Role.ADMIN }, actor.id);
    return this.get(actor, user.id);
  }

  async auditLog(actor: Actor, query: AuditLogQuery): Promise<Page<AuditLogEntry>> {
    assertAllowed(canViewAdministration(actor));
    const rows = await findAuditEntries(this.db, {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      page: query.page,
    });
    return toPage(rows, query.page, ({ entry, actor: entryActor }) => ({
      id: entry.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      actor: entryActor,
      before: entry.before,
      after: entry.after,
      reason: entry.reason,
      createdAt: entry.createdAt.toISOString(),
    }));
  }
}
