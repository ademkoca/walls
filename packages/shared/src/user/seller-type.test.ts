import { describe, expect, it } from 'vitest';
import { Role, SellerType } from '../enums';
import {
  PROFESSIONAL_SELLER_TYPES,
  canBeAssigned,
  hasAgencyName,
  isSellerTypeValidForRole,
} from './seller-type';

describe('seller types (SPEC §2.1, §5)', () => {
  it('match the role: private sellers are private sellers, professionals one of three kinds', () => {
    expect(isSellerTypeValidForRole(Role.PRIVATE_SELLER, SellerType.PRIVATE_SELLER)).toBe(true);
    expect(isSellerTypeValidForRole(Role.PRIVATE_SELLER, SellerType.AGENCY)).toBe(false);
    for (const sellerType of PROFESSIONAL_SELLER_TYPES) {
      expect(isSellerTypeValidForRole(Role.REAL_ESTATE_AGENT, sellerType)).toBe(true);
    }
    expect(isSellerTypeValidForRole(Role.REAL_ESTATE_AGENT, SellerType.PRIVATE_SELLER)).toBe(false);
    expect(isSellerTypeValidForRole(Role.REAL_ESTATE_AGENT, null)).toBe(false);
  });

  it('are absent for accounts that do not advertise', () => {
    expect(isSellerTypeValidForRole(Role.ADMIN, null)).toBe(true);
    expect(isSellerTypeValidForRole(Role.SUPER_ADMIN, null)).toBe(true);
    expect(isSellerTypeValidForRole(Role.ADMIN, SellerType.AGENCY)).toBe(false);
  });

  it('let listings be assigned to agents and agencies, not investors or private sellers', () => {
    expect(canBeAssigned(SellerType.REAL_ESTATE_AGENT)).toBe(true);
    expect(canBeAssigned(SellerType.AGENCY)).toBe(true);
    expect(canBeAssigned(SellerType.INVESTOR)).toBe(false);
    expect(canBeAssigned(SellerType.PRIVATE_SELLER)).toBe(false);
    expect(canBeAssigned(null)).toBe(false);
  });

  it('give only individual agents an agency name', () => {
    expect(hasAgencyName(SellerType.REAL_ESTATE_AGENT)).toBe(true);
    expect(hasAgencyName(SellerType.AGENCY)).toBe(false);
    expect(hasAgencyName(SellerType.INVESTOR)).toBe(false);
    expect(hasAgencyName(SellerType.PRIVATE_SELLER)).toBe(false);
  });
});
