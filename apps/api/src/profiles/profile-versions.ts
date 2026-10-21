import {
  type EditableProfile,
  type ProfileChangeRequestView,
  type ProfileVersion,
  type ProfileView,
  type SellerAccount,
  diffProfile,
  normalizeProfile,
} from '@walls/shared';
import type { ProfileInput } from '@walls/validation';
import type { UserRow } from '../auth/auth.repository';
import type { ChangeRequestRow, NewChangeRequest } from './profiles.repository';

/** A stored profile picture: the storage key plus its delivery URL. */
export interface Avatar {
  key: string;
  url: string;
}

/** A complete proposed profile, as stored in a change request. */
export interface Proposal {
  profile: EditableProfile;
  avatar: Avatar | null;
  /** A verified new email address, or null to keep the current one. */
  newEmail: string | null;
}

const emptyToNull = (value: string) => value.trim() || null;

/** Form input → the stored profile for the user's account (empty strings become null). */
export function profileFromInput(account: SellerAccount, input: ProfileInput): EditableProfile {
  return normalizeProfile(account, {
    displayName: input.displayName,
    bio: emptyToNull(input.bio),
    agencyName: emptyToNull(input.agencyName),
    phone: emptyToNull(input.phone),
    isPhonePublic: input.isPhonePublic,
    isEmailPublic: input.isEmailPublic,
  });
}

/** The live profile, read through the account rules (a professional's phone is always public). */
export function liveProfile(user: UserRow): EditableProfile {
  return normalizeProfile(user, {
    displayName: user.displayName,
    bio: user.bio,
    agencyName: user.agencyName,
    phone: user.phone,
    isPhonePublic: user.isPhonePublic,
    isEmailPublic: user.isEmailPublic,
  });
}

export function liveAvatar(user: UserRow): Avatar | null {
  return user.avatarStorageKey && user.avatarUrl
    ? { key: user.avatarStorageKey, url: user.avatarUrl }
    : null;
}

export function liveProposal(user: UserRow): Proposal {
  return { profile: liveProfile(user), avatar: liveAvatar(user), newEmail: null };
}

export function proposalOf(request: ChangeRequestRow): Proposal {
  return {
    profile: {
      displayName: request.displayName,
      bio: request.bio,
      agencyName: request.agencyName,
      phone: request.phone,
      isPhonePublic: request.isPhonePublic,
      isEmailPublic: request.isEmailPublic,
    },
    avatar:
      request.avatarStorageKey && request.avatarUrl
        ? { key: request.avatarStorageKey, url: request.avatarUrl }
        : null,
    newEmail: request.newEmail,
  };
}

/** The columns of a change request that hold a proposal. */
export function proposalColumns(
  proposal: Proposal,
): Omit<NewChangeRequest, 'id' | 'userId' | 'status'> {
  return {
    ...proposal.profile,
    avatarStorageKey: proposal.avatar?.key ?? null,
    avatarUrl: proposal.avatar?.url ?? null,
    newEmail: proposal.newEmail,
  };
}

function versionOf(proposal: Proposal, currentEmail: string): ProfileVersion {
  return {
    ...proposal.profile,
    avatarKey: proposal.avatar?.key ?? null,
    email: proposal.newEmail ?? currentEmail,
  };
}

/** What a proposal would change on the user's live profile. */
export function proposalChanges(user: UserRow, proposal: Proposal) {
  return diffProfile(versionOf(liveProposal(user), user.email), versionOf(proposal, user.email));
}

export function toProfileView(proposal: Proposal): ProfileView {
  return { ...proposal.profile, avatarUrl: proposal.avatar?.url ?? null };
}

export function toChangeRequestView(
  user: UserRow,
  request: ChangeRequestRow,
): ProfileChangeRequestView {
  const proposal = proposalOf(request);
  return {
    id: request.id,
    status: request.status,
    proposed: toProfileView(proposal),
    newEmail: request.newEmail,
    changes: proposalChanges(user, proposal),
    rejectionReason: request.rejectionReason,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
  };
}
