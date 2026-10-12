import { createHmac, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32;

/** A random opaque token for session cookies and emailed links (43 base64url characters). */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/**
 * Tokens are stored only as keyed hashes (HMAC-SHA-256 with SESSION_SECRET), so a
 * database leak exposes no usable tokens and database write access alone cannot mint one.
 */
export function hashToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('base64url');
}
