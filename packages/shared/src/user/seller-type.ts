import { Role, SellerType } from '../enums';

/**
 * The kinds of approved professional advertiser (SPEC §2.1). Each joins through the
 * professional application and has the `REAL_ESTATE_AGENT` role.
 */
export const PROFESSIONAL_SELLER_TYPES = [
  SellerType.REAL_ESTATE_AGENT,
  SellerType.AGENCY,
  SellerType.INVESTOR,
] as const;
export type ProfessionalSellerType = (typeof PROFESSIONAL_SELLER_TYPES)[number];

/** A user's role together with their kind of advertiser, as stored on the account. */
export interface SellerAccount {
  role: Role;
  /** Null for accounts that do not advertise (Admins, Super Admins). */
  sellerType: SellerType | null;
}

export function isProfessionalSellerType(
  sellerType: SellerType | null,
): sellerType is ProfessionalSellerType {
  return (PROFESSIONAL_SELLER_TYPES as readonly (SellerType | null)[]).includes(sellerType);
}

/**
 * Whether a role and kind of advertiser belong together, mirroring the database check:
 * private sellers are PRIVATE_SELLER, professionals one of the professional types, and
 * accounts that do not advertise have none.
 */
export function isSellerTypeValidForRole(role: Role, sellerType: SellerType | null): boolean {
  switch (role) {
    case Role.PRIVATE_SELLER:
      return sellerType === SellerType.PRIVATE_SELLER;
    case Role.REAL_ESTATE_AGENT:
      return isProfessionalSellerType(sellerType);
    default:
      return sellerType === null;
  }
}

/** The agency someone works for is a detail of individual agents only. */
export function hasAgencyName(sellerType: SellerType | null): boolean {
  return sellerType === SellerType.REAL_ESTATE_AGENT;
}
