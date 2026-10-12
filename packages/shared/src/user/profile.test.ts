import { describe, expect, it } from 'vitest';
import { Role } from '../enums';
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

  it('always show an agent phone number, which agents must therefore keep', () => {
    const normalized = normalizeProfile(Role.REAL_ESTATE_AGENT, { ...live, isPhonePublic: false });
    expect(normalized.isPhonePublic).toBe(true);
    expect(isPhoneRequired(Role.REAL_ESTATE_AGENT)).toBe(true);
    expect(isPhoneRequired(Role.PRIVATE_SELLER)).toBe(false);
  });

  it('let private sellers hide their phone, and drop an agency name they cannot have', () => {
    const normalized = normalizeProfile(Role.PRIVATE_SELLER, { ...live, isPhonePublic: false });
    expect(normalized).toMatchObject({ isPhonePublic: false, agencyName: null });
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
