import { describe, expect, it } from 'vitest';
import { isDemoSite, realSiteUrl } from './demo-site';

describe('isDemoSite', () => {
  it('is off unless turned on', () => {
    expect(isDemoSite(undefined)).toBe(false);
    expect(isDemoSite('')).toBe(false);
    expect(isDemoSite('off')).toBe(false);
    expect(isDemoSite('on')).toBe(true);
  });

  it('rejects other values instead of guessing', () => {
    expect(() => isDemoSite('true')).toThrow('NEXT_PUBLIC_DEMO_SITE must be "on" or "off"');
    expect(() => isDemoSite('ON')).toThrow();
  });
});

describe('realSiteUrl', () => {
  it('links to the real site in the same language', () => {
    expect(realSiteUrl('sr')).toBe('https://walls.rs');
    expect(realSiteUrl('en')).toBe('https://walls.rs/en');
  });
});
