import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Settings shared by the Playwright config and helpers that run repository scripts
 * (e.g. `admin:create`) against the same API database.
 */
export const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

const rootEnvFile = path.join(REPO_ROOT, '.env');
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

// Dedicated ports so the suite never attaches to (or disturbs) a running dev server.
export const WEB_PORT = 3100;
export const API_PORT = 4100;
export const WEB_ORIGIN = `http://localhost:${WEB_PORT}`;
export const API_ORIGIN = `http://localhost:${API_PORT}`;

// The suite shares the integration-test database; it only creates uniquely named users.
const databaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgres://walls:walls@localhost:5432/walls_test';

export const API_ENV = {
  NODE_ENV: 'test', // JSON logs; ConsoleEmailService prints emails, see support/api-log.ts
  API_PORT: String(API_PORT),
  DATABASE_URL: databaseUrl,
  SESSION_SECRET: 'e2e-session-secret-that-is-long-enough-1234567890',
  WEB_ORIGIN,
  RESEND_API_KEY: '',
  // Never touch real providers from tests, even when the root .env configures them.
  CLOUDINARY_CLOUD_NAME: '',
  CLOUDINARY_API_KEY: '',
  CLOUDINARY_API_SECRET: '',
  // Uploads stay inside the gitignored output folder.
  LOCAL_MEDIA_DIR: path.resolve(import.meta.dirname, '../.output/media'),
  LOG_LEVEL: 'info',
};

export const WEB_ENV = {
  NODE_ENV: 'production', // Playwright sets NODE_ENV=test, which breaks `next build`
  API_INTERNAL_URL: API_ORIGIN,
  NEXT_PUBLIC_SITE_URL: WEB_ORIGIN,
};
