import { describe, expect, it } from 'vitest';
import { PhoneVerificationStatus } from '../enums';
import { toPublicPhoneContact } from './phone';

const { VERIFIED, UNVERIFIED } = PhoneVerificationStatus;

describe('public phone contact (SPEC §3–4)', () => {
  it('labels a number verified only when its stored status is VERIFIED', () => {
    expect(toPublicPhoneContact('+381 64 123 4567', VERIFIED)).toEqual({
      phone: '+381 64 123 4567',
      verificationStatus: VERIFIED,
    });
  });

  it.each([UNVERIFIED, null])('labels a number with stored status %s as unverified', (stored) => {
    expect(toPublicPhoneContact('+381 64 123 4567', stored)?.verificationStatus).toBe(UNVERIFIED);
  });

  it.each([null, ''])('returns no contact for the phone value %j', (phone) => {
    expect(toPublicPhoneContact(phone, VERIFIED)).toBeNull();
  });
});
