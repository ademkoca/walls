import { Role } from '../enums';

/** Roles with a public profile page: approved agents and private sellers (SPEC §19). */
export function hasPublicProfile(role: Role): boolean {
  return role === Role.REAL_ESTATE_AGENT || role === Role.PRIVATE_SELLER;
}

/**
 * Agents' phone numbers are always shown publicly; private sellers choose whether to show
 * theirs. An email address is public only when its owner opts in (decision, Phase 7).
 */
export function isPhoneAlwaysPublic(role: Role): boolean {
  return role === Role.REAL_ESTATE_AGENT;
}

/** Agents must keep a phone number on their profile, since it is always public. */
export function isPhoneRequired(role: Role): boolean {
  return isPhoneAlwaysPublic(role);
}

/** The agency name is a professional detail of agents only. */
export function hasAgencyName(role: Role): boolean {
  return role === Role.REAL_ESTATE_AGENT;
}

/** Profile fields a user edits themselves (SPEC §4). Email changes have their own flow. */
export interface EditableProfile {
  displayName: string;
  bio: string | null;
  agencyName: string | null;
  phone: string | null;
  isPhonePublic: boolean;
  isEmailPublic: boolean;
}

/**
 * The stored form of a profile for `role`: agents' phones are always public and only agents
 * have an agency name. Applied by the API to whatever the client sends.
 */
export function normalizeProfile(role: Role, profile: EditableProfile): EditableProfile {
  return {
    ...profile,
    agencyName: hasAgencyName(role) ? profile.agencyName : null,
    isPhonePublic: isPhoneAlwaysPublic(role) ? true : profile.isPhonePublic,
  };
}

/** A part of the profile, used to list what a change request changes. */
export const ProfileField = {
  DISPLAY_NAME: 'DISPLAY_NAME',
  BIO: 'BIO',
  AGENCY_NAME: 'AGENCY_NAME',
  PHONE: 'PHONE',
  PHONE_PUBLIC: 'PHONE_PUBLIC',
  EMAIL_PUBLIC: 'EMAIL_PUBLIC',
  AVATAR: 'AVATAR',
  EMAIL: 'EMAIL',
} as const;
export type ProfileField = (typeof ProfileField)[keyof typeof ProfileField];

/** A complete profile version: the editable fields, avatar and email. */
export interface ProfileVersion extends EditableProfile {
  /** Provider-agnostic storage key of the profile picture, or null for none. */
  avatarKey: string | null;
  email: string;
}

const FIELD_ACCESSORS: readonly [ProfileField, (version: ProfileVersion) => unknown][] = [
  [ProfileField.DISPLAY_NAME, (version) => version.displayName],
  [ProfileField.BIO, (version) => version.bio],
  [ProfileField.AGENCY_NAME, (version) => version.agencyName],
  [ProfileField.PHONE, (version) => version.phone],
  [ProfileField.PHONE_PUBLIC, (version) => version.isPhonePublic],
  [ProfileField.EMAIL_PUBLIC, (version) => version.isEmailPublic],
  [ProfileField.AVATAR, (version) => version.avatarKey],
  [ProfileField.EMAIL, (version) => version.email.toLowerCase()],
];

/** The fields that differ between two profile versions, in display order. */
export function diffProfile(live: ProfileVersion, proposed: ProfileVersion): ProfileField[] {
  return FIELD_ACCESSORS.filter(([, read]) => read(live) !== read(proposed)).map(
    ([field]) => field,
  );
}
