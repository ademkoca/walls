/**
 * Generates the outlined logo variants from the approved source artwork
 * (packages/ui/brand/walls-logo.svg). The source sets the wordmark as live text in
 * Montserrat, which renders in a fallback font wherever Montserrat is unavailable
 * (e.g. <img>, emails, favicons). This script converts the text to vector paths using
 * the real font, keeping the source's sizes, weights, letter spacing and baselines.
 *
 * Run with `pnpm brand:generate`; commit the output.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as fontkit from 'fontkit';
import { brand } from '../packages/ui/src/brand/brand.ts';

const repoRoot = path.resolve(import.meta.dirname, '..');
const brandDir = path.join(repoRoot, 'packages/ui/brand');
const fontDir = path.join(repoRoot, 'node_modules/@fontsource/montserrat/files');

// Typography and layout of the source artwork (walls-logo.svg).
const SOURCE = {
  /** Horizontal centre of the mark; both text lines are centred on it. */
  centerX: 185,
  wordmark: { text: 'WALLS', weight: 600, size: 47, letterSpacing: 12, baseline: 202 },
  descriptor: { text: 'REAL ESTATE', weight: 500, size: 15, letterSpacing: 6.1, baseline: 235 },
  /** Bounding box of the mark's shapes in the source coordinate space. */
  mark: { minX: 137, minY: 50, maxX: 233, maxY: 146 },
} as const;

/** Gap between mark and text in the horizontal lockup, as a share of the mark height. */
const HORIZONTAL_GAP_RATIO = 0.25;
const COORDINATE_DECIMALS = 2;

type TextLine = (typeof SOURCE)['wordmark'] | (typeof SOURCE)['descriptor'];

interface OutlinedLine {
  /** SVG path data with the ink's left edge at x=0 and the baseline at y=0. */
  d: string;
  width: number;
  /** Cap height above the baseline. */
  capHeight: number;
}

function loadFont(weight: number): fontkit.Font {
  const font = fontkit.openSync(path.join(fontDir, `montserrat-latin-${weight}-normal.woff`));
  if (!('layout' in font)) throw new Error(`Expected a single font for weight ${weight}`);
  return font;
}

const round = (value: number) => Number(value.toFixed(COORDINATE_DECIMALS));
const roundPathData = (d: string) =>
  d.replace(/-?\d*\.?\d+(?:e-?\d+)?/g, (n) => String(round(Number(n))));

/** Converts a line of text to outlines, applying letter spacing between glyphs. */
function outline(line: TextLine): OutlinedLine {
  const font = loadFont(line.weight);
  const scale = line.size / font.unitsPerEm;
  const run = font.layout(line.text);

  let penX = 0;
  let inkLeft = Infinity;
  let inkRight = -Infinity;
  const placed: { path: fontkit.Path; x: number }[] = [];
  run.glyphs.forEach((glyph, index) => {
    const { minX, maxX } = glyph.bbox;
    if (maxX > minX) {
      inkLeft = Math.min(inkLeft, penX + minX * scale);
      inkRight = Math.max(inkRight, penX + maxX * scale);
      placed.push({ path: glyph.path, x: penX });
    }
    penX += (run.positions[index]?.xAdvance ?? 0) * scale + line.letterSpacing;
  });

  // Font units are y-up; SVG is y-down. Shift so the ink starts at x=0.
  const d = placed
    .map(({ path: glyphPath, x }) =>
      glyphPath
        .scale(scale, -scale)
        .translate(x - inkLeft, 0)
        .toSVG(),
    )
    .join('');
  return { d: roundPathData(d), width: inkRight - inkLeft, capHeight: font.capHeight * scale };
}

/** The mark's shapes, extracted verbatim from the source artwork. */
async function readMark(): Promise<string> {
  const source = await readFile(path.join(brandDir, brand.assets.sourceArtwork), 'utf8');
  const match = /<g id="mark">([\s\S]*?)<\/g>\s*<g fill=/.exec(source);
  if (!match?.[1]) throw new Error('Could not find <g id="mark"> in the source artwork');
  return match[1].trim();
}

type Tone = 'default' | 'inverse';

/**
 * Inverse variants, for dark surfaces, swap charcoal for cream and the orange for the
 * lighter `orangeOnDark`, which keeps the mark bright on charcoal.
 */
function colors(tone: Tone) {
  if (tone === 'default') {
    return { ink: brand.colors.charcoal, recolorMark: (mark: string) => mark };
  }
  const ink = brand.colors.cream;
  const recolorMark = (mark: string) =>
    mark
      .replaceAll(brand.colors.charcoal, ink)
      .replaceAll(brand.colors.orange, brand.colors.orangeOnDark);
  return { ink, recolorMark };
}

function svgDocument(width: number, height: number, title: string, body: string): string {
  const w = round(width);
  const h = round(height);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}">`,
    `  <title>${title}</title>`,
    body,
    '</svg>',
    '',
  ].join('\n');
}

const TITLE = `${brand.name} ${brand.descriptor}`;

/** Mark above the wordmark, as in the source artwork; cropped to the artwork's edges. */
function stacked(
  mark: string,
  wordmark: OutlinedLine,
  descriptor: OutlinedLine,
  tone: Tone,
): string {
  const { ink, recolorMark } = colors(tone);
  const left = Math.min(
    SOURCE.mark.minX,
    SOURCE.centerX - wordmark.width / 2,
    SOURCE.centerX - descriptor.width / 2,
  );
  const right = Math.max(
    SOURCE.mark.maxX,
    SOURCE.centerX + wordmark.width / 2,
    SOURCE.centerX + descriptor.width / 2,
  );
  const top = SOURCE.mark.minY;
  const bottom = SOURCE.descriptor.baseline;
  const at = (x: number, y: number) => `translate(${round(x - left)} ${round(y - top)})`;

  return svgDocument(
    right - left,
    bottom - top,
    TITLE,
    [
      `  <g transform="${at(0, 0)}">${recolorMark(mark)}</g>`,
      `  <path fill="${ink}" transform="${at(SOURCE.centerX - wordmark.width / 2, SOURCE.wordmark.baseline)}" d="${wordmark.d}"/>`,
      `  <path fill="${ink}" transform="${at(SOURCE.centerX - descriptor.width / 2, SOURCE.descriptor.baseline)}" d="${descriptor.d}"/>`,
    ].join('\n'),
  );
}

/**
 * Mark to the left of the text block, which is vertically centred on the mark. Within the
 * block both lines are centred on each other, as in the stacked artwork.
 */
function horizontal(
  mark: string,
  wordmark: OutlinedLine,
  descriptor: OutlinedLine,
  tone: Tone,
): string {
  const { ink, recolorMark } = colors(tone);
  const markWidth = SOURCE.mark.maxX - SOURCE.mark.minX;
  const markHeight = SOURCE.mark.maxY - SOURCE.mark.minY;
  const textX = markWidth + markHeight * HORIZONTAL_GAP_RATIO;
  const blockWidth = Math.max(wordmark.width, descriptor.width);
  const centredX = (line: OutlinedLine) => textX + (blockWidth - line.width) / 2;

  // Keep the source's spacing between the two lines.
  const lineGap = SOURCE.descriptor.baseline - descriptor.capHeight - SOURCE.wordmark.baseline;
  const blockHeight = wordmark.capHeight + lineGap + descriptor.capHeight;
  const wordmarkBaseline = (markHeight - blockHeight) / 2 + wordmark.capHeight;
  const descriptorBaseline = wordmarkBaseline + lineGap + descriptor.capHeight;

  return svgDocument(
    textX + blockWidth,
    markHeight,
    TITLE,
    [
      `  <g transform="translate(${-SOURCE.mark.minX} ${-SOURCE.mark.minY})">${recolorMark(mark)}</g>`,
      `  <path fill="${ink}" transform="translate(${round(centredX(wordmark))} ${round(wordmarkBaseline)})" d="${wordmark.d}"/>`,
      `  <path fill="${ink}" transform="translate(${round(centredX(descriptor))} ${round(descriptorBaseline)})" d="${descriptor.d}"/>`,
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const mark = (await readMark()).replace(/\n\s*/g, '');
  const wordmark = outline(SOURCE.wordmark);
  const descriptor = outline(SOURCE.descriptor);

  const outputs: Record<string, string> = {
    [brand.assets.logoStacked]: stacked(mark, wordmark, descriptor, 'default'),
    [brand.assets.logoStackedInverse]: stacked(mark, wordmark, descriptor, 'inverse'),
    [brand.assets.logoHorizontal]: horizontal(mark, wordmark, descriptor, 'default'),
    [brand.assets.logoHorizontalInverse]: horizontal(mark, wordmark, descriptor, 'inverse'),
  };
  for (const [file, svg] of Object.entries(outputs)) {
    await writeFile(path.join(brandDir, file), svg);
    console.info(`wrote packages/ui/brand/${file}`);
  }
}

await main();
