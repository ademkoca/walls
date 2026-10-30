import type { Actor } from '../access/decision';
import { ListingStatus, Role, SellerType, TransactionType, UserStatus } from '../enums';
import type { ListingAccessContext } from '../listing/permissions';

/** Test-only builders. Not exported from the package entry point. */

const DEFAULT_SELLER_TYPE: Record<Role, SellerType | null> = {
  [Role.SUPER_ADMIN]: null,
  [Role.ADMIN]: null,
  [Role.REAL_ESTATE_AGENT]: SellerType.REAL_ESTATE_AGENT,
  [Role.PRIVATE_SELLER]: SellerType.PRIVATE_SELLER,
};

export function actor(role: Role, overrides: Partial<Actor> = {}): Actor {
  return {
    id: `${role.toLowerCase()}-1`,
    role,
    sellerType: DEFAULT_SELLER_TYPE[role],
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
export const agency = actor(Role.REAL_ESTATE_AGENT, {
  id: 'agency-a',
  sellerType: SellerType.AGENCY,
});
export const investor = actor(Role.REAL_ESTATE_AGENT, {
  id: 'investor-a',
  sellerType: SellerType.INVESTOR,
});

export function listing(overrides: Partial<ListingAccessContext> = {}): ListingAccessContext {
  return {
    createdById: seller.id,
    status: ListingStatus.DRAFT,
    transactionType: TransactionType.SALE,
    deletedAt: null,
    archivedByReviewer: false,
    ...overrides,
  };
}
