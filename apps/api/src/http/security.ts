import type { RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { AppError, type ErrorBody, ErrorCode } from './errors';

const STATUS_FORBIDDEN = 403;
const STATUS_TOO_MANY_REQUESTS = 429;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function requestOrigin(origin: string | undefined, referer: string | undefined): string | null {
  if (origin) return origin;
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

/**
 * CSRF protection for cookie-authenticated requests (SPEC §36): state-changing requests
 * must come from an allowed origin. Session cookies are also SameSite=Lax.
 */
export function requireAllowedOrigin(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = requestOrigin(req.get('origin'), req.get('referer'));
    if (origin && allowed.has(origin)) return next();
    next(
      new AppError(STATUS_FORBIDDEN, ErrorCode.ORIGIN_NOT_ALLOWED, 'Request origin is not allowed'),
    );
  };
}

export interface RateLimitRule {
  /** Window length in milliseconds. */
  windowMs: number;
  limit: number;
}

const rateLimitedBody: ErrorBody = {
  error: { code: ErrorCode.RATE_LIMITED, message: 'Too many requests, please try again later' },
};

/**
 * Per-IP limiter. Uses the in-memory store, which is correct for a single API instance;
 * a shared store is needed before scaling out.
 */
export function limitByIp(rule: RateLimitRule): RequestHandler {
  return rateLimit({
    ...rule,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    statusCode: STATUS_TOO_MANY_REQUESTS,
    message: rateLimitedBody,
  });
}

/**
 * Login brute-force protection: failed attempts are counted per IP and email address,
 * so one attacker cannot lock out a user from every network (SPEC §36).
 */
export function limitLoginAttempts(rule: RateLimitRule): RequestHandler {
  return rateLimit({
    ...rule,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    statusCode: STATUS_TOO_MANY_REQUESTS,
    message: rateLimitedBody,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
      const body = req.body as { email?: unknown } | undefined;
      const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
      return `${ipKeyGenerator(req.ip ?? '')}|${email}`;
    },
  });
}
