# Brand assets

Source files for the Walls brand. Brand values used in code (name, domain, colors, asset names)
live in [`../src/brand/brand.ts`](../src/brand/brand.ts); components and scripts read them from
there.

## Source SVGs

These SVGs are the source of truth. Do not edit them by hand; replace them with new exports.

| File             | Content                                                      | Status                                                        |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| `walls-logo.svg` | Stacked lockup: mark, `WALLS` wordmark, `REAL ESTATE`        | Wordmark is live text (Montserrat); outlined export requested |
| `favicon.svg`    | Mark only                                                    | Final                                                         |

Planned variants, derived once the outlined `walls-logo.svg` arrives:

- **Horizontal lockup**: mark to the left of the wordmark, for the site and dashboard header.
- **Inverse**: light wordmark for the charcoal footer and other dark surfaces.

## Generated rasters

`pnpm brand:generate` renders these from `favicon.svg` (commit the output):

| Output                                       | Use                                   |
| -------------------------------------------- | ------------------------------------- |
| `apps/web/src/app/favicon.ico` (16/32/48)    | Legacy favicon                        |
| `apps/web/src/app/icon.svg`                  | Scalable favicon (copy of the mark)   |
| `apps/web/src/app/apple-icon.png` (180)      | iOS home-screen icon, cream backdrop  |
| `apps/web/public/icons/icon-{192,512}.png`   | Web app manifest icons, cream backdrop |

The Open Graph image (1200×630) is added once the outlined wordmark is available, so the
wordmark doesn't render in a fallback font.

## Color usage

The logo's colors are the official palette (SPEC §33). Contrast checks (WCAG AA: 4.5:1 normal
text, 3:1 large text):

| Pair                    | Ratio | Rule                                              |
| ----------------------- | ----- | ------------------------------------------------- |
| charcoal on orange      | 6.03  | Use for text on orange buttons and badges         |
| white on orange         | 2.87  | Fails; never use                                  |
| orange on white / cream | 2.87 / 2.68 | Fails; no orange text on light surfaces     |
| orange on charcoal      | 6.03  | Orange text and accents are fine on dark surfaces |
| slate on white / cream  | 4.83 / 4.51 | Passes for secondary text (cream is borderline) |
| charcoal on cream       | 16.17 | Primary text                                      |

`favicon.svg` uses a charcoal shape, which has low contrast on dark browser tabs.
