import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// All apps share the single root .env file documented in .env.example.
loadEnvConfig(repoRoot);

const nextConfig: NextConfig = {
  // Internal workspace packages ship TypeScript source and are compiled by Next.
  transpilePackages: ['@walls/ui', '@walls/shared', '@walls/validation'],
  turbopack: {
    root: repoRoot,
  },
};

export default nextConfig;
