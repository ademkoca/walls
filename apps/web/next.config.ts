import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { apiInternalUrl } from './src/lib/api-internal-url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// All apps share the single root .env file documented in .env.example.
// forceReload: Next has already loaded (and cached) env files from apps/web by now.
loadEnvConfig(repoRoot, process.env.NODE_ENV !== 'production', undefined, true);

const nextConfig: NextConfig = {
  // Development only: lets a phone on the same Wi-Fi open the dev server by its network
  // address (e.g. http://192.168.1.75:3000). Without this, Next.js refuses to serve the
  // dev scripts to that address, so the page shows but nothing is interactive.
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '*.local'],
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

export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig);
