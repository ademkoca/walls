/**
 * Generates raster brand assets for the web app (favicons, app icons, link preview image)
 * from the SVG sources in packages/ui/brand/.
 * Run with `pnpm brand:generate` after changing a brand SVG or brand colors, and commit the output.
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { brand } from '../packages/ui/src/brand/brand.ts';

const repoRoot = path.resolve(import.meta.dirname, '..');
const brandDir = path.join(repoRoot, 'packages/ui/brand');
const webAppDir = path.join(repoRoot, 'apps/web/src/app');
const webIconsDir = path.join(repoRoot, 'apps/web/public/icons');
const webPublicDir = path.join(repoRoot, 'apps/web/public');
const brandTokensFile = path.join(repoRoot, 'packages/ui/src/styles/brand-tokens.css');

const FAVICON_SIZES = [16, 32, 48];
const APPLE_ICON_SIZE = 180;
const PWA_ICON_SIZES = [192, 512];
/** Share of a padded icon's width taken by the mark; stays inside the 80% maskable safe zone. */
const PADDED_MARK_SCALE = 0.6;
/** Email logo pixel density (2× for sharp logos on high-density screens). */
const EMAIL_LOGO_SCALE = 2;
/** Open Graph / social preview card size recommended by Facebook, LinkedIn and X. */
const OPEN_GRAPH_SIZE = { width: 1200, height: 630 } as const;
/** Share of the card height taken by the stacked logo. */
const OPEN_GRAPH_LOGO_SCALE = 0.48;
/** Render SVGs larger than the target and downscale, for crisp edges at small sizes. */
const SUPERSAMPLE = 4;
const CSS_DPI = 72;

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

async function renderSvg(svg: Buffer, size: number): Promise<Buffer> {
  const { width = size } = await sharp(svg).metadata();
  const density = Math.ceil((CSS_DPI * size * SUPERSAMPLE) / width);
  return sharp(svg, { density })
    .resize(size, size, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toBuffer();
}

/** The mark centered on an opaque paper square, as required by iOS and Android launchers. */
async function renderPaddedIcon(svg: Buffer, size: number): Promise<Buffer> {
  const markSize = Math.round(size * PADDED_MARK_SCALE);
  const mark = await renderSvg(svg, markSize);
  return sharp({
    create: { width: size, height: size, channels: 4, background: brand.colors.paper },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer();
}

/** The stacked logo centred on a paper card, used as the default link preview image. */
async function renderOpenGraphImage(logoSvg: Buffer): Promise<Buffer> {
  const height = Math.round(OPEN_GRAPH_SIZE.height * OPEN_GRAPH_LOGO_SCALE);
  const { height: svgHeight = height } = await sharp(logoSvg).metadata();
  const logo = await sharp(logoSvg, {
    density: Math.ceil((CSS_DPI * height * SUPERSAMPLE) / svgHeight),
  })
    .resize({ height })
    .png()
    .toBuffer();
  return sharp({ create: { ...OPEN_GRAPH_SIZE, channels: 4, background: brand.colors.paper } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer();
}

/**
 * The horizontal inverse logo on an opaque ink background, for email headers. Opaque so that it
 * stays readable when an email client's dark mode recolors the header behind it.
 */
async function renderEmailLogo(logoSvg: Buffer): Promise<Buffer> {
  const width = brand.emailLogo.width * EMAIL_LOGO_SCALE;
  const height = brand.emailLogo.height * EMAIL_LOGO_SCALE;
  const { width: svgWidth = width } = await sharp(logoSvg).metadata();
  const logo = await sharp(logoSvg, {
    density: Math.ceil((CSS_DPI * width * SUPERSAMPLE) / svgWidth),
  })
    .resize(width, height, { fit: 'contain', background: brand.colors.ink })
    .png()
    .toBuffer();
  return sharp({ create: { width, height, channels: 4, background: brand.colors.ink } })
    .composite([{ input: logo, gravity: 'center' }])
    .flatten({ background: brand.colors.ink })
    .png()
    .toBuffer();
}

/** Packs PNG images into an ICO container (PNG-in-ICO, supported by all current browsers). */
function encodeIco(images: { size: number; png: Buffer }[]): Buffer {
  const HEADER_BYTES = 6;
  const ENTRY_BYTES = 16;
  const header = Buffer.alloc(HEADER_BYTES);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = HEADER_BYTES + ENTRY_BYTES * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(ENTRY_BYTES);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 means 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // palette size
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

/** CSS custom properties for the brand palette, consumed by the theme in globals.css. */
function brandTokensCss(): string {
  const toKebab = (name: string) => name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
  // Lower-case hex, as Prettier writes it, so the generated file passes `format:check`.
  const declarations = Object.entries(brand.colors).map(
    ([name, value]) => `  --brand-${toKebab(name)}: ${value.toLowerCase()};`,
  );
  return [
    '/* Generated from packages/ui/src/brand/brand.ts by `pnpm brand:generate`. Do not edit. */',
    ':root {',
    ...declarations,
    '}',
    '',
  ].join('\n');
}

async function main(): Promise<void> {
  const markSvg = await readFile(path.join(brandDir, brand.assets.mark));
  const stackedLogoSvg = await readFile(path.join(brandDir, brand.assets.logoStacked));
  const inverseLogoSvg = await readFile(path.join(brandDir, brand.assets.logoHorizontalInverse));
  const emailLogoFile = path.join(webPublicDir, brand.emailLogo.path);
  await mkdir(webIconsDir, { recursive: true });
  await mkdir(path.dirname(emailLogoFile), { recursive: true });

  const outputs: Record<string, Buffer> = {
    [path.join(webAppDir, 'favicon.ico')]: encodeIco(
      await Promise.all(
        FAVICON_SIZES.map(async (size) => ({ size, png: await renderSvg(markSvg, size) })),
      ),
    ),
    [path.join(webAppDir, 'apple-icon.png')]: await renderPaddedIcon(markSvg, APPLE_ICON_SIZE),
    // Next.js serves app/opengraph-image.png (and its .alt.txt) as the default og:image.
    [path.join(webAppDir, 'opengraph-image.png')]: await renderOpenGraphImage(stackedLogoSvg),
    [path.join(webAppDir, 'opengraph-image.alt.txt')]: Buffer.from(
      `${brand.name} ${brand.descriptor} logo`,
    ),
    [emailLogoFile]: await renderEmailLogo(inverseLogoSvg),
    [brandTokensFile]: Buffer.from(brandTokensCss()),
  };
  for (const size of PWA_ICON_SIZES) {
    outputs[path.join(webIconsDir, `icon-${size}.png`)] = await renderPaddedIcon(markSvg, size);
  }

  for (const [file, data] of Object.entries(outputs)) {
    await writeFile(file, data);
  }
  // Next.js serves app/icon.svg as the scalable favicon.
  const iconSvg = path.join(webAppDir, 'icon.svg');
  await copyFile(path.join(brandDir, brand.assets.mark), iconSvg);

  for (const file of [...Object.keys(outputs), iconSvg]) {
    console.info(`wrote ${path.relative(repoRoot, file)}`);
  }
}

await main();
