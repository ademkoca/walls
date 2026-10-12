import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/** Resolves the locale from the URL (Next.js 16 "proxy", formerly middleware). */
export default createMiddleware(routing);

export const config = {
  // Everything except the /api proxy, Next.js internals and files with an extension.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
