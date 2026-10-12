import {
  type Actor,
  type Decision,
  DenialReason,
  allow,
  deny,
  firstDenial,
  isReviewer,
  requireActive,
} from '../access/decision';
import { Role, UserStatus } from '../enums';

type RoleMatrix = Readonly<Record<Role, readonly Role[]>>;

/**
 * Accounts each role may administer: invite/create and edit (SPEC §2.1).
 * Super Admins manage administrators and agents; Admins manage agents only.
 */
const MANAGEABLE_ROLES: RoleMatrix = {
  [Role.SUPER_ADMIN]: [Role.ADMIN, Role.REAL_ESTATE_AGENT],
  [Role.ADMIN]: [Role.REAL_ESTATE_AGENT],
  [Role.REAL_ESTATE_AGENT]: [],
  [Role.PRIVATE_SELLER]: [],
};

/**
 * Accounts each role may deactivate, e.g. for abuse (SPEC §2.1). Admins can deactivate
 * private sellers and agents; Super Admins can also deactivate Admins. Super Admin
 * accounts cannot be deactivated through the application.
 */
const DEACTIVATABLE_ROLES: RoleMatrix = {
  [Role.SUPER_ADMIN]: [Role.ADMIN, Role.REAL_ESTATE_AGENT, Role.PRIVATE_SELLER],
  [Role.ADMIN]: [Role.REAL_ESTATE_AGENT, Role.PRIVATE_SELLER],
  [Role.REAL_ESTATE_AGENT]: [],
  [Role.PRIVATE_SELLER]: [],
};

interface UserTarget {
  id: string;
  role: Role;
}

/** Shared checks: active actor, never their own account, and target role in the matrix. */
function canActOnOtherUser(actor: Actor, target: UserTarget, matrix: RoleMatrix): Decision {
  return firstDenial(
    () => requireActive(actor),
    () => (target.id === actor.id ? deny(DenialReason.ROLE_NOT_PERMITTED) : allow()),
    () =>
      matrix[actor.role].includes(target.role) ? allow() : deny(DenialReason.ROLE_NOT_PERMITTED),
  );
}

export function canManageUser(actor: Actor, target: UserTarget): Decision {
  return canActOnOtherUser(actor, target, MANAGEABLE_ROLES);
}

/**
 * Deactivating an account. The service must record the required reason in the audit log
 * and email the user about the decision.
 */
export function canDeactivateUser(
  actor: Actor,
  target: UserTarget & { status: UserStatus },
): Decision {
  return firstDenial(
    () => canActOnOtherUser(actor, target, DEACTIVATABLE_ROLES),
    () => (target.status === UserStatus.DEACTIVATED ? deny(DenialReason.INVALID_STATE) : allow()),
  );
}

/**
 * Reactivating a deactivated account: allowed to whoever may deactivate it (SPEC §2.1).
 * Like deactivation, it needs a reason, is audited and is emailed to the user.
 */
export function canReactivateUser(
  actor: Actor,
  target: UserTarget & { status: UserStatus },
): Decision {
  return firstDenial(
    () => canActOnOtherUser(actor, target, DEACTIVATABLE_ROLES),
    () => (target.status === UserStatus.DEACTIVATED ? allow() : deny(DenialReason.INVALID_STATE)),
  );
}

/**
 * The status a reactivated account returns to: active only when it had completed signup;
 * otherwise it continues where it stopped (email verification or account setup).
 */
export function statusAfterReactivation(account: {
  hasPassword: boolean;
  emailVerified: boolean;
}): UserStatus {
  if (!account.hasPassword) return UserStatus.PENDING_SETUP;
  if (!account.emailVerified) return UserStatus.PENDING_VERIFICATION;
  return UserStatus.ACTIVE;
}

/** Inviting a new account of `role` (an Admin, by a Super Admin); see MANAGEABLE_ROLES. */
export function canInviteUser(actor: Actor, role: Role): Decision {
  return firstDenial(
    () => requireActive(actor),
    () =>
      MANAGEABLE_ROLES[actor.role].includes(role) ? allow() : deny(DenialReason.ROLE_NOT_PERMITTED),
  );
}

/** Listing users and reading the audit log: Admins and Super Admins. */
export function canViewAdministration(actor: Actor): Decision {
  return firstDenial(
    () => requireActive(actor),
    () => (isReviewer(actor) ? allow() : deny(DenialReason.ROLE_NOT_PERMITTED)),
  );
}

/** Reviewing agent applications and agent profile change requests (SPEC §2.1, §4). */
export function canReviewAgentMatters(actor: Actor): Decision {
  return firstDenial(
    () => requireActive(actor),
    () => (isReviewer(actor) ? allow() : deny(DenialReason.ROLE_NOT_PERMITTED)),
  );
}

/** Whether a user's own profile changes need Admin approval before taking effect (SPEC §4). */
export function profileChangesRequireApproval(role: Role): boolean {
  return role === Role.REAL_ESTATE_AGENT;
}
