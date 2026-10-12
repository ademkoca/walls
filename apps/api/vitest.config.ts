import { configDefaults, defineConfig } from 'vitest/config';

// Unit tests only. API tests against the database run with `pnpm test:integration`.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],
  },
});
