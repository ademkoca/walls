import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { API_LOG_FILE } from './support/api-log';
import {
  API_ENV,
  API_ORIGIN,
  REPO_ROOT,
  WEB_ENV,
  WEB_ORIGIN,
  WEB_PORT,
} from './support/environment';

const SERVER_START_TIMEOUT_MS = 180_000;

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
      // Start from an empty, migrated test database (integration tests leave unsent emails
      // behind, which would delay ours), then run the API with its log (which carries the
      // emailed links) in a file.
      command: `mkdir -p ${path.dirname(API_LOG_FILE)} && pnpm --filter @walls/database db:reset-test && pnpm --filter @walls/api exec tsx src/server.ts > ${API_LOG_FILE} 2>&1`,
      cwd: REPO_ROOT,
      url: `${API_ORIGIN}/health`,
      env: API_ENV,
      reuseExistingServer: false,
      timeout: SERVER_START_TIMEOUT_MS,
    },
    {
      // The production build is what ships; `API_INTERNAL_URL` is compiled into its rewrites.
      command: `pnpm --filter @walls/web build && pnpm --filter @walls/web exec next start --port ${WEB_PORT}`,
      cwd: REPO_ROOT,
      url: WEB_ORIGIN,
      env: WEB_ENV,
      reuseExistingServer: false,
      timeout: SERVER_START_TIMEOUT_MS,
    },
  ],
});
