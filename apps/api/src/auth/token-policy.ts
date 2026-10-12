/** Lifetimes of emailed single-use links and sessions. Email texts quote the link lifetimes. */
export const TOKEN_TTL_HOURS = {
  EMAIL_VERIFICATION: 24,
  PASSWORD_RESET: 1,
  /** Agents and admins invited by email get a week to finish setting up their account. */
  ACCOUNT_SETUP: 24 * 7,
  EMAIL_CHANGE: 24,
} as const;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const SESSION_POLICY = {
  /** Sliding session lifetime. */
  ttlMs: 30 * DAY_MS,
  /** Sessions are extended (one database write) once less than this much time remains. */
  renewWhenRemainingMs: 15 * DAY_MS,
} as const;

export function expiresInHours(hours: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + hours * HOUR_MS);
}
