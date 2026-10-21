/**
 * Walls brand configuration — the single source of truth for brand identity.
 *
 * Components, metadata, emails and asset scripts must read brand values from here
 * instead of hard-coding them, so the product can be rebranded by editing this file
 * and the SVG sources in `packages/ui/brand/`. See `packages/ui/brand/README.md`.
 */

/** Legal details of the company behind the brand. */
export interface CompanyDetails {
  /** Public contact address; the contact form also delivers here. */
  email: string;
  legalName: string | null;
  streetAddress: string | null;
  /** Matični broj (MB). */
  registrationNumber: string | null;
  /** Poreski identifikacioni broj (PIB). */
  taxId: string | null;
}

const COMPANY: CompanyDetails = {
  email: 'contact@walls.rs',
  legalName: null,
  streetAddress: null,
  registrationNumber: null,
  taxId: null,
};

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
   * WCAG contrast (normal text needs 4.5:1, large text 3:1; graphics 3:1):
   *  - cream on orange          4.83 → text on orange buttons and badges (passes AA)
   *  - white on orange          5.18 → also passes
   *  - charcoal on orange       3.35 → large text only; not used
   *  - orange on white / cream  5.18 / 4.83 → orange text on light surfaces passes AA
   *  - orangeOnDark on charcoal 6.03 → logo mark, accents and focus rings on dark surfaces
   *  - orange on charcoal       3.35 → orange buttons on dark surfaces stay visible (graphics)
   *  - slate on white     4.83 / on cream 4.51 → secondary text passes AA (cream is borderline)
   */
  colors: {
    orange: '#C2410C',
    /**
     * Lighter orange for dark surfaces: the inverse logos, accents and focus rings. Never
     * behind text: cream on it is 2.68:1.
     */
    orangeOnDark: '#FF6A00',
    charcoal: '#171B1E',
    slate: '#6B7280',
    cream: '#F8F7F4',
    white: '#FFFFFF',
  },

  /**
   * The company behind the brand. The contact page lists only the details that are set, and
   * hides the section while all are `null` (the company is not registered yet, decision
   * 2026-10-21); fill them in once it is.
   */
  company: COMPANY,

  typography: {
    /** Typeface for all UI text, headings and body. */
    ui: 'Montserrat',
    /** Typeface of the logo wordmark (already outlined in the logo files). */
    wordmark: 'Montserrat',
  },
} as const;

export type Brand = typeof brand;
export type BrandColor = keyof Brand['colors'];
