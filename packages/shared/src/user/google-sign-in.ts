/** Why a "Continue with Google" round trip was started (SPEC §3.1). */
export const GoogleSignInIntent = {
  /** Sign in, or start a new account (login, registration and choice pages). */
  SIGN_IN: 'sign-in',
  /** Finish an invited account (approved professionals, Admins) from the setup link. */
  SETUP: 'setup',
  /** Confirm a signed-in user again before a sensitive change, e.g. their email. */
  REAUTHENTICATE: 'reauthenticate',
} as const;
export type GoogleSignInIntent = (typeof GoogleSignInIntent)[keyof typeof GoogleSignInIntent];

/**
 * Outcomes of a Google round trip that the web app explains on the page the trip started
 * from (`?google=<outcome>`). Successful sign-ins go straight to the dashboard instead.
 */
export const GoogleSignInOutcome = {
  /** The visitor cancelled on Google's screen. */
  CANCELLED: 'cancelled',
  /** The round trip failed (expired or tampered state, Google unreachable, …). */
  FAILED: 'failed',
  /** Google has not verified the account's email address. */
  EMAIL_NOT_VERIFIED: 'email-not-verified',
  DEACTIVATED: 'deactivated',
  /** The Walls account exists; a link to connect Google was emailed to it. */
  LINK_SENT: 'link-sent',
  /** The Google account is not the one this step needs (setup or reauthentication). */
  WRONG_ACCOUNT: 'wrong-account',
  /** The Walls account is already connected to a different Google account. */
  OTHER_GOOGLE_ACCOUNT: 'other-google-account',
  /** The Google account is already connected to a different Walls account. */
  GOOGLE_ACCOUNT_IN_USE: 'google-account-in-use',
  /** The setup link is invalid or has expired. */
  SETUP_LINK_INVALID: 'setup-link-invalid',
  /** Confirmed again with Google: the email change can go ahead without a password. */
  REAUTHENTICATED: 'reauthenticated',
} as const;
export type GoogleSignInOutcome = (typeof GoogleSignInOutcome)[keyof typeof GoogleSignInOutcome];

const GOOGLE_CONSUMER_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

/**
 * Whether Google is the authority for an email address, so its "verified" flag proves the
 * person controls the mailbox: Gmail addresses, and addresses of a Google Workspace domain
 * (the `hd` claim). A Google account made with another provider's address was verified
 * only once, when it was created (Google's guidance; SPEC §3.1).
 */
export function isGoogleAuthoritativeFor(email: string, hostedDomain: string | null): boolean {
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  if (GOOGLE_CONSUMER_DOMAINS.has(domain)) return true;
  return hostedDomain !== null && hostedDomain.toLowerCase() === domain;
}
