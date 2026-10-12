import { describe, expect, it } from 'vitest';
import { agentApplicationInputSchema, phoneSchema, profileInputSchema } from './profile';

describe('phone numbers', () => {
  it.each(['+381 64 123 4567', '064/123-4567', '011 3234 567', '(011) 323.4567'])(
    'accepts %s',
    (phone) => {
      expect(phoneSchema.safeParse(phone).success).toBe(true);
    },
  );

  it.each(['12345', 'call me', '+381 64 123 4567 ext 9', '1234567890123456'])(
    'rejects %s',
    (phone) => {
      expect(phoneSchema.safeParse(phone).success).toBe(false);
    },
  );
});

describe('agent application', () => {
  const valid = {
    fullName: 'Marko Marković',
    email: 'marko@example.com',
    phone: '+381 64 123 4567',
    agencyName: '',
    locale: 'sr',
  };

  it('accepts an application without an agency name', () => {
    expect(agentApplicationInputSchema.parse(valid)).toEqual(valid);
  });

  it('requires a phone number and refuses unknown fields such as a role', () => {
    expect(agentApplicationInputSchema.safeParse({ ...valid, phone: '' }).success).toBe(false);
    expect(agentApplicationInputSchema.safeParse({ ...valid, role: 'SUPER_ADMIN' }).success).toBe(
      false,
    );
  });
});

describe('profile input', () => {
  const valid = {
    displayName: 'Ana Anić',
    bio: '',
    agencyName: '',
    phone: '',
    isPhonePublic: false,
    isEmailPublic: false,
  };

  it('allows an empty phone number, but not an invalid one', () => {
    expect(profileInputSchema.safeParse(valid).success).toBe(true);
    expect(profileInputSchema.safeParse({ ...valid, phone: 'abc' }).success).toBe(false);
  });

  it('never accepts the phone verification status from the client (SPEC §4)', () => {
    expect(
      profileInputSchema.safeParse({ ...valid, phoneVerificationStatus: 'VERIFIED' }).success,
    ).toBe(false);
  });
});
