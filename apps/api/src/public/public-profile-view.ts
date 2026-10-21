import {
  type PublicProfile,
  type SellerType,
  hasAgencyName,
  isPhoneAlwaysPublic,
  toPublicPhoneContact,
} from '@walls/shared';
import type { UserRow } from '../auth/auth.repository';

/**
 * The kind of advertiser of a user with a public profile. Private sellers and professionals
 * always have one (database check); only Admins do not, and they have no public profile.
 */
export function advertiserType(user: UserRow): SellerType {
  if (!user.sellerType) throw new Error(`User ${user.id} has no seller type`);
  return user.sellerType;
}

/**
 * A user's public profile (SPEC §19): only approved public fields, never internal data,
 * application documents, or an email the user did not make public. The badge shows the
 * kind of advertiser; there is no separate "approved" label, since every professional
 * account exists only after an Admin approved its application (SPEC §2.1).
 */
export function toPublicProfile(user: UserRow): PublicProfile {
  const phoneIsPublic = isPhoneAlwaysPublic(user.role) || user.isPhonePublic;
  return {
    slug: user.slug,
    role: user.role,
    sellerType: advertiserType(user),
    displayName: user.displayName,
    bio: user.bio,
    agencyName: hasAgencyName(user.sellerType) ? user.agencyName : null,
    avatarUrl: user.avatarUrl,
    phone: phoneIsPublic ? toPublicPhoneContact(user.phone, user.phoneVerificationStatus) : null,
    email: user.isEmailPublic ? user.email : null,
    memberSince: user.createdAt.toISOString(),
  };
}
