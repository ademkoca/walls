import type { Database } from '@walls/database';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { type AuthRateLimits, authRoutes } from './auth/auth.routes';
import { AuthService } from './auth/auth.service';
import { loadSession } from './auth/session.middleware';
import type { Config } from './config';
import { createErrorHandler, notFoundHandler } from './http/error-handler';
import { requireAllowedOrigin } from './http/security';
import type { Logger } from './logger';

const JSON_BODY_LIMIT = '100kb';
const MINUTE_MS = 60_000;

export const DEFAULT_RATE_LIMITS: AuthRateLimits = {
  perIp: { windowMs: 15 * MINUTE_MS, limit: 30 },
  failedLogins: { windowMs: 15 * MINUTE_MS, limit: 5 },
};

export interface AppDependencies {
  db: Database;
  config: Config;
  logger: Logger;
  rateLimits?: AuthRateLimits;
}

export function createApp({
  db,
  config,
  logger,
  rateLimits = DEFAULT_RATE_LIMITS,
}: AppDependencies): Express {
  const app = express();
  const authService = new AuthService(db, config);

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxyHops);

  app.use(pinoHttp({ logger, autoLogging: config.env !== 'test' }));
  app.use(helmet());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const api = express.Router();
  api.use(express.json({ limit: JSON_BODY_LIMIT }));
  api.use(cookieParser());
  api.use(requireAllowedOrigin([config.webOrigin]));
  api.use(loadSession(authService, config.env));
  api.use('/auth', authRoutes({ db, authService, env: config.env, rateLimits }));
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));
  return app;
}
