/** Whether a search box holds anything worth searching for: at least one letter or digit. */
export function hasSearchableText(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}
