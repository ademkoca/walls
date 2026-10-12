const DEV_API_URL = 'http://localhost:4000';

/**
 * Base URL of the API for server-side calls and the /api rewrite. Required in production;
 * defaults to the local API in development.
 */
export function apiInternalUrl(): string {
  const url = process.env.API_INTERNAL_URL;
  if (url) return url.replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('API_INTERNAL_URL must be set for production builds');
  }
  return DEV_API_URL;
}
