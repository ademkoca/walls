import { resetTestDatabase } from './testing';

/**
 * Wipes and re-migrates DATABASE_URL, for end-to-end runs that need a clean database.
 * Refuses any database whose name does not end in `_test`.
 */
const url = process.env.DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test')) {
  throw new Error('db:reset-test only resets databases whose name ends in "_test"');
}
await resetTestDatabase(url);
