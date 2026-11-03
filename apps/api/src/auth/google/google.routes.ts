import {
  emailTokenSchema,
  googleSignupInputSchema,
  googleStartQuerySchema,
} from '@walls/validation';
import { type RequestHandler, Router } from 'express';
import { z } from 'zod';
import type { Config } from '../../config';
import { getAuth } from '../../http/auth-context';
import { AppError, ErrorCode } from '../../http/errors';
import { type RateLimitRule, limitByIp } from '../../http/security';
import { parseBody } from '../../http/validate';
import type { AuthService, SessionMeta } from '../auth.service';
import { setSessionCookie } from '../session-cookie';
import {
  clearGoogleCookie,
  readPendingSignupCookie,
  readRoundTripCookie,
  setPendingSignupCookie,
  setRoundTripCookie,
} from './google-cookies';
import type { GoogleSignInService } from './google-sign-in.service';

const STATUS_BAD_REQUEST = 400;
const STATUS_NO_CONTENT = 204;

const callbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

const confirmLinkInputSchema = z.strictObject({ token: emailTokenSchema });

const signupExpired = () =>
  new AppError(
    STATUS_BAD_REQUEST,
    ErrorCode.INVALID_TOKEN,
    'The Google sign-in has expired; continue with Google again',
  );

function sessionMeta(req: Parameters<RequestHandler>[0]): SessionMeta {
  return {
    ...(req.ip ? { ipAddress: req.ip } : {}),
    ...(req.get('user-agent') ? { userAgent: req.get('user-agent') } : {}),
  };
}

/** "Continue with Google" (SPEC §3.1), mounted at /auth/google. */
export function googleRoutes(deps: {
  google: GoogleSignInService;
  authService: AuthService;
  config: Pick<Config, 'env' | 'sessionSecret'>;
  rateLimit: RateLimitRule;
}): Router {
  const { google, authService, config } = deps;
  const router = Router();
  const perIp = limitByIp(deps.rateLimit);

  /** Browsers navigate here; the response sends them on to Google. */
  router.get('/', perIp, (req, res) => {
    const { authorizationUrl, roundTrip } = google.start(googleStartQuerySchema.parse(req.query));
    setRoundTripCookie(res, config, roundTrip);
    res.redirect(authorizationUrl);
  });

  /** Google sends the browser back here. */
  router.get('/callback', perIp, async (req, res) => {
    const roundTrip = readRoundTripCookie(req, config);
    clearGoogleCookie(res, config.env, 'roundTrip');
    const current = getAuth(req);
    const result = await google.finish(
      callbackQuerySchema.parse(req.query),
      roundTrip,
      current ? { userId: current.actor.id, sessionId: current.sessionId } : null,
      sessionMeta(req),
    );
    if (result.session) {
      // Signing in replaces whatever session the browser had.
      if (current) await authService.logout(current.sessionId);
      setSessionCookie(res, config.env, result.session.sessionToken, result.session.expiresAt);
    }
    if (result.pendingSignup) setPendingSignupCookie(res, config, result.pendingSignup);
    res.redirect(result.redirectTo);
  });

  /** The Google account waiting on the choice page, if any. */
  router.get('/pending', (req, res) => {
    const pending = readPendingSignupCookie(req, config);
    res.json({ pending: pending ? google.describePending(pending) : null });
  });

  /** Creates a private-seller account for the waiting Google account. */
  router.post('/register', perIp, async (req, res) => {
    const pending = readPendingSignupCookie(req, config);
    if (!pending) throw signupExpired();
    const { user, sessionToken, expiresAt } = await google.register(
      pending,
      parseBody(googleSignupInputSchema, req),
      sessionMeta(req),
    );
    clearGoogleCookie(res, config.env, 'pendingSignup');
    setSessionCookie(res, config.env, sessionToken, expiresAt);
    res.json({ user });
  });

  /** The emailed link that connects a Google account to an existing account. */
  router.post('/confirm-link', perIp, async (req, res) => {
    await google.confirmConnectLink(parseBody(confirmLinkInputSchema, req).token);
    res.status(STATUS_NO_CONTENT).end();
  });

  return router;
}
