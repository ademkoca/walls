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
} as const;
