/** Lifetimes of emailed single-use links and sessions. Email texts quote the link lifetimes. */
export const TOKEN_TTL_HOURS = {
  EMAIL_VERIFICATION: 24,
  PASSWORD_RESET: 1,
  /** Agents and admins invited by email get a week to finish setting up their account. */
  ACCOUNT_SETUP: 24 * 7,
  EMAIL_CHANGE: 24,
  GOOGLE_LINK: 24,
} as const;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const SESSION_POLICY = {
  /** Sliding session lifetime. */
  ttlMs: 30 * DAY_MS,
  /** Sessions are extended (one database write) once less than this much time remains. */
  renewWhenRemainingMs: 15 * DAY_MS,
} as const;

const MINUTE_MS = 60 * 1000;

/** Google sign-in round trips (SPEC §3.1). */
export const GOOGLE_SIGN_IN_POLICY = {
  /** Time to finish on Google's screen before the round trip has to start again. */
  roundTripMs: 10 * MINUTE_MS,
  /** Time to choose what to do with a Google account that has no Walls account yet. */
  pendingSignupMs: 30 * MINUTE_MS,
  /** How long confirming with Google again allows an email change. */
  reauthenticationMs: 10 * MINUTE_MS,
} as const;

export function expiresInHours(hours: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + hours * HOUR_MS);
}
