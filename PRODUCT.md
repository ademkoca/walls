# Product

<!-- impeccable:product-schema 1 -->

`SPEC.md` is the authority for product behavior and domain rules; this file records the product
truth that design work needs and points there for detail. Where the two disagree, `SPEC.md` wins.

## Platform

web

## Users

**Primary: people in Serbia looking for a property to buy or rent.** They browse anonymously
(there are no buyer accounts), on phones as much as desktops. They search and filter listings,
compare prices in EUR or RSD, open a property and contact whoever advertises it. Most of the
time they need to know whether a listing is real, current and honestly described, and who is
behind it. Design decisions favour this visitor first.

Secondary audiences, in order:

- **Advertisers.** Private sellers, who register with email and list their own property, and
  approved professionals: real-estate agents, agencies and investors/developers (all the
  `REAL_ESTATE_AGENT` role, told apart by `sellerType`). They create listings, submit them for
  review, follow rejection feedback, manage their profile and answer inquiries. At the Novi
  Pazar launch most professional advertisers are agencies and investors.
- **Admins and Super Admins (the Walls team).** They review listings, revisions, professional
  applications and profile changes, feature listings, manage accounts and read analytics and
  the audit log, all in the dashboard.

## Product Purpose

Walls (walls.rs) is a real-estate listing platform for Serbia: one place to find a property to
buy or rent, advertise your own property yourself, or work with an approved agent, agency or
investor. It is a listing platform, not a transaction platform: no payments, contracts or
escrow, and Walls is not a party to any sale or rental. Success means searchers find listings
they can trust and reach the advertiser, and advertisers get reviewed listings in front of them
at no cost.

## Positioning

Walls is the portal where every listing has been reviewed. The Walls team checks every listing
before it goes live and again when important details change; agents, agencies and investors get
an account only after the team has seen proof of their business; exact addresses stay hidden
until the advertiser chooses to show them; and listing is free. Trust is the core claim, and
design should make that review visible and credible rather than decorative.

## Operating Context

- Two surfaces in one Next.js app (`apps/web`): the public site and the authenticated
  dashboard. The dashboard is desktop-first and tablet-compatible; the public site must work on
  mobile, tablet, desktop and large desktop.
- Serbian (Latin script) is the default language at unprefixed URLs; English lives under `/en`.
  Serbian copy is the reference and is often longer; dates use the genitive month ("15. oktobra
  2026."). The URL alone decides the language.
- The listing lifecycle (draft, pending review, published, rejected, sold/rented, archived),
  which edits of a published listing need review, and inquiry routing are defined in
  `SPEC.md` §6 and §20; the UI never offers an action invalid for the role and state.
- Prices are stored in their original currency and shown in EUR by default, with an
  approximate (≈) converted value at the National Bank of Serbia middle rate on request.
- Contact between visitor and advertiser happens by email; there is no in-app messaging.
- Launch market: Novi Pazar. Popular-search links also cover Beograd, Novi Sad, Niš and
  Kragujevac.

## Capabilities and Constraints

- MVP scope is fixed in `SPEC.md` §43–44. Out of scope: buyer accounts, favorites, saved
  searches, map-based search, messaging, payments, Google login, MFA, phone verification
  (planned first after launch, §45.1). Design must not imply any of these exist.
- Terminology: "advertiser" covers private sellers and professionals; professionals are called
  "partners" in navigation (`/partners`). The advertiser-type badge (private seller, agent,
  agency, investor) names the type only; there is no "approved" or "verified" label for
  professionals. A phone number shows "Verified" only when its status is verified, and at MVP
  none are, so numbers carry no label.
- Hidden addresses show an approximate area (a circle with no pin), never the exact point.
- A listing needs at least three images to be submitted; "price on request" listings have no
  amount.
- No user-facing strings in components: copy lives in `apps/web/messages/{sr,en}.json`.
- Branding is centralized (`packages/ui/src/brand/brand.ts`) so the product can be rebranded
  without rewriting components.

## Brand Commitments

- Name **Walls**, domain **walls.rs**. Never substitute another name.
- The approved logo (four wall panels folded into a `W`, alternating ink and green, above the `walls` wordmark,
  `REAL ESTATE` descriptor) in `packages/ui/brand/`; its generated variants are the only
  versions used.
- The visual identity is fixed by the owner in `SPEC.md` §33 (the "Tlocrt" floor-plan
  decision of 2026-10-26, replacing "Beton", which the owner found generic). Tagline: "Znate
  šta dobijate." Visual rules live there and in `packages/ui/brand/README.md`, not here.
- Voice: plain, direct and honest, addressing the reader as "you". Say what Walls does and
  what it does not ("Walls isn't part of the sale or rental"); describe only rules the platform
  actually enforces. No hype, no invented promises.

## Evidence on Hand

- Live platform totals (public listings, cities, active professionals) from `GET /public/home`,
  shown on the home and About pages; zero counts are hidden, small numbers are shown as they are.
- Demo data (`pnpm demo:seed`): 8 made-up accounts and 50 listings with Unsplash photos, for the
  preview site only. Never present it as real advertisers, listings or activity.
- None of the following exist, and nothing may be fabricated in their place: testimonials,
  reviews, customer or partner logos, press, transaction volumes, user counts beyond the live
  totals, or company details (the company is not registered at launch, so the site names no
  company, address, MB or PIB).
- Privacy policy and terms of use are drafts pending a lawyer's review.

## Product Principles

1. **Searchers first.** When a decision trades the visitor's clarity against an advertiser's or
   admin's convenience, the visitor wins on the public site.
2. **Show the review, don't claim it.** Trust comes from visible, specific facts (reviewed
   listings, advertiser type, approximate area, listed versus converted price), never from
   badges or claims the platform does not back.
3. **Never overstate.** No unverified label presented as verified, no fabricated proof, no
   feature implied that is out of scope.
4. **Operate surfaces serve the workflow.** The dashboard prioritizes scanability and efficient
   review over expression.
5. **Serbian is the reference.** Layouts must hold Serbian copy, its grammar and its length;
   English follows.

## Accessibility & Inclusion

WCAG 2.x AA: 4.5:1 for normal text, 3:1 for large text and graphics. Contrast pairs for the brand
palette are tabulated in `packages/ui/brand/README.md`; green carries white text (5.47:1) and is
never text on ink (3.3:1). Every public page works on phones without horizontal scrolling.
