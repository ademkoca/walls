# Brand assets

Source files for the Walls brand. Brand values used in code (name, domain, colors, asset names)
live in [`../src/brand/brand.ts`](../src/brand/brand.ts); components and scripts read them from
there.

## Source artwork

These files are the source of truth. Do not edit them by hand; replace them with new exports.

| File             | Content                                                  |
| ---------------- | -------------------------------------------------------- |
| `walls-logo.svg` | Approved stacked artwork: mark, `walls`, `REAL ESTATE`    |
| `favicon.svg`    | Mark only, with wider gaps so it survives at 16 px       |

The "Folding screen" logo (owner's decision 2026-10-26, replacing the two-room floor plan that
briefly replaced the "Beton" house mark): four wall panels folded like a folding screen into a
`W`, alternating ink (`brand.colors.ink`) and green (`brand.colors.green`), above the wordmark in
ink. Keep those two colors equal to
`brand.colors`, which the generator relies on.

`walls-logo.svg` sets the wordmark in Hanken Grotesk 800 and the descriptor in Red Hat Mono 500
as live text, which renders in a fallback font wherever those are not installed. Never use it
directly; use the generated variants.

## Generated logo variants

`pnpm brand:generate` converts the text to vector outlines using the real fonts (from
`@fontsource/hanken-grotesk` and `@fontsource/red-hat-mono`), keeping the artwork's sizes,
weights, letter spacing and baselines, and writes these files (commit the output):

| File                                | Use                                       |
| ----------------------------------- | ----------------------------------------- |
| `walls-logo-stacked.svg`            | Stacked lockup on light surfaces          |
| `walls-logo-stacked-inverse.svg`    | Stacked lockup on dark surfaces           |
| `walls-logo-horizontal.svg`         | Mark beside the wordmark, e.g. the header |
| `walls-logo-horizontal-inverse.svg` | Horizontal lockup on dark surfaces        |

Inverse variants, for ink surfaces, draw the ink panels and the wordmark in paper and keep the
green panels (3.3:1 on ink, enough for a graphic). All variants are cropped to the artwork's edges, so
layouts add their own clear space. In the horizontal lockup the text block is vertically centred
on the mark and separated from it by a quarter of the mark's height; `REAL ESTATE` is centred
under `walls`.

## Generated rasters

The same command renders these:

| Output                                                           | Source                              | Use                                                                |
| ---------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| `apps/web/src/app/favicon.ico` (16/32/48)                        | `favicon.svg`                       | Legacy favicon                                                     |
| `apps/web/src/app/icon.svg`                                      | `favicon.svg`                       | Scalable favicon (copy of the mark)                                |
| `apps/web/src/app/apple-icon.png` (180)                          | `favicon.svg`                       | iOS home-screen icon, paper backdrop                               |
| `apps/web/public/icons/icon-{192,512}.png`                       | `favicon.svg`                       | Web app manifest icons, paper backdrop                             |
| `apps/web/src/app/opengraph-image.png` (1200×630) and `.alt.txt` | `walls-logo-stacked.svg`            | Default link preview image                                         |
| `apps/web/public/email/walls-logo.png` (338×96, shown at 169×48) | `walls-logo-horizontal-inverse.svg` | Email header logo, on an opaque ink background (`brand.emailLogo`) |

## Typography

`brand.typography`: Hanken Grotesk for UI text and for headings (weight 800, tight tracking),
Red Hat Mono for prices, areas, counts and other measured figures. The logo wordmark is Hanken
Grotesk 800 and the descriptor Red Hat Mono, both outlined in the logo files.

## Color usage

The "Tlocrt" palette (SPEC §33, 2026-10-26). Contrast checks (WCAG AA: 4.5:1 normal text, 3:1
large text and graphics):

| Pair                            | Ratio         | Rule                                                      |
| ------------------------------- | ------------- | --------------------------------------------------------- |
| ink on paper / stone            | 17.81 / 14.18 | Primary text                                              |
| paper on green                  | 5.47          | Text on green buttons and badges                          |
| green on paper / mint           | 5.47 / 4.70   | Links and the home headline; sparingly                    |
| graphite on paper / stone       | 6.05 / 4.82   | Secondary text, dimension lines                           |
| ink on mint                     | 15.31         | Text on a selected or hovered room's floor                |
| paper / mint on ink             | 17.81 / 15.31 | Text and marks on the footer and dark banners             |
| green on ink                    | 3.26          | The logo's panels only; never text on ink                 |
| error red on paper              | 6.10          | Error messages (`--destructive`, not a brand color)       |

On light surfaces, marks drawn as lines (icons, selected tabs) use the `emphasis` token, which is
ink there and mint on ink surfaces.
