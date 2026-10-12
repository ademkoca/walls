# Walls — Progress and Decisions

Living handoff file. It records where the build stands, the product decisions the user
made beyond `SPEC.md`, technical choices, and gotchas. `SPEC.md` stays the authority for
product behavior; update this file at the end of every phase.

_Last updated: 2026-10-12, Phase 7 built and waiting for the user's review._

## Current status

| Phase | Scope                                                                                 | State                                                                 |
| ----- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 0     | Monorepo scaffold, tooling, CI, brand config                                          | Done, pushed                                                          |
| 1     | Domain rules (`packages/shared`) and Zod schemas (`packages/validation`)              | Done, pushed                                                          |
| 2     | Drizzle schema, migrations, DB integration tests                                      | Done, pushed, CI green                                                |
| 3     | API foundation, auth, sessions, email outbox, `admin:create`                          | Done, pushed, CI green                                                |
| Brand | Outlined logo variants, Open Graph image, Montserrat                                  | Done, pushed (`7324d35`)                                              |
| 4     | Design system, i18n shell, public layout, auth pages, dashboard shell, Playwright E2E | Done, pushed (`d8be2d8`, CI lint fix `e442d6e`)                       |
| 5     | Listings (creator side)                                                               | Done, pushed (`56a6446`), CI green                                    |
| 6     | Review and admin: review queue, revisions, assignment, featuring, users, audit log    | Done, pushed (`083a6f7`), CI green                                    |
| **7** | Agents: applications, profiles and change requests, public agent/seller pages         | **Built and verified, NOT committed.** Waiting for the user's review. |
| 8–10  | Public site, inquiries/analytics, hardening                                           | Not started                                                           |

**Immediate next step:** the user reviews Phase 7 (apply at `/en/for-agents`, approve as a
Super Admin, set up the agent from the emailed link, edit profiles, look at `/agents`). Then
commit and push, check CI, and wait for the go-ahead for Phase 8.

Phase 7 contents:

- **Agent applications** (`apps/api/src/agents/*`): public multipart `POST /agent-applications`
  (fields + 1–5 proof files, PDF/JPG/PNG ≤ 10 MB, type from the file signature, UTF-8 file
  names), rate-limited per IP. Same 202 answer whether or not the email is registered; a
  registered email or a second pending application gets an explanatory email instead.
  Files go to `PrivateFileStorage` (Cloudinary `authenticated` raw files / local
  `.private-files`), served only to Admins via `GET /agent-applications/:id/files/:fileId`
  (no-store, sandbox CSP). Approve creates a `PENDING_SETUP` agent (phone, agency from the
  application) via `AuthService.inviteInTransaction` with the `AGENT_APPLICATION_APPROVED`
  setup email; reject needs a reason, which is emailed.
- **Own profile** (`apps/api/src/profiles/*`, `GET/PUT /me/profile`, avatar upload/remove,
  `DELETE /me/profile/change-request`): sellers' changes apply immediately (audited
  `USER_PROFILE_UPDATED`); agents' changes go to the single pending `profile_change_requests`
  row (complete proposed version; edits update it; equal-to-live withdraws it). A changed
  phone is set `UNVERIFIED`. Replaced/rejected pictures are deleted from storage.
- **Email change** (`/me/email-change`, `POST /auth/confirm-email-change`): current password,
  link to the new address (24 h), old address notified on change. Agents' verified new
  address joins their change request and changes on approval.
- **Admin review** of profile changes (`/profile-changes`), live vs proposed table.
- **Public profiles** (`/public/agents`, `/public/agents/:slug`, `/public/sellers/:slug`):
  active users only; agent pages list created + assigned public listings; phone always with
  its verification label; email only if public. Web pages `/agents`, `/agents/[slug]`,
  `/sellers/[slug]` (rendered per request, no data cache), first `ListingCard` (links to
  `/properties/[slug]`, which Phase 8 builds).
- **Web:** `/for-agents` application form, `/confirm-email`, dashboard `My profile`,
  `Agent applications`, `Profile changes` (nav shows waiting counts from
  `GET /review-queue/counts`), audit entries for applications.

Verified at the end of Phase 7: format, lint, typecheck, build; unit tests (shared 175,
validation 45, web 43); integration tests 22 database + 124 api; 11 Playwright E2E tests.

Phase 6 contents:

- **Review workflow** (`apps/api/src/listings/listing-review.service.ts`): approve (assigns
  the permanent slug from Serbian title + city via `listingSlugBase`/`nextFreeSlug`, approves
  images, emails the creator), reject with reason (email), mark sold/rented, archive,
  feature with optional end date, assign/unassign active agents (history in
  `listing_assignments`), permanent delete (Super Admin, archived only; deletes files and an
  orphaned property; the audit entry keeps a summary).
- **Published edits / revisions** (SPEC §6): `ListingContent` in `@walls/shared`
  (`mergeListingContent`, `diffListingContent`, key-order-insensitive) + `planPublishedEdit`.
  Minor edits (price, address visibility, image order/cover) apply immediately and are
  audited; major edits upsert the single pending row in `listing_revisions` (JSONB `content`
  = full proposed version, validated by the shared schemas; `removed_media_ids`). Images
  added to a published listing are `listing_media` rows without `approved_at`. Approval
  writes the content (price only when the transaction type changes), approves added images,
  deletes removed ones; rejection deletes added images; leaving PUBLISHED discards a pending
  revision. Undoing every major change withdraws the revision.
- **Users** (`apps/api/src/users/*`): list/search, detail, deactivate/reactivate with reason
  (sessions revoked, email, audit; `statusAfterReactivation`), Super Admin invites Admins;
  `GET /audit-log` (paged). `isListingPubliclyVisible` (shared) hides a deactivated
  creator's listings; the public site (Phase 8) must use it.
- **Web:** role-based dashboard nav; reviewer listing queue with tabs (in review, edits to
  review, published, all); review panel (approve/reject, status, featuring, agent picker,
  typed-word confirmation for permanent delete, live/proposed toggle); published-listing
  editing with revision notices and image badges; users list/detail with invite and
  (de)activation; audit log page.

Verified at the end of Phase 6: format, lint, typecheck, build; unit tests (shared 160, web
42); integration tests 22 database + 92 api; 9 Playwright E2E tests (new: reject → resubmit
→ approve → published edit → approve changes; deactivation blocks login; E2E creates the
Super Admin with the real `admin:create` script).

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
- `e2e`: Playwright tests (`@walls/e2e`; `pnpm test:e2e`). `playwright.config.ts` builds and
  starts the API (port 4100, `NODE_ENV=test`, database `TEST_DATABASE_URL`) and the web app
  (port 3100, production build) itself, never reusing dev servers. Emailed links are read
  from the API log file (`support/api-log.ts`); `support/fixtures.ts` fails any test on an
  uncaught browser exception. First run needs `pnpm --filter @walls/e2e browsers`.
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
  and confirmation (built in Phase 5).
- **Heating and furnished status** (Phase 5) are structured optional fields, not amenities:
  heating `DISTRICT` (CG), `INDIVIDUAL_CENTRAL` (etažno, EG), `ELECTRIC`, `GAS`,
  `STORAGE_HEATERS` (TA), `UNDERFLOOR`, `HEAT_PUMP`, `SOLID_FUEL`, `OTHER`, `NONE`; furnished
  `FURNISHED`/`SEMI_FURNISHED`/`UNFURNISHED`. The `CENTRAL_HEATING` and `FURNISHED` amenities
  were removed (migration 0005). The user approved the structured option; I corrected my own
  offer afterwards (I had mislabelled EG as electric) by adding `INDIVIDUAL_CENTRAL`.
- **Features per property type** (Phase 5 review): `AMENITIES_BY_PROPERTY_TYPE` in
  `@walls/shared` (table in SPEC §10), enforced by the API; features that stop applying are
  dropped when the type changes. Land gets new utility features (electricity, water, sewage,
  gas connection, road access, building permit; migration 0006); House/Villa also get sewage
  and gas connection; "Other" gets everything. The `/amenities` endpoint was removed: the web
  reads the catalogue from `@walls/shared`, and a DB test checks the seeded table matches.
- **"Use my location"** button on the listing map (Phase 5 review): browser geolocation, asked
  only on click; denied/unavailable states explained. Default view stays Belgrade.
- **Phase 6 decisions:** a deactivated user's listings are hidden from the public site
  until reactivation (status unchanged); whoever may deactivate may also reactivate (reason,
  audit, email); a pending revision stays editable until reviewed; Admins never edit listing
  content (approve/reject only).
- **Phase 7 decisions:** an agent application from an email that already has an account is
  refused (agents need their own address; accounts never change role), told by email so the
  form never reveals registered addresses; agents' phones are always public, sellers choose,
  email only on opt-in; one pending profile change request, editable until reviewed; Admins
  are not emailed about new applications (dashboard counts instead); the application
  rejection reason is emailed; agent pages list created + assigned listings. Proof files
  are kept after review as evidence of eligibility and shown on the agent's account page
  (user's request during review).
- **Media storage:** Cloudinary when `CLOUDINARY_*` is set (required in production), otherwise
  local disk in development (user's choice until they add credentials).
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
- **Base UI group labels need a group:** `DropdownMenuLabel` (and similar `*Label` parts)
  throws "MenuGroupContext is missing" when opened outside `DropdownMenuGroup`. The error
  only appears when the menu opens, so it slips past typecheck, lint and build. This crashed
  the account menu in Phase 4 review; fixed in `user-menu.tsx`.
- **ESLint needs Next's generated route types.** `PageProps`/`LayoutProps` are globals from
  `next typegen` (`apps/web/.next/types`, gitignored). CI lints a fresh checkout, so the root
  `lint` script runs `pnpm --filter @walls/web typegen` first (needs `API_INTERNAL_URL`, which CI
  and `.env` provide). Local runs hid this because the files already existed: before pushing,
  reproduce CI in a clean worktree (`git worktree add <dir> HEAD`, no `.env`, CI's env vars).
- **Tailwind's default `dark:` variant follows the OS setting.** Walls is light-only, so
  `globals.css` ties `dark:` to a `.dark` class that nothing sets; otherwise shadcn
  components get gray fills and slate borders for users in dark mode.
- **`buttonVariants` merges classes** (tailwind-merge via `cn`). Plain `cva` output on a
  `Link` kept both `border-transparent` and `border-border`, and CSS order hid the border.
- **The email outbox sends in batches of 20**, oldest first. Test helpers must drain it
  (`lastEmailTo` loops until empty); otherwise a fresh CI database with a backlog makes
  email assertions flaky. Only the clean-worktree run caught this.
- **E2E must never use real providers:** the Playwright config loads the root `.env`, so it
  blanks `CLOUDINARY_*` (and `RESEND_API_KEY`) for the API it starts. One run before this fix
  uploaded 3 test images to the user's Cloudinary; they were deleted.
- **Playwright sets `NODE_ENV=test` for child processes**, which breaks `next build`
  ("Cannot read properties of null (reading 'useContext')"); the web server entry in
  `e2e/playwright.config.ts` forces `NODE_ENV=production`.
- **`admin:create` must only send its own email.** It used to run the whole outbox, so in
  parallel E2E runs it printed other users' verification emails to its own output and the
  tests never saw them. `processOutbox` now takes a `recipient` filter.
- **E2E starts from an empty database** (`db:reset-test`): integration tests leave hundreds
  of unsent emails in `walls_test`, which delayed E2E emails past their timeout.
- **One IP for every E2E browser:** the auth limit (30 per 15 min per IP) throttled the
  suite; `AUTH_RATE_LIMIT_PER_IP` is raised only in the E2E API environment.
- **`Intl` with locale `sr` writes month names in Cyrillic.** next-intl formats with the
  routing locale, so print month/day names with `intlLocale()` (`sr-Latn`).
- **multer decodes file names as Latin-1** unless `defParamCharset: 'utf8'` is set.
- **Public data must not be cached by `fetch`:** a prefetched `<Link>` cached an agent's old
  profile, so the approved version did not show. Public reads use `cache: 'no-store'` for now.
- Prettier reformats files; re-read a file before string-replacing it in scripts.
- Tools generate `AGENTS.md` blocks (root: Turborepo; `apps/web/AGENTS.md`: Next.js) that are
  committed on purpose.
- pnpm may auto-add `minimumReleaseAgeExclude` during `pnpm add`; check `pnpm-workspace.yaml`
  afterwards and remove it.
- Bundled Next.js docs live in `node_modules/next/dist/docs` (version 16.4 differs from older
  knowledge: async `params`/`cookies()`, `proxy.ts`, Turbopack default, no `next lint`).

## Open questions and deferred decisions

- Which provider for EUR/RSD exchange rates, and API key? (Phase 8.)
- When the exact address is hidden, no coordinates are public so no map is shown; should an
  approximate area map be allowed? (Phase 8.)
- Cloudinary and Resend credentials are needed from the user for production. The Cloudinary
  adapter (signed REST uploads, `f_auto,q_auto` delivery) is written but untested against the
  real service until credentials exist.
- Phase 5 choices the user has not objected to: the "listing submitted" email goes to the
  submitter as a confirmation; admins cannot create listings; the form fixes the country to
  Serbia.
- Phase 6 choices to confirm: Admins and Super Admins can both read the audit log; listing
  emails for approval/rejection go to the creator only (not an assigned agent); a deactivated
  _assigned agent_ does not hide the listing (only the creator's status does) — inquiry
  routing for that case is a Phase 9 question. Removing an image from a published listing
  can't be undone except by re-uploading.
- Super Admins are created only with `pnpm admin:create`; "delete administrators" (SPEC
  §2.1) is implemented as deactivation (soft, reversible).
- OSM standard tiles label Serbian places in Cyrillic; the production tile host should offer
  Latin labels (site is Latin-only).
- Cosmetic, deferred by the user until all phases are done: make the home-page CTAs larger.
- Phase 7 choices to confirm: profile pictures are
  JPEG/PNG/WebP/HEIC, ≥ 200 × 200 px, ≤ 10 MB; profile slugs never change when the name
  changes; changing the login email needs the current password; an approved agent's public
  page appears only once they have set their password. The Cloudinary private-file adapter
  (`authenticated` raw uploads + signed download) is untested against the real service.
- Parallel invitations with the same name can collide on the profile slug (unique
  violation → 500); rare, not fixed.
- Production tile source for OpenStreetMap maps (public OSM tiles forbid heavy use); set
  `NEXT_PUBLIC_MAP_TILE_URL`. "Find address on map" uses Nominatim on button press only.

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
10. **Hardening:** extend the Playwright E2E suite (started in Phase 4) to SPEC §38 flows, responsive pass, security review,
    deployment configs (Netlify/Render/Supabase; check pnpm 12 on build images).

Also: update this file, README, SPEC and `.env.example` as each phase lands.
