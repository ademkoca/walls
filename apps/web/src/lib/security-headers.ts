import { DEFAULT_TILE_URL, GEOCODER_ORIGIN } from './map/map-provider';

/** Hosts that listing photos are delivered from (Cloudinary), besides this site itself. */
const IMAGE_HOSTS = ['https://res.cloudinary.com'];

/**
 * The origin map tiles load from. `{s}` (a tile server letter) becomes a wildcard label.
 * Returns undefined when the URL cannot be read, so the policy then simply blocks it.
 */
export function tileOrigin(tileUrl: string): string | undefined {
  try {
    return new URL(tileUrl.replace('{s}', 'wildcard')).origin.replace('wildcard', '*');
  } catch {
    return undefined;
  }
}

export interface SecurityHeaderOptions {
  /** `next dev` needs eval for React's debugging features; production does not. */
  development: boolean;
  /** NEXT_PUBLIC_MAP_TILE_URL, or the default OpenStreetMap server. */
  tileUrl?: string;
}

/**
 * The Content Security Policy of the web app. It blocks scripts from other origins, frames,
 * plugins and unexpected image or connection hosts, and stops other sites from framing or
 * posting forms to us. Inline scripts and styles stay allowed: Next.js writes inline scripts
 * for rendering, and the map and drag-and-drop libraries set inline styles. Removing
 * 'unsafe-inline' for scripts needs per-request nonces (which would make every page dynamic)
 * or Next's experimental SRI; see "Content Security Policy" in the Next.js docs.
 */
export function contentSecurityPolicy({
  development,
  tileUrl = DEFAULT_TILE_URL,
}: SecurityHeaderOptions): string {
  const tiles = tileOrigin(tileUrl);
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", ...(development ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', ...IMAGE_HOSTS, ...(tiles ? [tiles] : [])],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", GEOCODER_ORIGIN, ...(development ? ['ws:', 'wss:'] : [])],
    'worker-src': ["'self'", 'blob:'],
    'frame-src': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

/**
 * Headers for every response of the web app. The referrer policy keeps sending the page's
 * origin to the map tile server, which its usage policy requires; geolocation is allowed for
 * this site only ("Use my location" in the listing form).
 */
export function securityHeaders(options: SecurityHeaderOptions): { key: string; value: string }[] {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(options) },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), payment=(), usb=(), geolocation=(self)',
    },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ];
}
