import { describe, expect, it } from 'vitest';
import { isSiteIndexable } from './site-indexing';

describe('isSiteIndexable', () => {
  it('allows indexing unless it is turned off', () => {
    expect(isSiteIndexable(undefined)).toBe(true);
    expect(isSiteIndexable('')).toBe(true);
    expect(isSiteIndexable('on')).toBe(true);
    expect(isSiteIndexable('off')).toBe(false);
  });

  it('rejects other values instead of guessing', () => {
    expect(() => isSiteIndexable('false')).toThrow('SITE_INDEXING must be "on" or "off"');
    expect(() => isSiteIndexable('OFF')).toThrow();
  });
});
