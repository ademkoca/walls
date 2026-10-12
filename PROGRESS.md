# Walls — Progress and Decisions

Living handoff file. It records where the build stands, the product decisions the user
made beyond `SPEC.md`, technical choices, and gotchas. `SPEC.md` stays the authority for
product behavior; update this file at the end of every phase.

_Last updated: 2026-10-12, in the middle of Phase 4 review._

## Current status

| Phase | Scope                                                                       | State                                                                        |
| ----- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 0     | Monorepo scaffold, tooling, CI, brand config                                | Done, pushed                                                                 |
| 1     | Domain rules (`packages/shared`) and Zod schemas (`packages/validation`)    | Done, pushed                                                                 |
| 2     | Drizzle schema, migrations, DB integration tests                            | Done, pushed, CI green                                                       |
| 3     | API foundation, auth, sessions, email outbox, `admin:create`                | Done, pushed, CI green                                                       |
| Brand | Outlined logo variants, Open Graph image, Montserrat                        | Done, pushed (`7324d35`)                                                     |
| **4** | Design system, i18n shell, public layout, auth pages, dashboard shell       | **Built and verified, NOT committed.** Waiting for the user's visual review. |
| 5–10  | Listings, review/admin, agents, public site, inquiries/analytics, hardening | Not started                                                                  |

**Immediate next step:** the user reviews Phase 4 in a browser (`pnpm dev`, then
http://localhost:3000). Then commit and push it, check that CI is green, and start Phase 5.
The Phase 4 working tree is large (~30 changed paths); commit as one `feat(web)` commit
(plus a docs commit if sensible). Optional offer made to the user: install Playwright to
screenshot pages at phone/tablet/desktop widths (needed anyway for Phase 10 E2E).

Verified at the end of Phase 4: format, lint, typecheck, build all pass; unit tests
133 shared + 29 validation + 20 web + 8 api; integration tests 22 database + 27 api.
A smoke test through the web `/api` proxy passed (register → verify → login → dashboard
in sr and en → logout). Nothing has been checked in a real browser yet.

## Repository

- GitHub: `https://github.com/ademkoca/walls`, branch `main`, personal account, **public**
  for now (user may go private later). Never commit secrets or sensitive business data.
- Commit history (oldest first): `39d6a92` docs, `2ae0fde` Phase 0, `47d23eb` spec decisions,
  `62a4a8f` Phase 1, `f2d7985` zod pin, `1195ba4` Phase 2, `048f058` Phase 3,
  `2dd3577` CI env fix, `7324d35` brand.
- Working agreement: **ask before committing/pushing**, commit in small logical commits with
  conventional-commit messages, run all checks first, report failures honestly. After each
  push the user checks GitHub Actions and reports the result (`gh` is not installed).
  Add the co-author trailer given by the harness reminder at the time of the commit.

## Stack and tooling

- pnpm **12.11.2** workspaces (pinned via `packageManager`) + Turborepo 2.11, Node 22.
  User installed pnpm globally with npm; Corepack ≤0.34 cannot run pnpm 12. Use `pnpm`
  directly. Shared versions live in the `catalog` in `pnpm-workspace.yaml`.
- TypeScript **6.0.3** (7.0 exists but typescript-eslint doesn't support it yet), ESLint 10
  (type-aware), Prettier (`SPEC/AGENTS/README/CLAUDE.md` and `packages/database/migrations/`
  are prettier-ignored), Vitest 5.
- Web: Next.js 16.4 (App Router, Turbopack), React 19.3, Tailwind 4, next-intl 4,
  React Hook Form + zod resolver, shadcn/ui 4.21 (**Base UI** primitives, preset `base-nova`,
  not Radix), sonner, lucide.
- API: Express 5, pino, helmet, express-rate-limit, cookie-parser, built with tsdown.
- DB: PostgreSQL + Drizzle ORM 0.45 (stable; 1.0 is still RC) + `postgres` driver + drizzle-kit.
- Zod **4.6.5** is pinned on purpose; pnpm's release-age policy must never be bypassed with
  `minimumReleaseAgeExclude` (rule recorded in `AGENTS.md`).
- `allowBuilds` in `pnpm-workspace.yaml` records install-script decisions
  (`esbuild`, `@parcel/watcher`, `@swc/core` all `false`).

## Local environment

- **No Docker.** Local Postgres 14 (Homebrew). Created role `walls`/`walls` and databases
  `walls` (dev) and `walls_test` (integration tests; wiped on every run). CI uses
  Postgres 17. `docker-compose.yml` exists for others.
- Root `.env` (gitignored) is read by both apps; contains a generated `SESSION_SECRET`.
  Without `RESEND_API_KEY`, emails are printed to the API console with their links.
- Commands: `pnpm dev`, `build`, `typecheck`, `lint`, `test`, `test:integration`,
  `format[:check]`, `db:migrate`, `db:generate`, `brand:generate`,
  `admin:create --email … --name "…" [--locale sr|en]`.
- Integration tests run with `--concurrency=1` (shared DB).

## Monorepo map

- `packages/shared`: enums, listing lifecycle state machine, access policies, published-edit
  planner, submission requirements, price/money conversion, image rules, public-location
  projection, inquiry routing, user-management rules, phone label, slugify, API contract types.
- `packages/validation`: strict Zod schemas (listing, price, auth, reasons).
- `packages/database`: schema (`src/schema`), migrations `0000`–`0003`, client, test helpers
  (`@walls/database/testing`).
- `packages/ui`: shadcn components, `brand/` SVGs, `src/brand/brand.ts` (single source of brand
  values), generated `src/styles/brand-tokens.css`, theme `src/styles/globals.css`.
- `apps/api`: `config`, `logger`, `http/` (errors, security, validation), `auth/`, `email/`
  (templates, outbox, EmailService), `audit/`, `scripts/create-super-admin.ts`, `test/`.
- `apps/web`: `src/app/[locale]/…` (public, auth, dashboard groups), `src/components`,
  `src/i18n`, `src/lib` (API client, session, helpers), `messages/{sr,en}.json`, `src/proxy.ts`.

## Product decisions made with the user (beyond the original spec; also recorded in SPEC.md)

- **Published listing edits:** price (amount/currency/period/negotiable/on-request),
  `isExactAddressPublic`, and media reorder/cover change apply immediately and are audited;
  everything else becomes a pending revision reviewed by an admin while the live version
  stays public. One open revision per listing.
- **Listing text:** per-locale; Serbian required, English optional with fallback to Serbian.
- **Locale:** Serbian **Latin** at unprefixed URLs, English under `/en`. URL alone decides the
  language: no browser-language redirect, no locale cookie. No Cyrillic.
- **Inquiries:** if an agent is assigned, only that agent receives/manages the inquiry; the
  listing creator keeps read-only access. Otherwise the creator handles it.
- **Agent application:** name, email, phone, optional agency name, ≥1 proof file (PDF/JPG/PNG).
  No registry number. Proof files are private (admins only).
- **Agent profile changes:** all public fields need admin approval; private-seller changes
  apply immediately (audited). Email changes need re-verification.
- **Required for submission:** property type, transaction type, Serbian title + description,
  country, city, street + number, map pin (lat/lng), ≥3 images; floor area (plot area for
  LAND); bedrooms + bathrooms for APARTMENT/HOUSE/VILLA; floor + total floors for APARTMENT.
- **Price is optional:** fixed price **or** "price on request", never both (UI switch). On-request
  listings sort last by price.
- **Exact address hidden by default;** sellers and agents may make it public after a UI warning
  and confirmation (UI part still to build).
- **Images:** JPEG/PNG/WebP/HEIC/HEIF, 50 KB–15 MB, ≥1024 px long side and ≥768 px short side,
  max 30 per listing, checked by file signature.
- **Drafts:** creator may soft-delete a draft; a PENDING_REVIEW listing cannot be withdrawn.
  REJECTED → DRAFT via "revise". SOLD only for sale, RENTED only for rent.
- **Deactivation:** Admins deactivate sellers and agents; Super Admins also deactivate Admins
  (my addition, user hasn't objected). Reason required, audit-logged, user emailed (service
  work still to do). Nobody deactivates themselves or Super Admins.
- **Branding:** logo colors are authoritative: orange `#FF6A00`, charcoal `#171B1E`
  (spec's `#FF7A00`/`#111827` replaced). **White text on orange fails contrast (2.87:1):
  always charcoal on orange;** no orange text on light surfaces. Typeface: **Montserrat** for
  all UI text. Logo variants (stacked/horizontal × default/inverse) are generated outlined
  SVGs; `REAL ESTATE` is centered under `WALLS` in the horizontal lockup. The original
  `walls-logo.svg` has live text and must not be used directly. OG image is generated.
- Public repo/personal GitHub; hosting plan unchanged (Netlify, Render, Supabase, Cloudinary, Resend).

## Technical decisions

- **Auth:** scrypt (OWASP params) instead of argon2; opaque session token in an HttpOnly,
  SameSite=Lax cookie (`__Host-` prefix in production), only an HMAC-SHA-256 of tokens stored
  (key `SESSION_SECRET`); 30-day sliding sessions; emailed tokens single-use (verify 24 h,
  reset 1 h, account setup 7 days). Password ≥10 chars. Passwords reset signs out everywhere.
  No account enumeration; re-registering a pending email cannot change its password.
  Login throttling per IP+email (5/15 min); 30 auth requests/15 min per IP (in-memory store,
  fine for one instance).
- **CSRF:** Origin check on state-changing requests + SameSite (no extra token, since all
  requests go through the web proxy).
- **Cookies are first-party:** the web app rewrites `/api/*` to the API (`API_INTERNAL_URL`).
- **Email:** `EmailService` abstraction (Resend / console / in-memory test), transactional
  outbox with retries; payloads cleared after sending. Email language = `users.preferred_locale`.
- **DB:** prices stored as integer minor units (`bigint`); CHECK constraints for price shape,
  rental period, one cover image, one pending application per email; trigger makes
  `listings.created_by_id` immutable; citext emails; amenity catalogue seeded in migration.
  Audit log table is generic (before/after JSON + reason).
- **API errors:** one shape `{ error: { code, message, details? } }`, codes shared in
  `@walls/shared` (`ApiErrorCode`); every code has a Serbian and English message.
- **Web:** public pages are statically pre-rendered per locale; the header loads the session
  in the browser; dashboard/auth pages are dynamic and check the session on the server.
  Email verification requires a button click (protects against link-scanning bots).
  Show/hide password toggle instead of a confirm field. No dark mode.
- **Bundling:** the API bundles `@walls/*` and `postgres` (`onlyBundle` enforces this).

## Gotchas learned the hard way

- **Turborepo strict env:** variables must be declared in `turbo.json` (`env`/`passThroughEnv`)
  and set in the CI workflow; the local `.env` hides missing declarations. Reproduce CI by
  moving `.env` aside and running `pnpm exec turbo run <task> --force` (restore `.env`!).
- **SQL CHECK constraints pass on NULL:** guard nullable comparisons (`IS NOT NULL`, `IS TRUE`).
- **drizzle-kit loads its config as CommonJS:** no `import.meta.dirname` in `drizzle.config.ts`.
  Regenerating migrations: custom SQL goes in `--custom` migrations.
- **Values exported from `'use client'` files are client references** in Server Components;
  keep shared constants in plain modules (`lib/routes.ts`).
- **next-intl:** use `Link/redirect/useRouter` from `@/i18n/navigation`; call
  `resolveLocale(params)` at the top of each page/layout; the file convention in Next 16 is
  `proxy.ts` (not `middleware.ts`).
- Prettier reformats files; re-read a file before string-replacing it in scripts.
- Tools generate `AGENTS.md` blocks (root: Turborepo; `apps/web/AGENTS.md`: Next.js) that are
  committed on purpose.
- pnpm may auto-add `minimumReleaseAgeExclude` during `pnpm add`; check `pnpm-workspace.yaml`
  afterwards and remove it.
- Bundled Next.js docs live in `node_modules/next/dist/docs` (version 16.4 differs from older
  knowledge: async `params`/`cookies()`, `proxy.ts`, Turbopack default, no `next lint`).

## Open questions and deferred decisions

- Should Admins/Super Admins edit listing content directly? Currently denied (decide before
  Phase 6).
- What happens to a deactivated user's published listings (hide, keep, reassign)? Can admins
  reactivate accounts? (Phase 6.)
- Which provider for EUR/RSD exchange rates, and API key? (Phase 8.)
- Heating types and furnished-status values for the listing form (spec doesn't define them;
  ask in Phase 5).
- When the exact address is hidden, no coordinates are public so no map is shown; should an
  approximate area map be allowed? (Phase 8.)
- Cloudinary and Resend credentials are needed from the user for Phase 5 / production.
- Production tile source for OpenStreetMap maps (public OSM tiles forbid heavy use).
- Still not done for Phase 3 email/deactivation: the deactivation service (reason, audit,
  email template) is specified but not implemented.

## Remaining plan (from the approved plan)

5. **Listings (creator side):** property/listing CRUD, MediaStorage + Cloudinary uploads,
   drag-and-drop ordering, submit with `checkSubmissionRequirements`, dashboard editor, UI warning
   when making the exact address public.
6. **Review and admin:** review queue, approve/reject, published-edit revisions (new tables),
   assignment, featured, archive/sold/rented, permanent delete, user management and
   deactivation (+ email), audit log views.
7. **Agents:** application flow + private proof storage, admin review, setup email, profile
   change requests (new table), public agent/seller profiles with phone-status labels.
8. **Public site:** home search/featured, search/filters/sort in the URL, detail page and map
   rules, exchange-rate provider and EUR/RSD toggle, SEO (sitemap, robots, hreflang, JSON-LD).
9. **Inquiries, notifications, analytics.**
10. **Hardening:** Playwright E2E for SPEC §38 flows, responsive pass, security review,
    deployment configs (Netlify/Render/Supabase; check pnpm 12 on build images).

Also: update this file, README, SPEC and `.env.example` as each phase lands.
