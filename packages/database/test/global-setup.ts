import { sql } from 'drizzle-orm';
import { createDatabase } from '../src/client';
import { migrateDatabase } from '../src/migrate';
import { testDatabaseUrl } from './env';

/** Rebuilds the test database from the migrations once per test run. */
export default async function setup(): Promise<void> {
  const { db, close } = createDatabase({ url: testDatabaseUrl(), maxConnections: 1 });
  try {
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await db.execute(sql`DROP SCHEMA public CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);
    await migrateDatabase(db);
  } finally {
    await close();
  }
}
