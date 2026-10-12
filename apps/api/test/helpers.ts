import './env';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '@walls/database';
import { testDatabaseUrl } from '@walls/database/testing';
import { pino } from 'pino';
import supertest from 'supertest';
import { type AppDependencies, createApp } from '../src/app';
import type { AuthRateLimits } from '../src/auth/auth.routes';
import type { Config } from '../src/config';
import { type EmailMessage, RecordingEmailService } from '../src/email/email-service';
import { processOutbox } from '../src/email/outbox';

export const WEB_ORIGIN = 'http://localhost:3000';
export const PASSWORD = 'correct horse battery staple';

const HOUR_MS = 3_600_000;
const GENEROUS_LIMITS: AuthRateLimits = {
  perIp: { windowMs: HOUR_MS, limit: 10_000 },
  failedLogins: { windowMs: HOUR_MS, limit: 10_000 },
};

export const testConfig: Config = {
  env: 'test',
  port: 0,
  logLevel: 'silent',
  databaseUrl: testDatabaseUrl(),
  sessionSecret: 'test-session-secret-that-is-long-enough-123',
  webOrigin: WEB_ORIGIN,
  trustProxyHops: 0,
  email: { resendApiKey: undefined, from: 'Walls <test@walls.rs>' },
};

export function uniqueEmail(): string {
  return `${randomUUID()}@example.com`;
}

/** An app wired to the test database, with emails captured in memory. */
export function createTestContext(overrides: Partial<Pick<AppDependencies, 'rateLimits'>> = {}) {
  const logger = pino({ level: 'silent' });
  const { db, close } = createDatabase({ url: testConfig.databaseUrl, maxConnections: 5 });
  const app = createApp({
    db,
    config: testConfig,
    logger,
    rateLimits: GENEROUS_LIMITS,
    ...overrides,
  });
  const emails = new RecordingEmailService();

  /** Delivers queued emails and returns the most recent one sent to `to`. */
  async function lastEmailTo(to: string): Promise<EmailMessage | undefined> {
    await processOutbox(db, emails, logger);
    return emails.sent.filter((email) => email.to === to).at(-1);
  }

  /** A cookie-keeping client that sends the web app's Origin, like a browser would. */
  function client() {
    const agent = supertest.agent(app);
    return {
      get: (path: string) => agent.get(path),
      post: (path: string, body: object = {}) =>
        agent.post(path).set('Origin', WEB_ORIGIN).send(body),
    };
  }

  return { app, db, close, emails, lastEmailTo, client };
}

/** Extracts the single-use token from an emailed link. */
export function tokenFrom(email: EmailMessage | undefined): string {
  const match = email?.text.match(/token=([A-Za-z0-9_-]{43})/);
  if (!match?.[1]) throw new Error(`No token link in email: ${email?.subject ?? '(none)'}`);
  return match[1];
}

interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

/** Typed access to the JSON error body of a response. */
export function errorOf(response: { body: unknown }): ApiErrorBody['error'] {
  return (response.body as ApiErrorBody).error;
}

/** Typed access to the `user` of an auth response. */
export function userOf(response: { body: unknown }): Record<string, unknown> {
  return (response.body as { user: Record<string, unknown> }).user;
}
