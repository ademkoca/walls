import { describe, expect, it } from 'vitest';
import { loginInputSchema, registerInputSchema, setPasswordInputSchema } from './auth';

const validRegistration = {
  displayName: 'Ana Anić',
  email: ' ana@example.rs ',
  password: 'correct horse battery',
  locale: 'sr',
};

describe('registration input (SPEC §3)', () => {
  it('accepts a valid registration and trims the email', () => {
    expect(registerInputSchema.parse(validRegistration).email).toBe('ana@example.rs');
  });

  it.each([
    ['role', { role: 'REAL_ESTATE_AGENT' }],
    ['status', { status: 'ACTIVE' }],
    ['emailVerifiedAt', { emailVerifiedAt: '2026-01-01' }],
  ])('rejects the self-assigned field %s', (_field, extra) => {
    expect(registerInputSchema.safeParse({ ...validRegistration, ...extra }).success).toBe(false);
  });

  it.each([
    ['a short password', { password: 'short' }],
    ['an overlong password', { password: 'x'.repeat(129) }],
    ['an invalid email', { email: 'not-an-email' }],
    ['a one-letter name', { displayName: 'A' }],
    ['an unsupported locale', { locale: 'de' }],
  ])('rejects %s', (_case, change) => {
    expect(registerInputSchema.safeParse({ ...validRegistration, ...change }).success).toBe(false);
  });
});

describe('login input', () => {
  it('does not apply the new-password policy to existing passwords', () => {
    expect(loginInputSchema.safeParse({ email: 'ana@example.rs', password: 'old' }).success).toBe(
      true,
    );
  });
});

describe('emailed tokens', () => {
  it('accepts only 43-character base64url tokens', () => {
    const password = 'correct horse battery';
    expect(setPasswordInputSchema.safeParse({ token: 'a'.repeat(43), password }).success).toBe(
      true,
    );
    expect(setPasswordInputSchema.safeParse({ token: 'a'.repeat(42), password }).success).toBe(
      false,
    );
    expect(
      setPasswordInputSchema.safeParse({ token: `${'a'.repeat(42)}=`, password }).success,
    ).toBe(false);
  });
});
