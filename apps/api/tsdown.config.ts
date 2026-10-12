import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/server.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node22',
  // Internal workspace packages ship TypeScript source, so they are bundled into the
  // API output, together with `postgres` (a dependency of @walls/database only). Other
  // third-party dependencies stay external and are installed at deploy time; the build
  // fails if anything else would be bundled.
  deps: {
    alwaysBundle: [/^@walls\//],
    onlyBundle: [/^@walls\//, 'postgres'],
  },
});
