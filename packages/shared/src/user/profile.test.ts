import { describe, expect, it } from 'vitest';
import { Role, SellerType } from '../enums';
import {
  type ProfileVersion,
  ProfileField,
  diffProfile,
  hasPublicProfile,
  isPhoneRequired,
  normalizeProfile,
} from './profile';

const live: ProfileVersion = {
  displayName: 'Marko Marković',
  bio: null,
  agencyName: 'Kvadrat nekretnine',
  phone: '+381 64 123 4567',
  isPhonePublic: true,
  isEmailPublic: false,
  avatarKey: null,
  email: 'marko@example.com',
};

describe('public profiles (SPEC §19)', () => {
  it('exist for agents and private sellers only', () => {
    expect(hasPublicProfile(Role.REAL_ESTATE_AGENT)).toBe(true);
    expect(hasPublicProfile(Role.PRIVATE_SELLER)).toBe(true);
    expect(hasPublicProfile(Role.ADMIN)).toBe(false);
    expect(hasPublicProfile(Role.SUPER_ADMIN)).toBe(false);
  });

  it('always show a professional phone number, which professionals must therefore keep', () => {
    const agent = { role: Role.REAL_ESTATE_AGENT, sellerType: SellerType.REAL_ESTATE_AGENT };
    const normalized = normalizeProfile(agent, { ...live, isPhonePublic: false });
    expect(normalized).toMatchObject({ isPhonePublic: true, agencyName: 'Kvadrat nekretnine' });
    expect(isPhoneRequired(Role.REAL_ESTATE_AGENT)).toBe(true);
    expect(isPhoneRequired(Role.PRIVATE_SELLER)).toBe(false);
  });

  it('let private sellers hide their phone, and drop an agency name they cannot have', () => {
    const seller = { role: Role.PRIVATE_SELLER, sellerType: SellerType.PRIVATE_SELLER };
    const normalized = normalizeProfile(seller, { ...live, isPhonePublic: false });
    expect(normalized).toMatchObject({ isPhonePublic: false, agencyName: null });
  });

  it('keep the agency name for agents only: an agency or investor is named by its display name', () => {
    for (const sellerType of [SellerType.AGENCY, SellerType.INVESTOR]) {
      const normalized = normalizeProfile({ role: Role.REAL_ESTATE_AGENT, sellerType }, live);
      expect(normalized).toMatchObject({ isPhonePublic: true, agencyName: null });
    }
  });
});

describe('profile changes (SPEC §4)', () => {
  it('lists nothing for an identical version', () => {
    expect(diffProfile(live, { ...live })).toEqual([]);
  });

  it('lists each changed field in display order', () => {
    expect(
      diffProfile(live, {
        ...live,
        email: 'novi@example.com',
        bio: 'Iskusan agent.',
        avatarKey: 'avatars/new.jpg',
      }),
    ).toEqual([ProfileField.BIO, ProfileField.AVATAR, ProfileField.EMAIL]);
  });

  it('ignores letter case in email addresses, like the database does', () => {
    expect(diffProfile(live, { ...live, email: 'Marko@Example.com' })).toEqual([]);
  });
});
