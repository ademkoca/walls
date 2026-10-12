import { randomBytes, scrypt, type ScryptOptions, timingSafeEqual } from 'node:crypto';

/**
 * scrypt parameters from the OWASP Password Storage Cheat Sheet (N=2^15, r=8, p=3,
 * ~32 MiB per hash). They are stored with each hash so they can be raised later.
 */
const PARAMS = { N: 2 ** 15, r: 8, p: 3 } as const;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const SCRYPT_BLOCK_BYTES = 128;
const MAXMEM_HEADROOM = 2;
const PREFIX = 'scrypt';

function deriveKey(password: string, salt: Buffer, params: { N: number; r: number; p: number }) {
  const options: ScryptOptions = {
    ...params,
    maxmem: SCRYPT_BLOCK_BYTES * params.N * params.r * MAXMEM_HEADROOM,
  };
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

/** Format: scrypt$N$r$p$<salt base64url>$<key base64url>. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, salt, PARAMS);
  return [
    PREFIX,
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [prefix, n, r, p, salt, key] = storedHash.split('$');
  if (prefix !== PREFIX || !n || !r || !p || !salt || !key) return false;
  const expected = Buffer.from(key, 'base64url');
  const actual = await deriveKey(password, Buffer.from(salt, 'base64url'), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A hash that never matches, so failed logins for unknown emails take as long as real ones. */
let dummyHash: Promise<string> | undefined;
export function timingSafeDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(SALT_BYTES).toString('base64url'));
  return dummyHash;
}
