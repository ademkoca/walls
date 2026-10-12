import { PhoneVerificationStatus } from '../enums';

export interface PublicPhoneContact {
  phone: string;
  verificationStatus: PhoneVerificationStatus;
}

/**
 * The phone contact shown on public profiles and listings. A number is labelled verified
 * only when its stored status is exactly VERIFIED; anything else is shown as unverified
 * (SPEC §3–4). Returns null when the user has no public phone number.
 */
export function toPublicPhoneContact(
  phone: string | null,
  storedStatus: PhoneVerificationStatus | null,
): PublicPhoneContact | null {
  if (!phone) return null;
  return {
    phone,
    verificationStatus:
      storedStatus === PhoneVerificationStatus.VERIFIED
        ? PhoneVerificationStatus.VERIFIED
        : PhoneVerificationStatus.UNVERIFIED,
  };
}
