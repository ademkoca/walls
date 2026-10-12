import { resetTestDatabase } from '../src/testing';
import { testDatabaseUrl } from './env';

/** Rebuilds the test database from the migrations once per test run. */
export default async function setup(): Promise<void> {
  await resetTestDatabase(testDatabaseUrl());
}
