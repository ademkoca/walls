import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { API_LOG_FILE } from './support/api-log';

const repoRoot = path.resolve(import.meta.dirname, '..');
const rootEnvFile = path.join(repoRoot, '.env');
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

// Dedicated ports so the suite never attaches to (or disturbs) a running dev server.
const WEB_PORT = 3100;
const API_PORT = 4100;
const WEB_ORIGIN = `http://localhost:${WEB_PORT}`;
const API_ORIGIN = `http://localhost:${API_PORT}`;
const SERVER_START_TIMEOUT_MS = 180_000;

// The suite shares the integration-test database; it only creates uniquely named users.
const databaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgres://walls:walls@localhost:5432/walls_test';

const apiEnv = {
  NODE_ENV: 'test', // JSON logs; ConsoleEmailService prints emails, see support/api-log.ts
  API_PORT: String(API_PORT),
  DATABASE_URL: databaseUrl,
  SESSION_SECRET: 'e2e-session-secret-that-is-long-enough-1234567890',
  WEB_ORIGIN,
  RESEND_API_KEY: '',
  LOG_LEVEL: 'info',
};

const webEnv = {
  NODE_ENV: 'production', // Playwright sets NODE_ENV=test, which breaks `next build`
  API_INTERNAL_URL: API_ORIGIN,
  NEXT_PUBLIC_SITE_URL: WEB_ORIGIN,
};

export default defineConfig({
  testDir: './tests',
  outputDir: './.output/test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: './.output/report' }]]
    : [['list']],
  use: {
    baseURL: WEB_ORIGIN,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Migrate, then run the API with its log (which carries the emailed links) in a file.
      command: `mkdir -p ${path.dirname(API_LOG_FILE)} && pnpm --filter @walls/database db:migrate && pnpm --filter @walls/api exec tsx src/server.ts > ${API_LOG_FILE} 2>&1`,
      cwd: repoRoot,
      url: `${API_ORIGIN}/health`,
      env: apiEnv,
      reuseExistingServer: false,
      timeout: SERVER_START_TIMEOUT_MS,
    },
    {
      // The production build is what ships; `API_INTERNAL_URL` is compiled into its rewrites.
      command: `pnpm --filter @walls/web build && pnpm --filter @walls/web exec next start --port ${WEB_PORT}`,
      cwd: repoRoot,
      url: WEB_ORIGIN,
      env: webEnv,
      reuseExistingServer: false,
      timeout: SERVER_START_TIMEOUT_MS,
    },
  ],
});
