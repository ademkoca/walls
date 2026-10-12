/** Public site navigation (SPEC §16). Labels are translation keys under `nav`. */
export const MAIN_NAV = [
  { href: '/properties', labelKey: 'properties' },
  { href: '/agents', labelKey: 'agents' },
  { href: '/about', labelKey: 'about' },
  { href: '/contact', labelKey: 'contact' },
] as const;

export type NavItem = (typeof MAIN_NAV)[number];
