import './env';
import { resetTestDatabase, testDatabaseUrl } from '@walls/database/testing';

export default async function setup(): Promise<void> {
  await resetTestDatabase(testDatabaseUrl());
}
