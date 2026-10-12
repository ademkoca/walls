import type { Actor } from '../access/decision';
import { ListingStatus, Role, TransactionType, UserStatus } from '../enums';
import type { ListingAccessContext } from '../listing/permissions';

/** Test-only builders. Not exported from the package entry point. */

export function actor(role: Role, overrides: Partial<Actor> = {}): Actor {
  return {
    id: `${role.toLowerCase()}-1`,
    role,
    status: UserStatus.ACTIVE,
    emailVerified: true,
    ...overrides,
  };
}

export const superAdmin = actor(Role.SUPER_ADMIN);
export const admin = actor(Role.ADMIN);
export const seller = actor(Role.PRIVATE_SELLER, { id: 'seller-a' });
export const otherSeller = actor(Role.PRIVATE_SELLER, { id: 'seller-b' });
export const agent = actor(Role.REAL_ESTATE_AGENT, { id: 'agent-a' });
export const otherAgent = actor(Role.REAL_ESTATE_AGENT, { id: 'agent-b' });

export function listing(overrides: Partial<ListingAccessContext> = {}): ListingAccessContext {
  return {
    createdById: seller.id,
    assignedAgentId: null,
    status: ListingStatus.DRAFT,
    transactionType: TransactionType.SALE,
    deletedAt: null,
    ...overrides,
  };
}
