const MAX_INITIALS = 2;

/** Up to two initials of a name, e.g. "Ana Anić" → "AA", for avatar placeholders. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_INITIALS)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
