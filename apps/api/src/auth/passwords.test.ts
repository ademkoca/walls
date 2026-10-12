import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './passwords';

describe('password hashing', () => {
  it('verifies the correct password and rejects others', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).toMatch(/^scrypt\$32768\$8\$3\$[\w-]+\$[\w-]+$/);
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('correct horse batterY', hash)).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same password')).not.toBe(await hashPassword('same password'));
  });

  it('treats equivalent Unicode forms as the same password', async () => {
    const hash = await hashPassword('lozinka-č'); // precomposed č
    expect(await verifyPassword('lozinka-č', hash)).toBe(true); // c + combining caron
  });

  it.each(['', 'bcrypt$x', 'scrypt$1$2$3'])('rejects the malformed hash %j', async (stored) => {
    expect(await verifyPassword('anything', stored)).toBe(false);
  });
});
