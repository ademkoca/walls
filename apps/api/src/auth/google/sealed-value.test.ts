import { afterEach, describe, expect, it, vi } from 'vitest';
import { seal, unseal } from './sealed-value';

const SECRET = 'a-session-secret-that-is-long-enough-1234';
const MINUTE_MS = 60_000;

afterEach(() => vi.useRealTimers());

describe('sealed cookie values', () => {
  it('returns the value it sealed', () => {
    const sealed = seal({ state: 'abc' }, SECRET, 'flow', MINUTE_MS);
    expect(unseal(sealed, SECRET, 'flow')).toEqual({ state: 'abc' });
  });

  it('refuses an altered value, another purpose or another secret', () => {
    const sealed = seal({ email: 'ana@gmail.com' }, SECRET, 'flow', MINUTE_MS);
    const [, signature] = sealed.split('.');
    const forged = `${Buffer.from(
      JSON.stringify({ value: { email: 'eve@gmail.com' }, expiresAt: Date.now() + MINUTE_MS }),
    ).toString('base64url')}.${signature}`;

    expect(unseal(forged, SECRET, 'flow')).toBeNull();
    expect(unseal(sealed, SECRET, 'signup')).toBeNull();
    expect(unseal(sealed, `${SECRET}-other`, 'flow')).toBeNull();
    expect(unseal('not-a-sealed-value', SECRET, 'flow')).toBeNull();
    expect(unseal(undefined, SECRET, 'flow')).toBeNull();
  });

  it('expires', () => {
    vi.useFakeTimers();
    const sealed = seal({ state: 'abc' }, SECRET, 'flow', MINUTE_MS);
    vi.advanceTimersByTime(MINUTE_MS + 1);
    expect(unseal(sealed, SECRET, 'flow')).toBeNull();
  });
});
