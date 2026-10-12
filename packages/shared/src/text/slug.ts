/** Serbian letters that Unicode normalisation does not reduce to ASCII, plus Serbian Cyrillic. */
const TRANSLITERATION: Readonly<Record<string, string>> = {
  đ: 'dj',
  Đ: 'dj',
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  ђ: 'dj',
  е: 'e',
  ж: 'z',
  з: 'z',
  и: 'i',
  ј: 'j',
  к: 'k',
  л: 'l',
  љ: 'lj',
  м: 'm',
  н: 'n',
  њ: 'nj',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  ћ: 'c',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'c',
  џ: 'dz',
  ш: 's',
};

export const SLUG_MAX_LENGTH = 80;

/**
 * Turns text into a URL segment: lowercase ASCII words joined by hyphens.
 * "Đorđe Petrović" → "djordje-petrovic", "Стан на Врачару" → "stan-na-vracaru".
 * Returns an empty string when nothing usable remains; callers supply a fallback.
 */
export function slugify(text: string, maxLength: number = SLUG_MAX_LENGTH): string {
  const transliterated = Array.from(
    text.toLowerCase(),
    (char) => TRANSLITERATION[char] ?? char,
  ).join('');
  return transliterated
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/, '');
}

/**
 * The first of `base`, `base-2`, `base-3`, … that is not in `taken`. Callers load the taken
 * slugs that start with `base` and rely on a unique index for concurrent writers.
 */
export function nextFreeSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

const LISTING_SLUG_FALLBACK = 'nekretnina';

/**
 * Stable public URL segment for a listing, from its Serbian title and city (SPEC §32), e.g.
 * "trosoban-stan-na-vracaru-beograd". Assigned at first publication and never changed.
 */
export function listingSlugBase(title: string, city: string | null): string {
  const titleSlug = slugify(title);
  const citySlug = city ? slugify(city) : '';
  const cityInTitle = citySlug !== '' && `-${titleSlug}-`.includes(`-${citySlug}-`);
  const parts = cityInTitle ? [titleSlug] : [titleSlug, citySlug];
  return slugify(parts.filter(Boolean).join('-')) || LISTING_SLUG_FALLBACK;
}
