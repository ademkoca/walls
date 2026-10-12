import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath', () => {
  it.each(['/dashboard', '/dashboard/listings?page=2'])('keeps the relative path %s', (next) => {
    expect(safeRedirectPath(next, '/fallback')).toBe(next);
  });

  it.each([
    null,
    undefined,
    '',
    'dashboard',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
  ])('falls back for %j', (next) => {
    expect(safeRedirectPath(next, '/fallback')).toBe('/fallback');
  });
});
