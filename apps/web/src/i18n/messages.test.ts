import { ApiErrorCode, Role } from '@walls/shared';
import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import sr from '../../messages/sr.json';

type Tree = { [key: string]: string | Tree };

/** Flattens nested messages into "a.b.c" → text. */
function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((all, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string'
      ? { ...all, [path]: value }
      : { ...all, ...flatten(value, path) };
  }, {});
}

/** ICU argument names used in a message, e.g. {email} or {min, plural, …}. */
function argumentsOf(message: string): string[] {
  return [...message.matchAll(/\{\s*([a-zA-Z]+)\s*[,}]/g)].map((match) => match[1] ?? '').sort();
}

const catalogues = { sr: flatten(sr), en: flatten(en) };

describe('translation catalogues (SPEC §31)', () => {
  it('have exactly the same keys in Serbian and English', () => {
    expect(Object.keys(catalogues.en).sort()).toEqual(Object.keys(catalogues.sr).sort());
  });

  it('use the same placeholders in both languages', () => {
    for (const [key, message] of Object.entries(catalogues.sr)) {
      expect(argumentsOf(catalogues.en[key] ?? ''), key).toEqual(argumentsOf(message));
    }
  });

  it('have no empty messages', () => {
    for (const [locale, messages] of Object.entries(catalogues)) {
      for (const [key, message] of Object.entries(messages)) {
        expect(message.trim(), `${locale}: ${key}`).not.toBe('');
      }
    }
  });

  it('translate every API error code', () => {
    for (const code of Object.values(ApiErrorCode)) {
      expect(catalogues.sr[`errors.${code}`], code).toBeDefined();
    }
  });

  it('translate every role', () => {
    for (const role of Object.values(Role)) {
      expect(catalogues.sr[`roles.${role}`], role).toBeDefined();
    }
  });
});
