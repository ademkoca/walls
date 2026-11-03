import { describe, expect, it } from 'vitest';
import { isGoogleAuthoritativeFor } from './google-sign-in';

describe('Google as the authority for an email address (SPEC §3.1)', () => {
  it('trusts Gmail addresses, whatever their case', () => {
    expect(isGoogleAuthoritativeFor('ana@gmail.com', null)).toBe(true);
    expect(isGoogleAuthoritativeFor('Ana@GoogleMail.com', null)).toBe(true);
  });

  it('trusts a Google Workspace address of its own domain', () => {
    expect(isGoogleAuthoritativeFor('ana@agencija.rs', 'agencija.rs')).toBe(true);
    expect(isGoogleAuthoritativeFor('ana@Agencija.rs', 'agencija.RS')).toBe(true);
  });

  it('does not trust another provider’s address or a different Workspace domain', () => {
    expect(isGoogleAuthoritativeFor('ana@outlook.com', null)).toBe(false);
    expect(isGoogleAuthoritativeFor('ana@outlook.com', 'agencija.rs')).toBe(false);
    expect(isGoogleAuthoritativeFor('ana@gmail.com.evil.rs', null)).toBe(false);
  });
});
