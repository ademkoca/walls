import { existsSync } from 'node:fs';
import path from 'node:path';

const rootEnvFile = path.resolve(import.meta.dirname, '../../../.env');
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

export { testDatabaseUrl } from '../src/testing';
