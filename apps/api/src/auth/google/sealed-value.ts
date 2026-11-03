import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Short-lived values the API hands the browser in a cookie and must get back unchanged:
 * JSON, base64url-encoded, with an expiry and an HMAC-SHA-256 keyed with SESSION_SECRET.
 * `purpose` keeps a value sealed for one use from being accepted for another. They are signed,
 * not encrypted, so they hold nothing the browser's owner may not see.
 */
export function seal(value: object, secret: string, purpose: string, ttlMs: number): string {
  const payload = Buffer.from(
    JSON.stringify({ value, expiresAt: Date.now() + ttlMs }),
    'utf8',
  ).toString('base64url');
  return `${payload}.${mac(payload, secret, purpose)}`;
}

/** The sealed value, or null when it is missing, altered, for another purpose or expired. */
export function unseal(sealed: unknown, secret: string, purpose: string): unknown {
  if (typeof sealed !== 'string') return null;
  const [payload, signature, extra] = sealed.split('.');
  if (!payload || !signature || extra !== undefined) return null;

  const expected = Buffer.from(mac(payload, secret, purpose));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      value?: unknown;
      expiresAt?: unknown;
    };
    if (typeof parsed.expiresAt !== 'number' || parsed.expiresAt <= Date.now()) return null;
    return parsed.value ?? null;
  } catch {
    return null;
  }
}

function mac(payload: string, secret: string, purpose: string): string {
  return createHmac('sha256', secret).update(`${purpose}.${payload}`).digest('base64url');
}
