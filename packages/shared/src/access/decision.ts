import { Role, type SellerType, UserStatus } from '../enums';

/** Why an action is not allowed. The API maps each reason to an HTTP status. */
export const DenialReason = {
  /** The account is not active (unverified, pending setup, or deactivated). */
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  /** The actor's role may never perform this action. */
  ROLE_NOT_PERMITTED: 'ROLE_NOT_PERMITTED',
  /** The actor's role may perform it, but not on this resource. */
  NOT_RESOURCE_PARTICIPANT: 'NOT_RESOURCE_PARTICIPANT',
  /** The resource is in a state where this action is not allowed. */
  INVALID_STATE: 'INVALID_STATE',
  RESOURCE_DELETED: 'RESOURCE_DELETED',
} as const;
export type DenialReason = (typeof DenialReason)[keyof typeof DenialReason];

export type Decision = { allowed: true } | { allowed: false; reason: DenialReason };

export const allow = (): Decision => ({ allowed: true });
export const deny = (reason: DenialReason): Decision => ({ allowed: false, reason });

/** The authenticated user, as loaded server-side from the session. Never built from client input. */
export interface Actor {
  id: string;
  role: Role;
  /** The kind of advertiser the account is (SPEC §5); null for Admins and Super Admins. */
  sellerType: SellerType | null;
  status: UserStatus;
  emailVerified: boolean;
}

/** Admins and Super Admins review listings and manage platform data (SPEC §2.1). */
export function isReviewer(actor: Pick<Actor, 'role'>): boolean {
  return actor.role === Role.ADMIN || actor.role === Role.SUPER_ADMIN;
}

/** Every dashboard action requires an active account. */
export function requireActive(actor: Actor): Decision {
  return actor.status === UserStatus.ACTIVE ? allow() : deny(DenialReason.ACCOUNT_INACTIVE);
}

/** Returns the first denial, or allow if every check passes. Checks run lazily in order. */
export function firstDenial(...checks: (() => Decision)[]): Decision {
  for (const check of checks) {
    const decision = check();
    if (!decision.allowed) return decision;
  }
  return allow();
}
