import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/server.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node22',
  // Internal workspace packages ship TypeScript source, so they are bundled into the
  // API output. Third-party dependencies stay external and are installed at deploy time.
  deps: {
    alwaysBundle: [/^@walls\//],
  },
});
