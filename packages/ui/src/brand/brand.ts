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

  /**
   * Logo files, relative to `packages/ui/brand/`. Never edit them by hand: the variants
   * are generated from the source artwork by `pnpm brand:generate`.
   */
  assets: {
    /** Approved source artwork. Its wordmark is live text, so do not use it directly. */
    sourceArtwork: 'walls-logo.svg',
    /** Mark above the WALLS wordmark and REAL ESTATE descriptor, text outlined. */
    logoStacked: 'walls-logo-stacked.svg',
    /** Stacked lockup for dark surfaces. */
    logoStackedInverse: 'walls-logo-stacked-inverse.svg',
    /** Mark beside the wordmark, for headers. */
    logoHorizontal: 'walls-logo-horizontal.svg',
    /** Horizontal lockup for dark surfaces, e.g. the footer. */
    logoHorizontalInverse: 'walls-logo-horizontal-inverse.svg',
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
    /** Typeface for all UI text, headings and body. */
    ui: 'Montserrat',
    /** Typeface of the logo wordmark (already outlined in the logo files). */
    wordmark: 'Montserrat',
  },
} as const;

export type Brand = typeof brand;
export type BrandColor = keyof Brand['colors'];
