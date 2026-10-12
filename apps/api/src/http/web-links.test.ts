import { AUTH_PAGE_PATHS } from '@walls/shared';
import { describe, expect, it } from 'vitest';
import { webPageUrl } from './web-links';

describe('webPageUrl', () => {
  it('leaves Serbian pages unprefixed and puts English under /en', () => {
    expect(webPageUrl('https://walls.rs', 'sr', AUTH_PAGE_PATHS.login)).toBe(
      'https://walls.rs/login',
    );
    expect(webPageUrl('https://walls.rs', 'en', AUTH_PAGE_PATHS.login)).toBe(
      'https://walls.rs/en/login',
    );
  });

  it('encodes query parameters', () => {
    expect(
      webPageUrl('http://localhost:3000', 'sr', AUTH_PAGE_PATHS.verifyEmail, { token: 'a-b_c' }),
    ).toBe('http://localhost:3000/verify-email?token=a-b_c');
  });
});
