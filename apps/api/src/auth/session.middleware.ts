import type { RequestHandler } from 'express';
import type { Config } from '../config';
import { setAuth } from '../http/auth-context';
import type { AuthService } from './auth.service';
import { clearSessionCookie, sessionCookieName, setSessionCookie } from './session-cookie';

/** Resolves the session cookie into an authenticated actor, if there is a valid session. */
export function loadSession(authService: AuthService, env: Config['env']): RequestHandler {
  const cookieName = sessionCookieName(env);
  return async (req, res, next) => {
    const token: unknown = (req.cookies as Record<string, unknown> | undefined)?.[cookieName];
    if (typeof token !== 'string' || token === '') return next();

    const session = await authService.authenticate(token);
    if (!session) {
      clearSessionCookie(res, env);
      return next();
    }
    if (session.renewedExpiresAt) setSessionCookie(res, env, token, session.renewedExpiresAt);
    setAuth(req, { actor: session.actor, sessionId: session.sessionId });
    next();
  };
}
