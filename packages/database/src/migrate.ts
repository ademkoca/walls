import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { Database } from './client';

export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../migrations', import.meta.url));

/** Applies pending migrations. Used by tests and scripts; deployments use `drizzle-kit migrate`. */
export async function migrateDatabase(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
