import type { Actor } from '@walls/shared';
import type { Request, RequestHandler } from 'express';
import { unauthenticated } from './errors';

export interface AuthContext {
  actor: Actor;
  sessionId: string;
}

// Kept outside the request object so no global Express type augmentation is needed.
const authByRequest = new WeakMap<Request, AuthContext>();

export function setAuth(req: Request, auth: AuthContext): void {
  authByRequest.set(req, auth);
}

export function getAuth(req: Request): AuthContext | undefined {
  return authByRequest.get(req);
}

/** The authenticated context; throws 401 when the request has no valid session. */
export function requireAuth(req: Request): AuthContext {
  const auth = getAuth(req);
  if (!auth) throw unauthenticated();
  return auth;
}

/** Middleware form of `requireAuth` for whole routers. */
export const authenticated: RequestHandler = (req, _res, next) => {
  requireAuth(req);
  next();
};
