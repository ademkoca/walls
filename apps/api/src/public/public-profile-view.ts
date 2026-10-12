import { type PublicProfile, Role, isPhoneAlwaysPublic, toPublicPhoneContact } from '@walls/shared';
import type { UserRow } from '../auth/auth.repository';

/**
 * A user's public profile (SPEC §19): only approved public fields, never internal data,
 * application documents, or an email the user did not make public.
 */
export function toPublicProfile(user: UserRow): PublicProfile {
  const phoneIsPublic = isPhoneAlwaysPublic(user.role) || user.isPhonePublic;
  return {
    slug: user.slug,
    role: user.role,
    displayName: user.displayName,
    bio: user.bio,
    agencyName: user.role === Role.REAL_ESTATE_AGENT ? user.agencyName : null,
    avatarUrl: user.avatarUrl,
    phone: phoneIsPublic ? toPublicPhoneContact(user.phone, user.phoneVerificationStatus) : null,
    email: user.isEmailPublic ? user.email : null,
    // Agent accounts exist only after an Admin approved the application (SPEC §2.1).
    approvedAgent: user.role === Role.REAL_ESTATE_AGENT,
    memberSince: user.createdAt.toISOString(),
  };
}
