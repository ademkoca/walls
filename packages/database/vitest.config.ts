import { configDefaults, defineConfig } from 'vitest/config';

// Unit tests only. Database tests run with `pnpm test:integration` (vitest.integration.config.ts).
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],
  },
});
