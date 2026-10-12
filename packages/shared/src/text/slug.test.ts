import { describe, expect, it } from 'vitest';
import { slugify } from './slug';

describe('slugify', () => {
  it.each([
    ['Đorđe Petrović', 'djordje-petrovic'],
    ['Čačak, Šabac i Žabalj', 'cacak-sabac-i-zabalj'],
    ['Стан на Врачару', 'stan-na-vracaru'],
    ['Љубица Њежић Џаковић', 'ljubica-njezic-dzakovic'],
    ['  Three-bedroom   apartment!! ', 'three-bedroom-apartment'],
    ['Café Zürich', 'cafe-zurich'],
  ])('%j → %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('returns an empty string when nothing usable remains', () => {
    expect(slugify('!!! ???')).toBe('');
  });

  it('truncates without leaving a trailing hyphen', () => {
    expect(slugify('abc def ghi', 4)).toBe('abc');
  });
});
