import { Hanken_Grotesk, Red_Hat_Mono } from 'next/font/google';

/**
 * The typefaces of the Tlocrt direction (`brand.typography`). latin-ext covers Serbian Latin
 * (č, ć, š, ž, đ). Self-hosted by Next.js at build time and exposed as CSS variables for the
 * theme in globals.css. Headings use the UI face in its heaviest weight; the logo wordmark is
 * outlined in the logo files.
 */
const ui = Hanken_Grotesk({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-ui',
  display: 'swap',
});

const figures = Red_Hat_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-figures',
  display: 'swap',
});

/** Class names that define every font variable; set on <html>. */
export const fontVariables = [ui.variable, figures.variable].join(' ');
