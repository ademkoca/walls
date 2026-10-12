import { existsSync } from 'node:fs';
import path from 'node:path';

const rootEnvFile = path.resolve(import.meta.dirname, '../../../.env');
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

/** URL of the dedicated integration-test database. It is wiped on every test run. */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set (see .env.example)');
  if (url === process.env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL: tests wipe the database');
  }
  return url;
}
