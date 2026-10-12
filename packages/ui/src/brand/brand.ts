/**
 * Walls brand configuration — the single source of truth for brand identity.
 *
 * Components, metadata, emails and asset scripts must read brand values from here
 * instead of hard-coding them, so the product can be rebranded by editing this file
 * and the SVG sources in `packages/ui/brand/`. See `packages/ui/brand/README.md`.
 */

export const brand = {
  name: 'Walls',
  descriptor: 'Real Estate',
  domain: 'walls.rs',
  siteUrl: 'https://walls.rs',

  /** Source SVGs, relative to `packages/ui/brand/`. Never edit these by hand. */
  assets: {
    /** Stacked lockup: mark above the WALLS wordmark and REAL ESTATE descriptor. */
    logoStacked: 'walls-logo.svg',
    /** Mark only; also the source for favicons and app icons. */
    mark: 'favicon.svg',
  },

  /**
   * Brand palette. The logo artwork's colors are authoritative (SPEC §33).
   *
   * WCAG contrast (normal text needs 4.5:1, large text 3:1):
   *  - charcoal on orange 6.03  → use charcoal text on orange buttons and badges
   *  - white on orange    2.87  → fails even for large text; never use
   *  - orange on white    2.87 / on cream 2.68 → never use orange for text on light surfaces
   *  - orange on charcoal 6.03  → orange accents/text are fine on dark surfaces
   *  - slate on white     4.83 / on cream 4.51 → secondary text passes AA (cream is borderline)
   */
  colors: {
    orange: '#FF6A00',
    charcoal: '#171B1E',
    slate: '#6B7280',
    cream: '#F8F7F4',
    white: '#FFFFFF',
  },

  typography: {
    /** Typeface of the logo wordmark. The UI typeface is decided in Phase 4. */
    wordmark: 'Montserrat',
  },
} as const;

export type Brand = typeof brand;
export type BrandColor = keyof Brand['colors'];
