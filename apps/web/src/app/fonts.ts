import { Montserrat } from 'next/font/google';

/**
 * Montserrat for all UI text (SPEC §33). latin-ext covers Serbian Latin (č, ć, š, ž, đ).
 * Self-hosted by Next.js at build time; exposed as --font-montserrat for the theme.
 * To change the typeface, replace this loader and `brand.typography.ui`.
 */
export const uiFont = Montserrat({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-montserrat',
  display: 'swap',
});
