import { describe, expect, it } from 'vitest';
import { hasSearchableText } from './search-text';

describe('hasSearchableText', () => {
  it('needs at least one letter or digit', () => {
    expect(hasSearchableText('Ana')).toBe(true);
    expect(hasSearchableText('  ana@example.com ')).toBe(true);
    expect(hasSearchableText('Đorđe')).toBe(true);
    expect(hasSearchableText('Милица')).toBe(true);
    expect(hasSearchableText('42')).toBe(true);
  });

  it('rejects empty text, spaces and symbols only', () => {
    expect(hasSearchableText('')).toBe(false);
    expect(hasSearchableText('   ')).toBe(false);
    expect(hasSearchableText(' -_.@# %& ')).toBe(false);
    expect(hasSearchableText('\t\n')).toBe(false);
  });
});
