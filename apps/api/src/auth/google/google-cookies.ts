import { GoogleSignInIntent, Locale, enumValues } from '@walls/shared';
import type { CookieOptions, Request, Response } from 'express';
import { z } from 'zod';
import type { Config } from '../../config';
import { GOOGLE_SIGN_IN_POLICY } from '../token-policy';
import type { PendingSignup, RoundTrip } from './google-sign-in.service';
import { seal, unseal } from './sealed-value';

/**
 * The Google round trip's cookies: HttpOnly and SameSite=Lax, so they come back with Google's
 * top-level redirect to the callback but not with cross-site requests. In production the
 * `__Host-` prefix pins them to the site, as with the session cookie.
 */
const COOKIES = {
  roundTrip: { name: 'walls_google', purpose: 'google-round-trip' },
  pendingSignup: { name: 'walls_google_signup', purpose: 'google-pending-signup' },
} as const;

type CookieKind = keyof typeof COOKIES;
type CookieConfig = Pick<Config, 'env' | 'sessionSecret'>;

const roundTripSchema = z.object({
  state: z.string(),
  nonce: z.string(),
  codeVerifier: z.string(),
  intent: z.enum(enumValues(GoogleSignInIntent)),
  locale: z.enum(enumValues(Locale)),
  next: z.string().nullable(),
  token: z.string().nullable(),
});

const pendingSignupSchema = z.object({
  identity: z.object({
    subject: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    hostedDomain: z.string().nullable(),
    name: z.string().nullable(),
    picture: z.string().nullable(),
  }),
  locale: z.enum(enumValues(Locale)),
});

function cookieName(kind: CookieKind, env: Config['env']): string {
  const { name } = COOKIES[kind];
  return env === 'production' ? `__Host-${name}` : name;
}

function options(env: Config['env']): CookieOptions {
  return { httpOnly: true, secure: env === 'production', sameSite: 'lax', path: '/' };
}

function setSealed(
  res: Response,
  config: CookieConfig,
  kind: CookieKind,
  value: object,
  ttlMs: number,
): void {
  const sealed = seal(value, config.sessionSecret, COOKIES[kind].purpose, ttlMs);
  res.cookie(cookieName(kind, config.env), sealed, { ...options(config.env), maxAge: ttlMs });
}

function readSealed<T extends z.ZodType>(
  req: Request,
  config: CookieConfig,
  kind: CookieKind,
  schema: T,
): z.infer<T> | null {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = unseal(
    cookies?.[cookieName(kind, config.env)],
    config.sessionSecret,
    COOKIES[kind].purpose,
  );
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function clearGoogleCookie(res: Response, env: Config['env'], kind: CookieKind): void {
  res.clearCookie(cookieName(kind, env), options(env));
}

export function setRoundTripCookie(res: Response, config: CookieConfig, value: RoundTrip): void {
  setSealed(res, config, 'roundTrip', value, GOOGLE_SIGN_IN_POLICY.roundTripMs);
}

export function readRoundTripCookie(req: Request, config: CookieConfig): RoundTrip | null {
  return readSealed(req, config, 'roundTrip', roundTripSchema);
}

export function setPendingSignupCookie(
  res: Response,
  config: CookieConfig,
  value: PendingSignup,
): void {
  setSealed(res, config, 'pendingSignup', value, GOOGLE_SIGN_IN_POLICY.pendingSignupMs);
}

export function readPendingSignupCookie(req: Request, config: CookieConfig): PendingSignup | null {
  return readSealed(req, config, 'pendingSignup', pendingSignupSchema);
}
