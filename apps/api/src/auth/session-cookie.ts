import type { CookieOptions, Response } from 'express';
import type { Config } from '../config';

/**
 * In production the `__Host-` prefix makes browsers enforce Secure, Path=/ and no Domain,
 * so the cookie cannot be set or read by other subdomains.
 */
export function sessionCookieName(env: Config['env']): string {
  return env === 'production' ? '__Host-walls_session' : 'walls_session';
}

function baseOptions(env: Config['env']): CookieOptions {
  return { httpOnly: true, secure: env === 'production', sameSite: 'lax', path: '/' };
}

export function setSessionCookie(
  res: Response,
  env: Config['env'],
  token: string,
  expiresAt: Date,
): void {
  res.cookie(sessionCookieName(env), token, { ...baseOptions(env), expires: expiresAt });
}

export function clearSessionCookie(res: Response, env: Config['env']): void {
  res.clearCookie(sessionCookieName(env), baseOptions(env));
}
