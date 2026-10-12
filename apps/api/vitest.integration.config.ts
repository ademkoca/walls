import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.integration.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    // Test files share one database and the email outbox, so they run one at a time.
    fileParallelism: false,
  },
});
