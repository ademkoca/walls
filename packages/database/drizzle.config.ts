import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'drizzle-kit';

// All apps share the single root .env file documented in .env.example.
// drizzle-kit loads this file as CommonJS and runs from the package directory.
const rootEnvFile = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set (see .env.example)');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  casing: 'snake_case',
  dbCredentials: { url: databaseUrl },
  strict: true,
  verbose: true,
});
