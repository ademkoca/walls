import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, securityHeaders, tileOrigin } from './security-headers';

const production = { development: false };

describe('contentSecurityPolicy', () => {
  it('blocks framing, plugins, other sites posting forms and eval in production', () => {
    const policy = contentSecurityPolicy(production);
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("frame-src 'none'");
    expect(policy).not.toContain('unsafe-eval');
    expect(policy).not.toContain('ws:');
  });

  it('allows scripts only from this site (plus inline ones Next.js writes)', () => {
    expect(contentSecurityPolicy(production)).toContain("script-src 'self' 'unsafe-inline';");
  });

  it('allows listing photos, the map tiles and the geocoder, and nothing else', () => {
    const policy = contentSecurityPolicy(production);
    expect(policy).toContain(
      "img-src 'self' data: blob: https://res.cloudinary.com https://tile.openstreetmap.org;",
    );
    expect(policy).toContain("connect-src 'self' https://nominatim.openstreetmap.org;");
  });

  it('follows the configured tile host', () => {
    const policy = contentSecurityPolicy({
      ...production,
      tileUrl: 'https://{s}.tiles.example.com/{z}/{x}/{y}.png',
    });
    expect(policy).toContain('https://*.tiles.example.com');
    expect(policy).not.toContain('tile.openstreetmap.org');
  });

  it('needs eval and websockets only in development', () => {
    const policy = contentSecurityPolicy({ development: true });
    expect(policy).toContain("'unsafe-eval'");
    expect(policy).toContain('ws:');
  });
});

describe('tileOrigin', () => {
  it('reads the origin, with a wildcard for the {s} server letter', () => {
    expect(tileOrigin('https://tile.openstreetmap.org/{z}/{x}/{y}.png')).toBe(
      'https://tile.openstreetmap.org',
    );
    expect(tileOrigin('https://{s}.example.org/{z}/{x}/{y}.png')).toBe('https://*.example.org');
  });

  it('gives up on a value that is not a URL', () => {
    expect(tileOrigin('not a url')).toBeUndefined();
  });
});

describe('securityHeaders', () => {
  it('keeps the referrer origin for the tile server and sends the basic hardening headers', () => {
    const headers = Object.fromEntries(
      securityHeaders(production).map(({ key, value }) => [key, value]),
    );
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Permissions-Policy']).toContain('geolocation=(self)');
  });
});
