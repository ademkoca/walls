import './env';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '@walls/database';
import { testDatabaseUrl } from '@walls/database/testing';
import { pino } from 'pino';
import supertest from 'supertest';
import { type AppDependencies, createApp } from '../src/app';
import type { AuthRateLimits } from '../src/auth/auth.routes';
import type { Config } from '../src/config';
import { insertUser } from '../src/auth/auth.repository';
import { hashPassword } from '../src/auth/passwords';
import { type EmailMessage, RecordingEmailService } from '../src/email/email-service';
import { InMemoryMediaStorage } from '../src/media/media-storage';
import { InMemoryPrivateFileStorage } from '../src/media/private-file-storage';
import { Role, SellerType, UserStatus } from '@walls/shared';
import sharp from 'sharp';
import { processOutbox } from '../src/email/outbox';
import { FixedExchangeRateProvider } from '../src/exchange-rates/exchange-rate-provider';
import { ExchangeRatesService } from '../src/exchange-rates/exchange-rates.service';

export const WEB_ORIGIN = 'http://localhost:3000';
export const PASSWORD = 'correct horse battery staple';
/** The EUR → RSD rate every test uses (they share one database). */
export const TEST_EUR_RSD = '117.5';

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
  authRateLimitPerIp: 30,
  email: { resendApiKey: undefined, from: 'Walls <test@walls.rs>' },
  media: {
    cloudinary: undefined,
    localDirectory: '/nonexistent',
    localPrivateDirectory: '/nonexistent',
  },
  exchangeRates: { provider: 'fixed', eurRsd: TEST_EUR_RSD },
};

export function uniqueEmail(): string {
  return `${randomUUID()}@example.com`;
}

/** An app wired to the test database, with emails and media captured in memory. */
/** The kind of advertiser a test user of each role gets by default. */
const DEFAULT_SELLER_TYPES: Record<Role, SellerType | null> = {
  [Role.SUPER_ADMIN]: null,
  [Role.ADMIN]: null,
  [Role.REAL_ESTATE_AGENT]: SellerType.REAL_ESTATE_AGENT,
  [Role.PRIVATE_SELLER]: SellerType.PRIVATE_SELLER,
};

export function createTestContext(
  overrides: Partial<
    Pick<
      AppDependencies,
      | 'rateLimits'
      | 'uploadRateLimit'
      | 'applicationRateLimit'
      | 'inquiryRateLimit'
      | 'contactRateLimit'
      | 'viewRateLimit'
    >
  > = {},
) {
  const logger = pino({ level: 'silent' });
  const { db, close } = createDatabase({ url: testConfig.databaseUrl, maxConnections: 5 });
  const media = new InMemoryMediaStorage();
  const privateFiles = new InMemoryPrivateFileStorage();
  const exchangeRates = new ExchangeRatesService(
    db,
    new FixedExchangeRateProvider(TEST_EUR_RSD),
    logger,
  );
  const app = createApp({
    db,
    config: testConfig,
    logger,
    mediaStorage: media,
    privateFiles,
    exchangeRates,
    rateLimits: GENEROUS_LIMITS,
    uploadRateLimit: GENEROUS_LIMITS.perIp,
    applicationRateLimit: GENEROUS_LIMITS.perIp,
    inquiryRateLimit: GENEROUS_LIMITS.perIp,
    contactRateLimit: GENEROUS_LIMITS.perIp,
    viewRateLimit: GENEROUS_LIMITS.perIp,
    ...overrides,
  });
  const emails = new RecordingEmailService();

  /** Delivers every queued email (the outbox sends in batches) and returns the latest to `to`. */
  async function lastEmailTo(to: string): Promise<EmailMessage | undefined> {
    while ((await processOutbox(db, emails, logger)) > 0) {
      // Keep going until the outbox is empty.
    }
    return emails.sent.filter((email) => email.to === to).at(-1);
  }

  /** A cookie-keeping client that sends the web app's Origin, like a browser would. */
  function client() {
    const agent = supertest.agent(app);
    return {
      get: (path: string) => agent.get(path),
      post: (path: string, body: object = {}) =>
        agent.post(path).set('Origin', WEB_ORIGIN).send(body),
      patch: (path: string, body: object = {}) =>
        agent.patch(path).set('Origin', WEB_ORIGIN).send(body),
      put: (path: string, body: object = {}) =>
        agent.put(path).set('Origin', WEB_ORIGIN).send(body),
      delete: (path: string) => agent.delete(path).set('Origin', WEB_ORIGIN),
      upload: (path: string, file: Buffer, filename = 'photo.jpg') =>
        agent.post(path).set('Origin', WEB_ORIGIN).attach('file', file, filename),
      /** A multipart form with text fields and files under `fileField`. */
      multipart: (
        path: string,
        fields: Record<string, string>,
        files: { data: Buffer; name: string }[],
        fileField = 'files',
      ) => {
        let request = agent.post(path).set('Origin', WEB_ORIGIN);
        for (const [name, value] of Object.entries(fields)) request = request.field(name, value);
        for (const file of files) request = request.attach(fileField, file.data, file.name);
        return request;
      },
    };
  }

  /**
   * Creates an active user with the given role directly in the database and returns a
   * logged-in client. Professionals and admins have no self-service signup, so tests seed
   * them. Professionals are agents unless `sellerType` names another kind.
   */
  async function signedInUser(
    role: Role = Role.PRIVATE_SELLER,
    sellerType: SellerType | null = DEFAULT_SELLER_TYPES[role],
  ) {
    const email = uniqueEmail();
    const user = await insertUser(db, {
      email,
      displayName: `Test ${sellerType ?? role}`,
      slug: `test-${randomUUID()}`,
      role,
      sellerType,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      passwordHash: await hashPassword(PASSWORD),
      preferredLocale: 'sr',
    });
    const signedIn = client();
    const login = await signedIn.post('/api/v1/auth/login', { email, password: PASSWORD });
    if (login.status !== 200) throw new Error(`Login failed with ${login.status}`);
    return { user, client: signedIn };
  }

  return {
    app,
    db,
    close,
    emails,
    media,
    privateFiles,
    exchangeRates,
    lastEmailTo,
    client,
    signedInUser,
  };
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

/**
 * A real image of the given size. Random noise keeps JPEGs above the 50 KB minimum even
 * at small dimensions.
 */
export async function testImage(
  options: { width?: number; height?: number; format?: 'jpeg' | 'png' | 'webp' } = {},
): Promise<Buffer> {
  const { width = 1200, height = 900, format = 'jpeg' } = options;
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#808080',
      noise: { type: 'gaussian', mean: 128, sigma: 40 },
    },
  })
    .toFormat(format)
    .toBuffer();
}
