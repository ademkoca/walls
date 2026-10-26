---
name: Walls
description: Tlocrt — a floor plan on white paper: ink wall lines, one green for the action, mint for the selected room. "Znate šta dobijate."
colors:
  paper: '#FFFFFF'
  stone: '#E4E6E3'
  ink: '#15181C'
  green: '#17775F'
  mint: '#E3F1EC'
  graphite: '#5E636A'
  green-hover: 'color-mix(in oklab, #17775F, #15181C 22%)'
  muted-fill: 'color-mix(in oklab, #E4E6E3 45%, #FFFFFF)'
  hairline: 'color-mix(in oklab, #5E636A 28%, #FFFFFF)'
  ink-raised: 'color-mix(in oklab, #FFFFFF 8%, #15181C)'
  ink-quiet-text: 'color-mix(in oklab, #FFFFFF 72%, #15181C)'
  ink-seam: 'color-mix(in oklab, #FFFFFF 18%, #15181C)'
  error: 'oklch(0.52 0.2 27)'
typography:
  display:
    fontFamily: 'Hanken Grotesk, ui-sans-serif, system-ui, sans-serif'
    fontSize: '3.75rem'
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: '-0.03em'
  headline:
    fontFamily: 'Hanken Grotesk, ui-sans-serif, system-ui, sans-serif'
    fontSize: '2.25rem'
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: '-0.03em'
  tagline:
    fontFamily: 'Hanken Grotesk, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.5rem'
    fontWeight: 700
    lineHeight: 1.33
  title:
    fontFamily: 'Hanken Grotesk, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: 'Hanken Grotesk, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.43
  room-label:
    fontFamily: 'Hanken Grotesk, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: '0.12em'
  badge:
    fontFamily: 'Hanken Grotesk, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.68rem'
    fontWeight: 600
    lineHeight: 1
    letterSpacing: '0.05em'
  figures:
    fontFamily: 'Red Hat Mono, ui-monospace, Menlo, monospace'
    fontSize: '1.875rem'
    fontWeight: 500
    lineHeight: 1.2
    fontFeature: 'tnum'
  figures-meta:
    fontFamily: 'Red Hat Mono, ui-monospace, Menlo, monospace'
    fontSize: '0.75rem'
    fontWeight: 400
    lineHeight: 1.33
    fontFeature: 'tnum'
rounded:
  none: '0px'
spacing:
  wall-partition: '4px'
  wall-exterior: '8px'
  card-pad: '16px'
  room-pad: '24px'
  section-gap: '64px'
  container: '80rem'
components:
  button-primary:
    backgroundColor: '{colors.green}'
    textColor: '{colors.paper}'
    rounded: '{rounded.none}'
    padding: '0 10px'
    height: '32px'
  button-primary-hover:
    backgroundColor: '{colors.green-hover}'
    textColor: '{colors.paper}'
  button-primary-xl:
    backgroundColor: '{colors.green}'
    textColor: '{colors.paper}'
    rounded: '{rounded.none}'
    padding: '0 24px'
    height: '48px'
  button-outline:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.none}'
    padding: '0 10px'
    height: '32px'
  button-outline-hover:
    backgroundColor: '{colors.muted-fill}'
    textColor: '{colors.ink}'
  input:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.none}'
    padding: '4px 10px'
    height: '32px'
  badge-accent:
    backgroundColor: '{colors.mint}'
    textColor: '{colors.ink}'
    typography: '{typography.badge}'
    rounded: '{rounded.none}'
    padding: '2px 8px'
    height: '20px'
  badge-primary:
    backgroundColor: '{colors.green}'
    textColor: '{colors.paper}'
    typography: '{typography.badge}'
    rounded: '{rounded.none}'
    padding: '2px 8px'
    height: '20px'
  card:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.none}'
    padding: '{spacing.card-pad}'
  plan-room:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.none}'
    padding: '{spacing.room-pad}'
  plan-room-selected:
    backgroundColor: '{colors.mint}'
    textColor: '{colors.ink}'
  segmented-active:
    backgroundColor: '{colors.ink}'
    textColor: '{colors.paper}'
    rounded: '{rounded.none}'
    padding: '10px 20px'
  sidebar-item-active:
    backgroundColor: '{colors.green}'
    textColor: '{colors.paper}'
    rounded: '{rounded.none}'
    padding: '8px 12px'
---

# Design System: Walls

## Overview

**Creative North Star: "Tlocrt: the floor plan"**

Walls is drawn the way a Serbian buyer first reads a property: as a plan on white paper. Ink wall lines divide the page into rooms, square at every junction; a door swings open when you approach a room; a dimension line measures the platform in live figures. The tagline the plan carries is "Znate šta dobijate." (You know what you're getting.) The world is quiet and exact rather than glossy: paper, ink and one green, with measured figures set in a mono face as if written on a drawing.

Density follows the surface. The public site gives the plan room to breathe in a single 80rem column; listings are inventory and sit in plain 1px-walled cards beneath it. The dashboard keeps the same tokens with tighter controls and a paper sidebar behind a heavy ink wall. Everything is flat at rest: depth is said with wall weight and a mint floor, never with shadows, gradients or glass. Light theme only.

The plan is the system's signature, not decoration: rooms are links, the hallway is the search, and the green door marks the entrance. Wherever a surface is a room of the plan it is drawn with a thick ink wall; wherever it is an object in the room (a card, a field) the wall is 1px.

**Key Characteristics:**

- White paper ground, ink text and wall lines, square corners everywhere.
- One green per region: the primary action or the selected item, always with white text.
- Mint is a floor: the selected or hovered room, accent badges, text selection.
- Wall weights carry structure: 8px exterior, 4px partitions and section frames, 1px objects.
- Hanken Grotesk at 800 with tight tracking for headings; Red Hat Mono for every measured figure.
- No shadows on resting surfaces; no photos in the home page's plan.

## Colors

A drafting palette: white paper, near-black ink, a deep plan green and its pale mint floor, with stone and graphite as the quiet greys.

### Primary

- **Plan Green** (#17775F): the primary action (filled buttons, the hallway's "Pretraži"), the selected item (active dashboard section, the active main-nav underline, a selected room's label and door arc), the home headline "Znate šta dobijate." and the logo's two green panels. White text on it measures 5.47:1; green text on paper 5.47:1 and on mint 4.70:1.

### Secondary

- **Room Mint** (#E3F1EC): the floor of a selected or hovered room, hovered menu options and drop zones (the `accent` token), transaction badges on listing cards, and text selection. Ink on mint is 15.31:1. On ink surfaces mint becomes the mark and focus-ring color (15.31:1).

### Neutral

- **Paper** (#FFFFFF): page background, cards, popovers, the sidebar; text on green and on ink.
- **Drafting Ink** (#15181C): all primary text (17.81:1 on paper), wall lines, borders of cards, fields and outline buttons, the footer and dark banners (`surface-ink`), the pressed side of a segmented control.
- **Stone** (#E4E6E3): quiet fills; blended 45% into paper it is the muted fill behind ghost and outline hovers, table headers and image placeholders. Ink on stone is 14.18:1.
- **Graphite** (#5E636A): secondary text and dimension lines (6.05:1 on paper, 4.82:1 on stone); blended 28% into paper it is the hairline separator.
- **Error Red** (oklch(0.52 0.2 27)): error messages and destructive tints only (6.10:1 on paper); not a brand color.

### Named Rules

**The One Green Rule.** Each region has at most one green action. Green means "do this" or "this is chosen"; everything else is ink, paper or mint.

**The Green Is Never Text On Ink Rule.** Green on ink is 3.26:1: it may fill the logo's panels, nothing else. On ink surfaces text is paper and marks and focus rings are mint.

**The Line Marks Are Ink Rule.** Icons, selected tabs and other marks drawn as lines use the emphasis role: ink on paper, mint on ink. Green is reserved for actions and the selected item.

## Typography

**Display Font:** Hanken Grotesk at 800 (with ui-sans-serif, system-ui)
**Body Font:** Hanken Grotesk (with ui-sans-serif, system-ui)
**Label/Mono Font:** Red Hat Mono 400–600 (with ui-monospace, Menlo)

**Character:** One grotesk does everything with words, from tightly set 800-weight headings to plain UI text; the mono face is the drafter's hand, reserved for numbers that measure something.

### Hierarchy

- **Display** (800, 3rem on phones → 3.75rem → 4.5rem, 1.04, -0.03em): the home page h1 in the plan's living room, the tagline "Znate šta dobijate." in green, balanced, max ~36rem wide; the one place green is text at size.
- **Headline** (800, 2.25rem, 1.04, -0.03em): section headings (h2) on public pages. Every h1 and h2 gets 800 / -0.03em / 1.04 from the base styles.
- **Tagline** (700, 1.25rem → 1.5rem, ink, balanced, max 30ch): the review promise "Svaki oglas pregledamo pre nego što ga vidite." under the home h1, the reason behind the headline.
- **Title** (600, 1rem, 1.5): listing card titles and step titles; card titles in panels are 800 at 1.125rem.
- **Body** (400, 0.875rem–1rem, ~1.43–1.5): UI text; ledes 1rem–1.125rem in graphite, max 46ch.
- **Room label** (700, 0.75rem, 0.12em, uppercase): the property-type name of a room on the plan, as rooms are lettered on a drawing (0.68rem / 0.1em in small rooms).
- **Badge** (600, 0.68rem, 0.05em, uppercase): transaction and advertiser-type badges.
- **Figures** (Red Hat Mono 500, 1.875rem, tabular): room counts; prices at 1.125rem 600; the dimension line and counters at 0.75rem 400.

### Named Rules

**The Measured Figure Rule.** Prices, areas, counts and statistics are set in Red Hat Mono with tabular numerals; words never are.

**The One Grotesk Rule.** Headings are Hanken Grotesk at its heaviest, not a second display face; there is no condensed or serif type in the system.

## Layout

The page is a single centered column, max 80rem, with 16px / 24px / 32px side padding at phone / sm (640px) / lg (1024px). Public sections stack with 64px between them; section headings sit 24px above their content. The header is a sticky 64px paper bar with a 1px ink bottom wall; navigation collapses into a sheet below md (768px).

The home page's first screen is the floor plan: a dimension line spanning the top wall, then a grid whose 4px gaps let the ink background show through as partitions, inside an 8px exterior wall (4px on phones). From lg the living room (1.15fr) sits left of a 2×2 block of rooms, five small rooms run the full width below, and the hallway search runs along the bottom wall; on phones the order is living room, hallway, rooms, small rooms. Rooms are at least 160px tall (176px from lg) with 20–24px padding.

Listing grids are 1 / 2 / 3 columns (base / sm / lg) with 24px gaps. The dashboard is desktop-first: a 256px paper sidebar behind a 4px ink right wall from lg (a top bar with a 4px bottom wall below lg), a 64px top header, and 32px content padding.

## Elevation & Depth

The system is flat. Resting surfaces carry no shadow; depth and grouping are expressed with wall weight (8px, 4px, 1px ink) and with the mint floor that marks a selected or hovered room. Shadows appear only on floating overlays that sit above the page: menus and select popups, sheets, and the image being dragged in the listing editor.

### Shadow Vocabulary

- **Overlay menu** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`): select and dropdown popups.
- **Overlay sheet / drag** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): side sheets, nested menus, an image being dragged.

### Named Rules

**The Walls Not Shadows Rule.** A resting surface is separated by an ink wall, never a shadow. If something needs more presence, thicken its wall or give it a floor.

## Shapes

Every corner is square (radius 0), like wall junctions on a plan; component radius classes all resolve to 0. Containers are drawn as walls: 8px for the plan's exterior, 4px for partitions and for section frames that are rooms of the page (the agent and advertise banners, the dashboard sidebar wall), 2px for small numbered markers, 1px for cards, fields, outline buttons, segmented controls and the header's bottom wall. A hairline (graphite 28% into paper) separates rows where a wall would be too loud.

Doors are the recurring geometry: an opening cut into a wall, a 2.5px leaf and a 1.5px quarter-circle swing arc. The logo is the one exception: four wall panels folded like a folding screen into a W, alternating ink and green. The home plan carries the door instead, a green front door in its bottom wall.

## Components

### Buttons

Plain, square and decisive.

- **Shape:** square corners (0px), 1px border slot.
- **Primary:** green fill, white 600-weight text, 32px tall with 10px side padding; call-to-action size 48px tall, 24px padding, 1rem text.
- **Hover / Focus:** primary darkens toward ink by 22%; focus shows a 3px green ring at 50%; pressed buttons drop 1px.
- **Outline:** paper with a 1px ink wall and ink text; hover fills with the muted stone fill. Used for secondary actions and header registration.
- **Ghost / Link:** ghost has no wall and fills on hover; link is ink text underlined with a 4px offset, thickening to 2px on hover.

### Chips

- **Style:** badges are 20px tall, square, 0.68rem uppercase 600 text. Transaction badges on listing cards are mint with ink text; green badges with white text are reserved for counts and selected states; outline badges are 1px ink.
- **State:** badges are labels, not filters; filters use selects and toggles.

### Cards / Containers

- **Corner Style:** square (0px).
- **Background:** paper.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px ink wall on cards and listing cards; 4px ink frame on page-level banners.
- **Internal Padding:** 16px (12px small cards); banners 24px → 40px.

Listing cards: a 4:3 cover image on a muted fill, mint transaction badge top-left and advertiser badge top-right, then title (600, underlined on hover), graphite place line with a pin icon, a graphite fact line joined by " · ", and the price in Red Hat Mono.

### Inputs / Fields

- **Style:** 1px ink wall, paper fill, square corners, 32px tall (48px in the hallway search), graphite placeholder.
- **Focus:** the wall turns green with a 3px green ring at 50%.
- **Error / Disabled:** error turns the wall red with a red ring at 20%; disabled fades to 50% opacity.

### Navigation

- **Header:** sticky 64px paper bar, 1px ink bottom wall, the horizontal plan-W logo left. Nav links are 0.875rem 500 graphite, ink on hover with a muted fill; the current section is ink with a 3px green underline drawn inside the link.
- **Footer:** an ink surface (`surface-ink`): paper text, quiet links in paper at 72%, the inverse logo, and a seam line above the legal row.
- **Dashboard sidebar:** paper behind a 4px ink wall; items are 0.875rem 500 with 16px icons, mint floor on hover, green fill with white text for the current section; waiting counts are small green mono tags.
- **Segmented control (buy / rent):** a 1px ink frame; the pressed option is filled ink with paper text, the other graphite with a mint hover.

### Floor Plan (signature)

The home page's first screen and the system's signature. Rooms are links into search by property type, each with an uppercase room label and its live count in Red Hat Mono set where a room's area would be. Hovering or focusing a room fills its floor mint (150ms ease-out) while its door leaf swings in from the wall and its arc draws in green (220ms ease-out); the room chosen in the hallway search keeps the mint floor, a green label and a green arc. The dimension line above the top wall carries the live platform totals as measurements in graphite mono. Reduced motion removes the swing and draw.

## Do's and Don'ts

### Do:

- **Do** keep every corner square (0px) and separate surfaces with ink walls: 8px exterior, 4px partitions and page-level frames, 1px cards and fields.
- **Do** use green (#17775F) only for the region's primary action and the selected item, always with white text.
- **Do** use mint (#E3F1EC) as a floor behind ink text: selected or hovered rooms, hovered options, transaction badges.
- **Do** set prices, areas, counts and statistics in Red Hat Mono with tabular numerals.
- **Do** set h1 and h2 in Hanken Grotesk 800 with -0.03em tracking and 1.04 line height.
- **Do** switch to `surface-ink` for dark regions, so text becomes paper and marks and focus rings become mint.
- **Do** draw icons and selected-tab marks in the emphasis role (ink on paper, mint on ink).

### Don't:

- **Don't** put a second green action in the same region; demote it to outline or link.
- **Don't** set green text or thin green lines on ink (3.26:1); only the logo's panels are green on ink.
- **Don't** give resting surfaces shadows, gradients or glass; shadows belong to floating overlays only.
- **Don't** round corners, including on badges, inputs and images.
- **Don't** introduce a dark theme; Walls is light only.
- **Don't** add a second display face (condensed, serif) beside Hanken Grotesk.
- **Don't** put photos inside the home page's floor plan; listing photos live in listing cards.
