# Brand assets

Source files for the Walls brand. Brand values used in code (name, domain, colors, asset names)
live in [`../src/brand/brand.ts`](../src/brand/brand.ts); components and scripts read them from
there.

## Source artwork

These files are the source of truth. Do not edit them by hand; replace them with new exports.

| File             | Content                                               |
| ---------------- | ----------------------------------------------------- |
| `walls-logo.svg` | Approved stacked artwork: mark, `WALLS`, `REAL ESTATE` |
| `favicon.svg`    | Mark only                                             |

`walls-logo.svg` sets the wordmark as live text in Montserrat, which renders in a fallback
font wherever Montserrat is not installed. Never use it directly; use the generated variants.

## Generated logo variants

`pnpm brand:generate` converts the wordmark to vector outlines using the real Montserrat font
(from `@fontsource/montserrat`), keeping the artwork's sizes, weights, letter spacing and
baselines, and writes these files (commit the output):

| File                                | Use                                       |
| ----------------------------------- | ----------------------------------------- |
| `walls-logo-stacked.svg`            | Stacked lockup on light surfaces          |
| `walls-logo-stacked-inverse.svg`    | Stacked lockup on dark surfaces           |
| `walls-logo-horizontal.svg`         | Mark beside the wordmark, e.g. the header |
| `walls-logo-horizontal-inverse.svg` | Horizontal lockup on dark surfaces        |

Inverse variants replace charcoal with cream; orange is unchanged. All variants are cropped to
the artwork's edges, so layouts add their own clear space. In the horizontal lockup the text block is
vertically centred on the mark and separated from it by a quarter of the mark’s height;
`REAL ESTATE` is centred under `WALLS`.

## Generated rasters

The same command renders these:

| Output                                        | Source                     | Use                                    |
| --------------------------------------------- | -------------------------- | -------------------------------------- |
| `apps/web/src/app/favicon.ico` (16/32/48)     | `favicon.svg`              | Legacy favicon                         |
| `apps/web/src/app/icon.svg`                   | `favicon.svg`              | Scalable favicon (copy of the mark)    |
| `apps/web/src/app/apple-icon.png` (180)       | `favicon.svg`              | iOS home-screen icon, cream backdrop   |
| `apps/web/public/icons/icon-{192,512}.png`    | `favicon.svg`              | Web app manifest icons, cream backdrop |
| `apps/web/src/app/opengraph-image.png` (1200×630) and `.alt.txt` | `walls-logo-stacked.svg` | Default link preview image |

## Typography

Montserrat is the typeface for all UI text, headings and body (`brand.typography.ui`).

## Color usage

The logo's colors are the official palette (SPEC §33). Contrast checks (WCAG AA: 4.5:1 normal
text, 3:1 large text):

| Pair                    | Ratio | Rule                                              |
| ----------------------- | ----- | ------------------------------------------------- |
| cream on orange         | 2.68  | Used on orange buttons and badges (owner's choice); fails AA |
| charcoal on orange      | 6.03  | The accessible alternative: set `--primary-foreground` to charcoal |
| white on orange         | 2.87  | Fails; never use                                  |
| orange on white / cream | 2.87 / 2.68 | Fails; no orange text on light surfaces     |
| orange on charcoal      | 6.03  | Orange text and accents are fine on dark surfaces |
| slate on white / cream  | 4.83 / 4.51 | Passes for secondary text (cream is borderline) |
| charcoal on cream       | 16.17 | Primary text                                      |

`favicon.svg` uses a charcoal shape, which has low contrast on dark browser tabs.
