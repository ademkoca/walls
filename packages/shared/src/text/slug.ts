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
