import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// All apps share the single root .env file documented in .env.example.
// forceReload: Next has already loaded (and cached) env files from apps/web by now.
loadEnvConfig(repoRoot, process.env.NODE_ENV !== 'production', undefined, true);

const DEV_API_URL = 'http://localhost:4000';

/** Where /api/* is proxied. Required in production; defaults to the local API in development. */
function apiInternalUrl(): string {
  const url = process.env.API_INTERNAL_URL;
  if (url) return url.replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('API_INTERNAL_URL must be set for production builds');
  }
  return DEV_API_URL;
}

const nextConfig: NextConfig = {
  // Internal workspace packages ship TypeScript source and are compiled by Next.
  transpilePackages: ['@walls/ui', '@walls/shared', '@walls/validation'],
  turbopack: {
    root: repoRoot,
  },
  // Browsers call the API through the web origin, so the session cookie stays first-party
  // even though the API is hosted elsewhere (Render).
  rewrites: () =>
    Promise.resolve([{ source: '/api/:path*', destination: `${apiInternalUrl()}/api/:path*` }]),
};

export default nextConfig;
