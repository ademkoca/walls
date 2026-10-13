import { createDatabase } from './client';
import { migrateDatabase } from './migrate';

/**
 * Applies pending migrations to DATABASE_URL (`pnpm db:migrate`, and every Render build).
 * Unlike `drizzle-kit migrate`, which exits without saying why it failed, this prints the
 * database's error. The connection string is never printed: it contains the password.
 */
const DETAIL_FIELDS = ['code', 'detail', 'hint'] as const;

type DetailedError = Error & Partial<Record<(typeof DETAIL_FIELDS)[number], unknown>>;

/** The error and its causes (Drizzle wraps the Postgres error), with Postgres' details. */
function describe(error: unknown): string {
  const lines: string[] = [];
  for (let current: unknown = error; current instanceof Error; current = current.cause) {
    lines.push(current.message);
    for (const key of DETAIL_FIELDS) {
      const value = (current as DetailedError)[key];
      if (typeof value === 'string' && value) lines.push(`${key}: ${value}`);
    }
  }
  return lines.join('\n  ') || 'unknown error';
}

function target(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    return `database "${pathname.slice(1)}" on ${hostname}`;
  } catch {
    // The URL error would include the whole string, password and all.
    throw new Error(
      'DATABASE_URL is not a valid URL. Characters such as @ # / ? in the password must be ' +
        'percent-encoded.',
    );
  }
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (see .env.example)');
console.log(`Applying migrations to ${target(url)}`);

// Notices such as "relation already exists, skipping" are expected on every run.
const { db, close } = createDatabase({ url, maxConnections: 1, onNotice: () => undefined });
try {
  await migrateDatabase(db);
  console.log('Migrations applied.');
} catch (error) {
  console.error(`Migration failed: ${describe(error)}`);
  process.exitCode = 1;
} finally {
  await close();
}
