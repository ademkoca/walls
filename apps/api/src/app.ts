import type { Database } from '@walls/database';
import { agentApplicationsRoutes } from './agents/agent-applications.routes';
import { AgentApplicationsService } from './agents/agent-applications.service';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { type AuthRateLimits, authRoutes } from './auth/auth.routes';
import { AuthService } from './auth/auth.service';
import { loadSession } from './auth/session.middleware';
import type { Config } from './config';
import { createErrorHandler, notFoundHandler } from './http/error-handler';
import { type RateLimitRule, requireAllowedOrigin } from './http/security';
import { ListingMediaService } from './listings/listing-media.service';
import { ListingReviewService } from './listings/listing-review.service';
import { listingsRoutes } from './listings/listings.routes';
import { ListingsService } from './listings/listings.service';
import { LOCAL_MEDIA_ROUTE, LocalDiskMediaStorage } from './media/local-disk-media-storage';
import {
  confirmEmailChangeRoutes,
  myProfileRoutes,
  profileChangesRoutes,
} from './profiles/profiles.routes';
import { ProfileChangesService } from './profiles/profile-changes.service';
import { ProfilesService } from './profiles/profiles.service';
import { publicRoutes } from './public/public.routes';
import { PublicService } from './public/public.service';
import { reviewQueueRoutes } from './review-queue/review-queue';
import { auditLogRoutes, usersRoutes } from './users/users.routes';
import { UsersService } from './users/users.service';
import type { MediaStorage } from './media/media-storage';
import type { PrivateFileStorage } from './media/private-file-storage';
import type { Logger } from './logger';

const JSON_BODY_LIMIT = '100kb';
const MINUTE_MS = 60_000;

const AUTH_WINDOW_MS = 15 * MINUTE_MS;

/** Auth limits: `perIp` from config (AUTH_RATE_LIMIT_PER_IP), 5 failed logins per IP+email. */
export function authRateLimits(config: Pick<Config, 'authRateLimitPerIp'>): AuthRateLimits {
  return {
    perIp: { windowMs: AUTH_WINDOW_MS, limit: config.authRateLimitPerIp },
    failedLogins: { windowMs: AUTH_WINDOW_MS, limit: 5 },
  };
}

/** Image uploads per IP: generous for a 30-image listing, low enough to stop abuse. */
export const DEFAULT_UPLOAD_RATE_LIMIT: RateLimitRule = { windowMs: 15 * MINUTE_MS, limit: 150 };

/** Public agent applications per IP: a few attempts (e.g. after a rejected file) per hour. */
export const DEFAULT_APPLICATION_RATE_LIMIT: RateLimitRule = {
  windowMs: 60 * MINUTE_MS,
  limit: 10,
};

export interface AppDependencies {
  db: Database;
  config: Config;
  logger: Logger;
  mediaStorage: MediaStorage;
  privateFiles: PrivateFileStorage;
  rateLimits?: AuthRateLimits;
  uploadRateLimit?: RateLimitRule;
  applicationRateLimit?: RateLimitRule;
}

export function createApp({
  db,
  config,
  logger,
  mediaStorage,
  privateFiles,
  rateLimits = authRateLimits(config),
  uploadRateLimit = DEFAULT_UPLOAD_RATE_LIMIT,
  applicationRateLimit = DEFAULT_APPLICATION_RATE_LIMIT,
}: AppDependencies): Express {
  const app = express();
  const authService = new AuthService(db, config);
  const listingsService = new ListingsService(db, config);
  const mediaService = new ListingMediaService(db, mediaStorage, listingsService, logger);
  const reviewService = new ListingReviewService(db, config, mediaStorage, logger);
  const usersService = new UsersService(db, config, authService);
  const applicationsService = new AgentApplicationsService(
    db,
    config,
    authService,
    privateFiles,
    logger,
  );
  const profilesService = new ProfilesService(db, authService, mediaStorage, logger);
  const profileChangesService = new ProfileChangesService(db, config, mediaStorage, logger);
  const publicService = new PublicService(db);

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxyHops);

  app.use(pinoHttp({ logger, autoLogging: config.env !== 'test' }));
  app.use(helmet());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Development only: files stored by LocalDiskMediaStorage (production uses Cloudinary).
  if (mediaStorage instanceof LocalDiskMediaStorage) {
    app.use(LOCAL_MEDIA_ROUTE, mediaStorage.handler());
  }

  const api = express.Router();
  api.use(express.json({ limit: JSON_BODY_LIMIT }));
  api.use(cookieParser());
  api.use(requireAllowedOrigin([config.webOrigin]));
  api.use(loadSession(authService, config.env));
  api.use(
    '/auth/confirm-email-change',
    confirmEmailChangeRoutes({ profiles: profilesService, sensitiveRateLimit: rateLimits.perIp }),
  );
  api.use('/auth', authRoutes({ db, authService, env: config.env, rateLimits }));
  api.use('/public', publicRoutes(publicService));
  api.use(
    '/agent-applications',
    agentApplicationsRoutes({
      applications: applicationsService,
      submitRateLimit: applicationRateLimit,
    }),
  );
  api.use(
    '/me',
    myProfileRoutes({
      profiles: profilesService,
      sensitiveRateLimit: rateLimits.perIp,
      uploadRateLimit,
    }),
  );
  api.use('/profile-changes', profileChangesRoutes(profileChangesService));
  api.use(
    '/review-queue',
    reviewQueueRoutes({
      db,
      applications: applicationsService,
      profileChanges: profileChangesService,
    }),
  );
  api.use(
    '/listings',
    listingsRoutes({
      listings: listingsService,
      media: mediaService,
      review: reviewService,
      uploadRateLimit,
    }),
  );
  api.use('/users', usersRoutes(usersService));
  api.use('/audit-log', auditLogRoutes(usersService));
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));
  return app;
}
