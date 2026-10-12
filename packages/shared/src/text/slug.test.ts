import { describe, expect, it } from 'vitest';
import { listingSlugBase, nextFreeSlug, slugify } from './slug';

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

describe('nextFreeSlug', () => {
  it('returns the base when free, otherwise the first free numbered variant', () => {
    expect(nextFreeSlug('stan', new Set())).toBe('stan');
    expect(nextFreeSlug('stan', new Set(['stan', 'stan-2']))).toBe('stan-3');
  });
});

describe('listingSlugBase', () => {
  it('combines the Serbian title and the city', () => {
    expect(listingSlugBase('Trosoban stan na Vračaru', 'Beograd')).toBe(
      'trosoban-stan-na-vracaru-beograd',
    );
  });

  it('does not repeat a city that is already in the title', () => {
    expect(listingSlugBase('Kuća u Novom Sadu', 'Novi Sad')).toBe('kuca-u-novom-sadu-novi-sad');
    expect(listingSlugBase('Stan Beograd centar', 'Beograd')).toBe('stan-beograd-centar');
    expect(listingSlugBase('Plac Novi Sad Klisa', 'Novi Sad')).toBe('plac-novi-sad-klisa');
  });

  it('falls back when nothing usable remains', () => {
    expect(listingSlugBase('!!!', null)).toBe('nekretnina');
  });
});
