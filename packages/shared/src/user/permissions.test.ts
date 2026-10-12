import { describe, expect, it } from 'vitest';
import { DenialReason } from '../access/decision';
import { Role, UserStatus } from '../enums';
import { admin, agent, seller, superAdmin } from '../testing/fixtures';
import {
  canDeactivateUser,
  canInviteUser,
  canManageUser,
  canReactivateUser,
  canReviewAgentMatters,
  canViewAdministration,
  profileChangesRequireApproval,
  statusAfterReactivation,
} from './permissions';

const target = (role: Role) => ({ id: `target-${role}`, role });

describe('user management (SPEC §2.1)', () => {
  it('lets Super Admins manage admins and agents', () => {
    expect(canManageUser(superAdmin, target(Role.ADMIN)).allowed).toBe(true);
    expect(canManageUser(superAdmin, target(Role.REAL_ESTATE_AGENT)).allowed).toBe(true);
  });

  it('lets Admins manage agents but not admins or Super Admins', () => {
    expect(canManageUser(admin, target(Role.REAL_ESTATE_AGENT)).allowed).toBe(true);
    expect(canManageUser(admin, target(Role.ADMIN)).allowed).toBe(false);
    expect(canManageUser(admin, target(Role.SUPER_ADMIN)).allowed).toBe(false);
  });

  it('does not let anyone manage their own account', () => {
    expect(canManageUser(superAdmin, { id: superAdmin.id, role: Role.ADMIN }).allowed).toBe(false);
  });

  it('gives agents and sellers no user management', () => {
    expect(canManageUser(agent, target(Role.REAL_ESTATE_AGENT)).allowed).toBe(false);
    expect(canManageUser(seller, target(Role.PRIVATE_SELLER)).allowed).toBe(false);
  });

  it('lets only reviewers handle agent applications and profile change requests', () => {
    expect(canReviewAgentMatters(admin).allowed).toBe(true);
    expect(canReviewAgentMatters(agent).allowed).toBe(false);
  });

  it('requires approval for agent profile changes only (SPEC §4)', () => {
    expect(profileChangesRequireApproval(Role.REAL_ESTATE_AGENT)).toBe(true);
    expect(profileChangesRequireApproval(Role.PRIVATE_SELLER)).toBe(false);
  });
});

describe('deactivating accounts', () => {
  const active = (role: Role) => ({ ...target(role), status: UserStatus.ACTIVE });

  it.each([Role.PRIVATE_SELLER, Role.REAL_ESTATE_AGENT])('lets Admins deactivate a %s', (role) => {
    expect(canDeactivateUser(admin, active(role)).allowed).toBe(true);
  });

  it('lets only Super Admins deactivate Admins', () => {
    expect(canDeactivateUser(superAdmin, active(Role.ADMIN)).allowed).toBe(true);
    expect(canDeactivateUser(admin, active(Role.ADMIN)).allowed).toBe(false);
  });

  it('never deactivates Super Admins or the actor’s own account', () => {
    expect(canDeactivateUser(superAdmin, active(Role.SUPER_ADMIN)).allowed).toBe(false);
    expect(
      canDeactivateUser(admin, { id: admin.id, role: Role.ADMIN, status: UserStatus.ACTIVE })
        .allowed,
    ).toBe(false);
  });

  it('gives agents and sellers no way to deactivate anyone', () => {
    expect(canDeactivateUser(agent, active(Role.PRIVATE_SELLER)).allowed).toBe(false);
    expect(canDeactivateUser(seller, active(Role.PRIVATE_SELLER)).allowed).toBe(false);
  });

  it('treats an already deactivated account as a state conflict', () => {
    expect(
      canDeactivateUser(admin, { ...target(Role.PRIVATE_SELLER), status: UserStatus.DEACTIVATED }),
    ).toEqual({ allowed: false, reason: DenialReason.INVALID_STATE });
  });
});

describe('reactivating accounts (SPEC §2.1)', () => {
  const deactivatedSeller = {
    id: 'seller-x',
    role: Role.PRIVATE_SELLER,
    status: UserStatus.DEACTIVATED,
  };
  const deactivatedAdmin = { id: 'admin-x', role: Role.ADMIN, status: UserStatus.DEACTIVATED };

  it('mirrors who may deactivate', () => {
    expect(canReactivateUser(admin, deactivatedSeller).allowed).toBe(true);
    expect(canReactivateUser(admin, deactivatedAdmin).allowed).toBe(false);
    expect(canReactivateUser(superAdmin, deactivatedAdmin).allowed).toBe(true);
  });

  it('only applies to deactivated accounts', () => {
    const active = { ...deactivatedSeller, status: UserStatus.ACTIVE };
    expect(canReactivateUser(admin, active)).toEqual({
      allowed: false,
      reason: DenialReason.INVALID_STATE,
    });
  });

  it('returns accounts to where signup stopped', () => {
    expect(statusAfterReactivation({ hasPassword: true, emailVerified: true })).toBe('ACTIVE');
    expect(statusAfterReactivation({ hasPassword: true, emailVerified: false })).toBe(
      'PENDING_VERIFICATION',
    );
    expect(statusAfterReactivation({ hasPassword: false, emailVerified: true })).toBe(
      'PENDING_SETUP',
    );
  });
});

describe('inviting and administration views', () => {
  it('lets only Super Admins invite Admins', () => {
    expect(canInviteUser(superAdmin, Role.ADMIN).allowed).toBe(true);
    expect(canInviteUser(admin, Role.ADMIN).allowed).toBe(false);
    expect(canInviteUser(superAdmin, Role.SUPER_ADMIN).allowed).toBe(false);
  });

  it('lets Admins and Super Admins view users and the audit log', () => {
    expect(canViewAdministration(admin).allowed).toBe(true);
    expect(canViewAdministration(superAdmin).allowed).toBe(true);
    expect(canViewAdministration(seller).allowed).toBe(false);
  });
});
