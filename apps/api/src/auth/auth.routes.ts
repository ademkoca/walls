import {
  emailRequestInputSchema,
  loginInputSchema,
  registerInputSchema,
  setPasswordInputSchema,
  verifyEmailInputSchema,
} from '@walls/validation';
import { type RequestHandler, Router } from 'express';
import type { Config } from '../config';
import { requireAuth } from '../http/auth-context';
import { unauthenticated } from '../http/errors';
import { type RateLimitRule, limitByIp, limitLoginAttempts } from '../http/security';
import { parseBody } from '../http/validate';
import { findUserById } from './auth.repository';
import { type AuthService, toCurrentUser } from './auth.service';
import { clearSessionCookie, setSessionCookie } from './session-cookie';
import type { Database } from '@walls/database';

const STATUS_ACCEPTED = 202;
const STATUS_NO_CONTENT = 204;

export interface AuthRateLimits {
  /** Per-IP limit for unauthenticated auth endpoints that send email or check credentials. */
  perIp: RateLimitRule;
  /** Failed logins per IP and email address. */
  failedLogins: RateLimitRule;
}

export function authRoutes(deps: {
  db: Database;
  authService: AuthService;
  env: Config['env'];
  rateLimits: AuthRateLimits;
}): Router {
  const { db, authService, env, rateLimits } = deps;
  const router = Router();
  const perIp: RequestHandler = limitByIp(rateLimits.perIp);

  router.post('/register', perIp, async (req, res) => {
    await authService.register(parseBody(registerInputSchema, req));
    res.status(STATUS_ACCEPTED).end();
  });

  router.post('/resend-verification', perIp, async (req, res) => {
    await authService.resendVerification(parseBody(emailRequestInputSchema, req).email);
    res.status(STATUS_ACCEPTED).end();
  });

  router.post('/verify-email', perIp, async (req, res) => {
    await authService.verifyEmail(parseBody(verifyEmailInputSchema, req).token);
    res.status(STATUS_NO_CONTENT).end();
  });

  router.post('/login', perIp, limitLoginAttempts(rateLimits.failedLogins), async (req, res) => {
    const { user, sessionToken, expiresAt } = await authService.login(
      parseBody(loginInputSchema, req),
      {
        ...(req.ip ? { ipAddress: req.ip } : {}),
        ...(req.get('user-agent') ? { userAgent: req.get('user-agent') } : {}),
      },
    );
    setSessionCookie(res, env, sessionToken, expiresAt);
    res.json({ user });
  });

  router.post('/logout', async (req, res) => {
    await authService.logout(requireAuth(req).sessionId);
    clearSessionCookie(res, env);
    res.status(STATUS_NO_CONTENT).end();
  });

  router.get('/me', async (req, res) => {
    const user = await findUserById(db, requireAuth(req).actor.id);
    if (!user) throw unauthenticated();
    res.json({ user: toCurrentUser(user) });
  });

  router.post('/forgot-password', perIp, async (req, res) => {
    await authService.requestPasswordReset(parseBody(emailRequestInputSchema, req).email);
    res.status(STATUS_ACCEPTED).end();
  });

  router.post('/reset-password', perIp, async (req, res) => {
    await authService.resetPassword(parseBody(setPasswordInputSchema, req));
    res.status(STATUS_NO_CONTENT).end();
  });

  router.post('/setup-account', perIp, async (req, res) => {
    await authService.setupAccount(parseBody(setPasswordInputSchema, req));
    res.status(STATUS_NO_CONTENT).end();
  });

  return router;
}
