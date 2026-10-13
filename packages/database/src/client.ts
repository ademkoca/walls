import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const DEFAULT_MAX_CONNECTIONS = 10;

export interface DatabaseOptions {
  url: string;
  maxConnections?: number;
  /** Receives Postgres notices; by default they are printed to the console. */
  onNotice?: (notice: postgres.Notice) => void;
}

/**
 * Creates the Drizzle client. Column names are mapped camelCase → snake_case.
 * Prepared statements are disabled for compatibility with Supabase's transaction-mode
 * connection pooler.
 */
export function createDatabase({
  url,
  maxConnections = DEFAULT_MAX_CONNECTIONS,
  onNotice,
}: DatabaseOptions) {
  const client = postgres(url, {
    max: maxConnections,
    prepare: false,
    ...(onNotice ? { onnotice: onNotice } : {}),
  });
  const db = drizzle({ client, schema, casing: 'snake_case' });
  return { db, close: () => client.end() };
}

export type Database = ReturnType<typeof createDatabase>['db'];

export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Either the database or an open transaction; repositories accept both. */
export type DbExecutor = Database | Transaction;
