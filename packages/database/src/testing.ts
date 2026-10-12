import { sql } from 'drizzle-orm';
import { createDatabase } from './client';
import { migrateDatabase } from './migrate';

/**
 * Drops everything in the given database and re-applies all migrations.
 * For integration tests only: never point this at a database you want to keep.
 */
export async function resetTestDatabase(url: string): Promise<void> {
  const { db, close } = createDatabase({ url, maxConnections: 1 });
  try {
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await db.execute(sql`DROP SCHEMA public CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);
    await migrateDatabase(db);
  } finally {
    await close();
  }
}

/** Reads TEST_DATABASE_URL and refuses to use the development database. */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set (see .env.example)');
  if (url === process.env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL: tests wipe the database');
  }
  return url;
}
