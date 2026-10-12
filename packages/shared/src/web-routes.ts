import { Role } from './enums';

/**
 * Web app pages that emails link to. The web app must serve these paths; Serbian pages
 * are unprefixed and English pages live under /en (SPEC §31).
 */
export const AUTH_PAGE_PATHS = {
  login: '/login',
  verifyEmail: '/verify-email',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  setupAccount: '/setup-account',
  confirmEmail: '/confirm-email',
} as const;

/** Public profile page of an agent or private seller (SPEC §16, §19). */
export function publicProfilePath(role: Role, slug: string): string | null {
  if (role === Role.REAL_ESTATE_AGENT) return `/agents/${slug}`;
  if (role === Role.PRIVATE_SELLER) return `/sellers/${slug}`;
  return null;
}
