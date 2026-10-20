# Walls — Progress and Decisions

Living handoff file. It records where the build stands, the product decisions the user
made beyond `SPEC.md`, technical choices, and gotchas. `SPEC.md` stays the authority for
product behavior; update this file at the end of every phase.

_Last updated: 2026-10-13. Phase 10 in progress: deployment is live at preview.walls.rs
(waiting for Netlify's HTTPS certificate). Last pushed commit `3b2726f`. Uncommitted, awaiting the
user's review: cream text on orange, larger home-page CTAs, hover/cursor fixes (see "UI polish")._

## Current status

| Phase  | Scope                                                                                 | State                                               |
| ------ | ------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 0      | Monorepo scaffold, tooling, CI, brand config                                          | Done, pushed                                        |
| 1      | Domain rules (`packages/shared`) and Zod schemas (`packages/validation`)              | Done, pushed                                        |
| 2      | Drizzle schema, migrations, DB integration tests                                      | Done, pushed, CI green                              |
| 3      | API foundation, auth, sessions, email outbox, `admin:create`                          | Done, pushed, CI green                              |
| Brand  | Outlined logo variants, Open Graph image, Montserrat                                  | Done, pushed (`7324d35`)                            |
| 4      | Design system, i18n shell, public layout, auth pages, dashboard shell, Playwright E2E | Done, pushed (`d8be2d8`, CI lint fix `e442d6e`)     |
| 5      | Listings (creator side)                                                               | Done, pushed (`56a6446`), CI green                  |
| 6      | Review and admin: review queue, revisions, assignment, featuring, users, audit log    | Done, pushed (`083a6f7`), CI green                  |
| 7      | Agents: applications, profiles and change requests, public agent/seller pages         | Done, pushed (`bd75757`); PROGRESS update `a6f0838` |
| 8      | Public site: home, search, listing page, EUR/RSD, SEO                                 | Done, pushed (`6732a82`), CI green                  |
| 9      | Inquiries, notifications, analytics                                                   | Done, pushed (`e53b0d8`)                            |
| **10** | Hardening and deployment                                                              | **In progress:** deployed to preview.walls.rs       |

**Immediate next step (2026-10-14):** the user is signed in to `https://preview.walls.rs` as the
production Super Admin (created with `pnpm admin:create` using their personal email; HTTPS works,
Resend delivers from walls.rs). The user sets `TRUST_PROXY_HOPS=3` on Render (decided below).
Then: smoke-test the live site (see "Phase 10 starting notes"), and continue the rest of
Phase 10. `/about` and `/contact` were built on 2026-10-16 (see "About, contact and legal
pages" below).

**VPS trial (user bought it 2026-10-19; 1-month netcup term, decide within ~2 weeks):** the web
app and API move from Netlify + Render to one **netcup VPS 500 G12.5** (Debian 13, 2 shared
vCores, 4 GB RAM, 64 GB SSD, `159.195.128.124`, IPv6 `2a03:4000:b:1913:b4e5:3dff:fe3c:c014`).
Database stays on Supabase Frankfurt; moving Postgres onto the VPS is decided later (needs
off-server backups). The user switches **preview.walls.rs directly** (no separate test host).
Everything is in `deploy/` (README there) plus `apps/{api,web}/Dockerfile`, `.dockerignore`
and `.github/workflows/deploy-vps.yml`:

- Server done 2026-10-19 (`setup-server.sh`, `harden-ssh.sh`): admin user `koad` (passwordless
  sudo, Docker), `deploy` user (Docker, GitHub Actions key with `restrict`), root and password
  SSH logins off, ufw (22, 80, 443 tcp+udp), 2 GB swap, Debian + Docker unattended upgrades with
  reboot at 03:00 UTC, Docker log cap. The user's Mac: `ssh walls-vps` (key `~/.ssh/walls_vps`,
  passphrase in Keychain). Root password changed by the user (netcup console only).
- Stack: Caddy on the **host network** (Docker's port publishing would replace IPv6 visitors'
  addresses with its own, sharing one rate limit), web and API on `127.0.0.1:3000/4000`; Caddy
  sends `/api/*` straight to the API (60 MB cap; Netlify's 4.5 MB limit is gone, so the
  browser-side shrinking can be relaxed later) and the rest to Next. `TRUST_PROXY_HOPS=1`.
- Verified on the server with the real Compose stack, a throwaway Postgres and dummy secrets:
  all pages over HTTPS (Serbian and English), HTTP→HTTPS, live NBS rate, HSTS, noindex, gzip,
  IPv6 clients; **a spoofed `X-Forwarded-For` is replaced by Caddy** (per-IP limit hit after 3
  requests with 5 different spoofed values) — this resolves the per-visitor IP launch blocker
  below once the switch is done. ~200 MB RAM in use.
- Next.js gotchas checked: the standalone server listens on `HOSTNAME`, which Docker sets to
  the container ID, so the image sets `HOSTNAME=0.0.0.0`. `output: 'standalone'` only when
  `NEXT_OUTPUT=standalone` (the web Dockerfile), so Netlify's build is unchanged. E2E only visits
  `/en/...` URLs; unprefixed Serbian URLs were checked by hand on the standalone build.
- Migrations: `dist/migrate.mjs` (tsdown entry `apps/api/src/migrate.ts`, which imports
  `@walls/database/apply-migrations`) reads `../migrations`, copied into the image.
- **Switched 2026-10-19:** first deploy `4fee4de` by the workflow (CI → Deploy (VPS), both
  green); user filled `/opt/walls/api.env` from Render (same `SESSION_SECRET`), GitHub
  environment `production` (secrets `VPS_HOST`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`) and repository
  variables `SITE_URL`, `SITE_INDEXING=off`. ACME email `demektech@gmail.com`. DNS: `preview` is
  now `A 159.195.128.124` + `AAAA 2a03:4000:b:1913:b4e5:3dff:fe3c:c014`, **DNS only (grey
  cloud)** at Cloudflare; proxied would hide visitors' addresses again. Let's Encrypt certificate
  obtained. Checked from the internet: all pages 200 in 0.3–0.5 s (Netlify + Render: 6.7 s and
  a 504 on the home page), the API logs the visitor's real address.
- **DNS is at Cloudflare, not unlimited.rs:** the user moved walls.rs's name servers to
  Cloudflare (`lochlan`/`meilani.ns.cloudflare.com`) for Cloudflare Email Routing, which needs
  Cloudflare as the DNS host; unlimited.rs is the registrar and its DNS records are unused.
- Render suspended by the user (not deleted; `/health` answers 503) and `keep-api-awake.yml`
  removed. Next: user smoke test in the browser (sign-in, a large photo upload, an inquiry email). If the trial is
  kept: SPEC §27, README "Deployment", privacy policy providers (Render/Netlify → netcup; sign
  netcup's data processing agreement), delete `render.yaml`, `netlify.toml`, the `x-nf-*`
  redaction, relax the browser-side photo shrinking, add uptime monitoring.

**Database backups (2026-10-20):** Supabase free has no restorable backups, so
`deploy/backup.sh` runs nightly at 02:00 UTC on the VPS (`walls-backup.timer`, installed by
`deploy/setup-backups.sh`): `pg_dump` of `public` (with the extensions installed there:
citext, pg_trgm, unaccent; a schema-limited dump leaves them out otherwise) and `drizzle`, age
encryption, stored **on the VPS** in `/opt/walls/backup/archive` (daily 30 days, monthly 12
months). **User's decision: no Cloudflare R2 for the MVP** (felt like overkill; the VPS is
already a different provider from Supabase, so a database loss is covered, not the loss of
both). The script switches to R2 (bucket in the EU jurisdiction) when `backup.env` gets R2
settings: revisit at launch. The stored file is read back, decrypted and restored into a
throwaway `postgres:17-alpine` container with the same `pg_restore --clean --if-exists
--no-owner --no-privileges` command as the documented emergency restore (the dump recreates
`public`, which every new database already has), and per-table row counts are compared
(missing or emptied table = failure). The restore test caught both problems above before the
first real run. healthchecks.io pings when `HEALTHCHECK_URL` is set (user to add). First run via
systemd 2026-10-20: 23 tables, 2116 rows, 139 KB. The age private key is on the server
(`/opt/walls/backup/age-key.txt`) and **must also be in the user's password manager**.

**`TRUST_PROXY_HOPS` analysis (2026-10-14, from real Render request logs):** a browser request
reaches Express with `x-forwarded-for: <visitor>, <Netlify edge>, <Netlify proxy egress, AWS
Ohio>, <Cloudflare edge>, <Render internal>` and socket address `::1` (Render's proxy); server-side
calls from the Next app (user agent `node`, e.g. `GET /auth/me` while rendering a page) carry
no visitor address at all: `<Netlify function>, <Cloudflare>, <Render internal>`. Netlify also sends
`x-nf-client-connection-ip` (the visitor). Value `5` would give the visitor's address, but
`walls-api.onrender.com` can be called directly, and a caller can then prepend their own
`X-Forwarded-For` entries, which `5` would trust: that would bypass the login brute-force limit
and the inquiry/auth limits. `3` (chosen for now) uses the address Cloudflare saw: not
spoofable, but every visitor coming through Netlify shares Netlify's proxy address, so per-IP
limits (auth 30/15 min, inquiries 5/h, views 600/h) are shared by all visitors: acceptable for the
preview, **not for launch**.

**LAUNCH BLOCKER (user agreed to revisit before launch): per-visitor client IP behind
Netlify.** Planned fix: the web app's `/api` proxy sends the visitor's address (from
`x-nf-client-connection-ip`) together with a shared secret header (`API_PROXY_SECRET`, an
environment variable on both Netlify and Render; the repo is public, so it can never be in
`netlify.toml`); the API trusts the forwarded visitor address only when the secret matches
(timing-safe compare), otherwise it uses the Cloudflare-seen address (`TRUST_PROXY_HOPS=3`).
Open points to check first: whether Netlify's `/api` rewrite (Next `rewrites`, or a Netlify edge
proxy?) can add a request header, e.g. in `proxy.ts` with `NextResponse.rewrite(url, { request:
{ headers } })` or an `app/api/[...path]` route handler (a Netlify function has a ~6 MB request
body limit, but listing images may be 15 MB: **test a 10+ MB image upload on the preview**, which
may need another route for uploads anyway); `req.ip` is read by `limitByIp`,
`limitLoginAttempts` and `ListingViewsService`, so override it in one middleware. Add tests
(secret present/absent/wrong, spoofed `X-Forwarded-For`) and verify on the live site with a
spoofed header.

**First smoke test on preview.walls.rs (2026-10-14, user):** register/verify/login and filling a
listing worked. Findings (all fixed locally, uncommitted until the user says so):

- **Uploads over ~4.5 MB failed with "Content too large".** Probed with throwaway POSTs to a
  nonexistent `/api` path: ≤ 4 MB reaches the API (404 from Express); ≥ 4.5 MB gets a plain-text
  `413` from Netlify itself (the `/api` rewrite runs in a Netlify function with a ~4.5 MB body
  limit), so the API's own 15 MB rule never applies. User chose (options: browser-side
  shrinking / Netlify proxy rule with signed requests / direct-to-API uploads): **shrink in the
  browser**. `apps/web/src/lib/shrink-image.ts`: files ≤ `MAX_UPLOAD_BYTES` (3.5 MB) are sent
  untouched; bigger ones are scaled to ≤ 3000 px (never below the API minimums; `fitWithin`) and
  saved as JPEG at 0.88 → 0.64 quality (then smaller sizes) until they fit; on a decode failure
  (e.g. HEIC outside Safari) the original is sent. Used for listing photos, profile pictures
  (1600 px) and image proof files (2400 px). Agent applications: the whole request must fit, so
  images get what is left after PDFs, a PDF over 3.5 MB is refused immediately, and a total over
  3.5 MB is refused with `filesTooLargeTogether` (hint text updated; scanned PDFs over 3.5 MB
  cannot be sent until uploads bypass the proxy). `apiFetch` maps a plain `413` to
  `PAYLOAD_TOO_LARGE`. Re-encoding as JPEG also strips EXIF/GPS from reduced photos. Tests:
  unit (`fitWithin`), E2E `listings.spec.ts` (12 MB photo: request < 4 MB, image added) and
  `agents.spec.ts` (large photo accepted, large PDF refused). The server limits (15 MB, 10 MB)
  are unchanged. If the planned signed Netlify proxy (launch blocker above) turns out to lift the
  limit, the shrinking can stay as a bandwidth saver or be relaxed.
- **Admins do not reply to inquiries (user's decision, 2026-10-14, privacy; uncommitted):**
  replying is only a `mailto:` link (no in-app messaging). `canReplyToInquiry` (shared) is true
  only for the recipient; `InquiryDetail.canReply` is computed by the API. On the inquiry page
  the "Reply by email" button and the mail/phone links show only when `canReply`; everyone else
  (Admins, and the creator with read-only access when an agent handles it) sees the email and
  phone as plain text plus a hint (`inquiries.replyHint`), and admins can still change the status.
  Chosen over hiding the visitor's email/phone from admins (that stays an option if the user wants
  admins unable to contact visitors at all). SPEC §20 updated; unit, API and E2E tests added.
- **Photo viewer (user's feedback, 2026-10-14, uncommitted):** thumbnails in the listing editor
  (seller) and in the read-only review view (admin) open the photo at full size in a dark dialog
  (`components/media/image-viewer.tsx`, built on the new shadcn `dialog.tsx`): previous/next
  buttons, arrow keys, Escape/close, "Photo n of m". Texts under `imageViewer` (sr/en). The
  grip handle still does the dragging, so clicking the photo is free. Not done: the public listing
  gallery has no full-screen view (easy follow-up with the same component), and tiles still load
  the full-size URL as their thumbnail (a smaller Cloudinary transformation would load faster).
  E2E in `listings.spec.ts` and `review.spec.ts`.
- **Inquiry emails and replies (answer given 2026-10-14):** the notification goes out from
  `no-reply@walls.rs` but carries `Reply-To: <visitor's email>` (`EmailMessage.replyTo` → Resend
  `reply_to`), so "Reply" in the recipient's mail program addresses the visitor directly and works
  with a send-only Resend account; nothing is delivered to walls.rs. Edge cases: a mistyped
  visitor address bounces to the recipient's mailbox. For the other emails (verification, password
  reset, …) there is no Reply-To: replying to `no-reply@walls.rs` goes nowhere because walls.rs has
  no MX records (add a real support mailbox/Reply-To when the contact page is done).
- **§38 E2E gaps closed (2026-10-14, uncommitted):** `agent-listings.spec.ts`: an approved agent
  submits a listing and cannot approve it (API 403), an admin reviews and publishes it, a second
  agent cannot see or open it (list, browser 404 page, API 403/404), then the admin assigns it in
  the UI (agent picker) and the second agent can open it while the creator keeps access. New
  helper `createActiveAgent(page, admin)` in `e2e/support/accounts.ts` (application and approval
  through the API, account setup through the emailed link).
- **Security review (2026-10-14, uncommitted):**
  - _Secrets:_ git history and tracked files scanned: no real secrets (only test fixtures); `.env`
    is untracked.
  - _Dependencies_ (`pnpm audit`): 2 advisories, both in development tools that never run in
    production: `braces` (stack exhaustion, no patched version yet; via the ESLint Next plugin and the
    shadcn CLI) and an old `esbuild` dev-server issue (via drizzle-kit). Accepted; re-run the audit
    before launch.
  - _Authorization inventory:_ every non-public API route sits behind `authenticated` / `requireAuth`;
    public routes are the read endpoints, inquiry + view reporting (IP-limited), the agent
    application (IP-limited) and the auth endpoints (IP-limited, login also per IP+email).
  - _Cookies:_ HttpOnly, SameSite=Lax, Secure and the `__Host-` prefix in production.
  - _CSRF/Origin, JSON limit (100 kb), paging caps, error bodies without internals, HTML-escaped
    email content:_ reviewed, fine.
  - _New: web security headers_ (`lib/security-headers.ts`, wired in `next.config.ts`): Content
    Security Policy (scripts/styles from this site plus inline ones that Next and the map/drag
    libraries need; images from this site, `res.cloudinary.com` and the map tile host derived from
    `NEXT_PUBLIC_MAP_TILE_URL`; connections only to this site and Nominatim; no frames, plugins or
    foreign form targets; `unsafe-eval` and websockets only in development),
    `Referrer-Policy: strict-origin-when-cross-origin` (the OSM tile policy needs the Referer),
    `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Permissions-Policy` (geolocation for this site
    only), `Cross-Origin-Opener-Policy`. HSTS is added by Netlify. Zod's eval probe is switched off in the
    browser (`lib/browser-zod-config.ts`, `BrowserSetup`; it was reported as a CSP violation). Every
    E2E test now fails on a CSP violation and `security-headers.spec.ts` visits the public,
    seller and admin pages (map, tiles, photo viewer). **After deploying, check a listing with
    Cloudinary photos, the editor and the map in the browser console for "Content Security Policy"
    messages** (Cloudinary photos are not covered by E2E).
  - _Logging:_ Netlify's `x-nf-geo` header (visitor city and coordinates) is now redacted
    (`logger.ts`, tested); client IP addresses stay in the request logs (needed for the proxy/IP
    work; mention in the privacy policy).
  - _Residual risks / later:_ `script-src` keeps `'unsafe-inline'` (a strict CSP needs per-request
    nonces, which make every page dynamic, or Next's experimental SRI); the public search
    endpoints have no per-IP limit (a limit would hit all visitors until the visitor-IP launch
    blocker is fixed); upload limit 150/15 min and the other per-IP limits are shared by everyone
    behind Netlify until then; the inquiry form lets anonymous visitors put free text (links) in a
    Walls-branded email to an advertiser (limited to 5/h per IP and 3 per email per listing).
- **Agent search button** (reviewer's agent picker) is disabled until the box has a letter or
  digit (`hasSearchableText`); an empty search used to list all agents.
- **Language tabs in the read-only listing form** (reviewer view) work now: only the fields are
  disabled (the tabs were inside the disabled `fieldset`). E2E in `review.spec.ts` covers both.

**Admin email addresses cannot be changed in the app** (`canEditOwnProfile` allows only roles
with a public profile: sellers and agents), which corrects what I first told the user. The user
chose to keep the personal-email Super Admin and, once a walls.rs mailbox exists, run `admin:create`
again for `admin@walls.rs` as a second Super Admin (Super Admin accounts cannot be deactivated in
the app). Letting admins change their email would be a product decision (not decided). walls.rs
has no mail (MX/SPF/DMARC) records yet: receiving mail needs a mailbox or forwarding service (options
discussed: ImprovMX/Forward Email, Cloudflare Email Routing (chosen later; DNS moved to Cloudflare), Google Workspace/Zoho); Resend's
records are on the `send.` subdomain, so there is no conflict.

**Deployment state (2026-10-13):**

- Web: Netlify site `superb-pithivier-4c81f6.netlify.app`, package directory `apps/web`,
  custom domain `preview.walls.rs` (CNAME + Netlify's `subdomain-owner-verification` TXT at
  the walls.rs DNS host, now Cloudflare; keep the TXT). Env: `API_INTERNAL_URL` (Render URL),
  `NEXT_PUBLIC_SITE_URL=https://preview.walls.rs`, `SITE_INDEXING=off`. Verified: pages
  render, `x-robots-tag: noindex, nofollow` is sent, `/api/v1/public/exchange-rate` through
  the proxy returns the NBS rate from Supabase (so migrations ran). It was first deployed for a
  short time before `SITE_INDEXING` existed (low risk, nothing linked to it).
- Database (moved 2026-10-19): Supabase project in **Frankfurt (`eu-central-1`)**, replacing
  the first project in Ireland (`eu-west-1`), which added ~25–35 ms per query from Frankfurt.
  Created with the same settings (Data API off, automatic RLS off: Walls connects as the
  table owner, so RLS would protect nothing and only make the schema differ from CI/local).
  Copied with a one-off script: `pnpm db:migrate` on the new project, `pg_dump --data-only
--schema=public` (pg_dump 17 from Homebrew `postgresql@17`, called by full path; the linked
  local tools are 14), load in one transaction with `session_replication_role = replica`
  after truncating (the migrations insert the amenities), then per-table row count + checksum
  and a schema diff: all 22 tables and the schema matched. Render's `DATABASE_URL` now points
  to the Frankfurt session pooler (deploy log: `aws-1-eu-central-1.pooler.supabase.com`).
  **Delete the Irish project around 2026-10-26** once nothing has gone wrong (the user keeps
  its URL commented out in `.env` until then; remove that line too). Supabase's free plan has
  no restorable backups, so there are none yet: decide on a backup job before launch.
- API: Render Blueprint `walls-api`, free plan, Frankfurt, `WEB_ORIGIN=https://preview.walls.rs`.
  The first build failed in `drizzle-kit migrate` with no message (fixed by
  `apply-migrations.ts`, `3b2726f`); a later deploy succeeded.
- walls.rs itself still serves the user's "coming soon" page from **GitHub Pages**; don't touch
  its DNS records until launch.
- walls.rs's SOA negative-cache time is 24 h: a resolver that looked a name up before it
  existed can keep answering "no such name" for hours (happened to the user's network with
  preview.walls.rs; public resolvers were fine).
- Launch (later): switch `WEB_ORIGIN` and `NEXT_PUBLIC_SITE_URL` to `https://walls.rs`, remove
  `SITE_INDEXING`, redeploy Netlify (build-time values), point walls.rs/www at Netlify, keep
  preview.walls.rs as a redirecting alias (README "Deployment").

Phase 10 commits so far: `146a3e3` deployment configs (render.yaml, apps/web/netlify.toml,
README "Deployment"), `827d7a0` integration test fix (agent directory paging), `076b572`
`SITE_INDEXING`, `3b2726f` migration script. Each was pushed after a clean-worktree CI run.

Phase 10 deployment decisions (user, 2026-10-13): Supabase project created (EU region, not
Frankfurt; moved to Frankfurt on 2026-10-19, see "Deployment state"); Resend domain walls.rs verified; Render **free** plan in **Frankfurt** (sleeps
after 15 min; no pre-deploy step on free, so `pnpm db:migrate` runs at the end of the
build); walls.rs on Netlify only, no `api.` subdomain (the web proxy calls the Render URL). The
site first goes live at **preview.walls.rs** (walls.rs keeps its "coming soon" page until the
user has tested): `WEB_ORIGIN` and `NEXT_PUBLIC_SITE_URL` point there until the switch.
`SITE_INDEXING=off` on Netlify (`lib/site-indexing.ts`) sends `X-Robots-Tag: noindex,
nofollow` on every response and drops the sitemap from robots.txt; any value other than on/off
fails the build. Remove it at launch.
Deployment facts checked: Render `rootDir` would hide `packages/` from the build, so the
service uses the repo root plus `buildFilter`; Node 22's bundled Corepack 0.34 cannot run pnpm
12, so the Render build installs the pinned pnpm with npm (worked on Render); `NODE_ENV=production`
would make pnpm skip devDependencies, hence `--prod=false`; Netlify's Next.js runtime needs
`PNPM_FLAGS=--shamefully-hoist`; Netlify installed pnpm 12 itself without problems; builds use
`pnpm --filter … build` rather than turbo (strict env mode would strip platform variables).
Render's build filter includes `apps/api/**`, so test-only API changes also redeploy (harmless;
could add ignored paths for tests after checking the Blueprint key). Netlify functions run in
US East (Ohio) on the free plan; region choice needs Netlify Pro.

**UI polish (user's requests, 2026-10-13, uncommitted):**

- Home-page calls to action are larger: new `Button` size `xl` (48 px) for "Oglasite
  nekretninu", "Za agente" and the search button; the hero search inputs match (`h-12`).
- **Cream text on every orange button/badge/avatar**: `--primary-foreground` and
  `--sidebar-primary-foreground` are cream (`packages/ui/src/styles/globals.css`); documented in
  `brand.ts`, `packages/ui/brand/README.md`, README and SPEC §33 as a knowing exception to WCAG AA.
- **Pointer cursor everywhere clickable:** Tailwind 4 gives `<button>` the default arrow, so a
  base-layer rule in `globals.css` sets `cursor: pointer` on buttons, `summary`, and the
  tab/combobox/menuitem/option/checkbox/radio/switch roles (and labels around them); menu and
  select items use `cursor-pointer` instead of `cursor-default`.
- **Hover audit:** a temporary Playwright script (not committed) hovered every link/button on 26
  pages (visitor, phone menu, seller and admin dashboards) and compared computed styles. It found
  88 buttons without a pointer and 150 elements without hover feedback; now 0 outside logo links
  (also fixed). Added: hover colour on always-underlined text links, logo/avatar opacity,
  underline on dashboard listing titles and audit "Details", `hover:bg-muted/60` on select
  triggers, hover border on unchecked checkboxes/radios, `hover:opacity-90` on switches. The
  audit is easy to recreate (collect `a, button, [role=…]`, `mouse.move`, diff computed
  colour/background/border/decoration/opacity/shadow/transform) when new UI lands.

**Cloudinary folders (2026-10-13, uncommitted):** both of the user's accounts use _dynamic
folder mode_, where a slash in the public ID does not create a Media Library folder (all
files appeared at the root). Uploads now also send `asset_folder` = the key without its file
name (`assetFolder()` in `cloudinary-client.ts`: `listings/<id>`, `agent-applications/<id>`,
`avatars/<id>`); public IDs and delivery URLs are unchanged, so existing assets keep working
(they stay at the root). Verified against the dev account: image and private PDF landed in the
right folder, delivery and signed download fine; unit test checks the signature includes the
folder. Only dynamic mode was tested (an old fixed-mode account would not need it). Dynamic
folders stay behind when emptied (a deleted listing leaves an empty `listings/<id>` folder);
the verification left an empty `zz-folder-check` folder in the dev account (delete by hand).

**Cloudinary (2026-10-13):** the user created a second Cloudinary account: the **new one is for
development** (root `.env`, cloud `dhetmw7g`; checked: image upload + public delivery and a
private PDF upload + signed download + deletes all work), the **previous one is production**
(Render env vars, unchanged). E2E still blanks `CLOUDINARY_*`. The local dev database still
references files in the production account (stored URLs contain the cloud name): 9 listing
images (folders `listings/37fd8823-…` and `listings/6ea11229-…`), 1 agent proof file
(`agent-applications/8e9a4cfb-…`, authenticated, no longer downloadable from dev) and 1 avatar
(`avatars/b83a5da8-…`). They still display, dev can no longer delete them, and they are dev test
data the user may delete from the production account's Media Library (or re-upload in dev).

**How the user reviews Phase 9:** the dev DB is migrated to `0013`. Send an inquiry from a
listing page (form in the sidebar; "Send an inquiry" button on phones), read it in the API
console (dev prints emails), sign in as the listing's seller: "Inquiries" in the dashboard
navigation shows the new count; open it, change its status. The listing's dashboard page shows
views and inquiries; an Admin's overview shows platform totals. Views are counted from the
browser once per visitor per day, never for the listing's own seller/agent or for Admins, so
view a listing signed out (or in a private window) to see the count change. Signed in as
another seller or an agent, the form sends under your account and the inquiry appears under
Inquiries → Sent; on your own listing the form is replaced by a note.

Phase 9 contents:

- **Inquiries API** (`apps/api/src/inquiries/*`): public `POST
/public/listings/:slug/inquiries` (anonymous; `inquiryInputSchema` incl. the `website` trap
  field; per-IP limit 5/hour via `limitByIp`; per email+listing 3/24 h in the service → 429
  `RATE_LIMITED`; trap filled → dropped, same 201). Recipient from
  `resolveInquiryRecipientId({ createdById, assignedAgent })` (deactivated agent → creator);
  `assignedAgentId` stores the listing's agent at the time. Email `INQUIRY_RECEIVED` to the
  recipient with `replyTo` = visitor (new `EmailMessage.replyTo`, Resend `reply_to`; email
  paragraphs keep line breaks). Dashboard: `GET /inquiries?status=&page=` (Admins: all;
  others: received + about listings they created, `canManage` false for read-only),
  `GET /inquiries/:id` (`canViewInquiry`), `PUT /inquiries/:id/status` (`canManageInquiry`,
  audited `INQUIRY_STATUS_CHANGED`, entity `INQUIRY`), `GET /inquiries/counts` (`{ new }`:
  inquiries the user manages; all new ones for Admins).
- **Views and analytics** (`apps/api/src/analytics/*`): public `POST
/public/listings/:slug/views` (204, per-IP limit 600/hour) → `ListingViewsService.record`:
  skips automated user agents (`isAutomatedClient`), the listing's creator/assigned agent and
  Admins (session cookie), then inserts `(listing, day, visitorHash)` into
  `listing_view_visitors` (`ON CONFLICT DO NOTHING`) and, if new, increments
  `listing_views_daily`. `visitorHash` = HMAC(HMAC(SESSION_SECRET, day), ip + UA); earlier
  days' rows are deleted once a day per process. `GET /analytics/listings/:id` (who may open
  the listing: `loadViewableListing`) → total views, inquiry count, 30 days of views;
  `GET /analytics/platform` (Admins) → listings by status, inquiries total/new, views
  total/30 days. Days are Serbian time (`analyticsDay`, `lastDays`, `fillDays` in
  `@walls/shared`).
- **Sent history (added after the user's first review):** `inquiries.sender_user_id`
  (migration `0013_inquiry_sender`) links inquiries sent by a signed-in private seller or
  agent (`keepsSentInquiries`); the API takes the account's name and email (form values
  ignored), refuses inquiries about your own listing (`isOwnListing`: creator or assigned
  agent → 403), and serves `GET /inquiries/sent` (`SentInquiry`: listing, recipient name,
  message, time; no status). Admins send like anonymous visitors. `InquiryDetail` has
  `fromRegisteredUser` (a "Walls account" badge for the recipient). Web: the form shows
  "Sending as …" and hides name/email for those users, a note instead of the form on your own
  listing (session slug vs advertiser/agent slug), and `/dashboard/inquiries/sent` ("Sent"
  tab, private sellers and agents only).
- **Database:** `0012_listing_view_visitors`, `0013_inquiry_sender`.
- **Web:** `InquiryForm` + `ViewReporter` on the listing page (form card first in the sidebar,
  `#inquiry` anchor button on narrow screens; recipient name = assigned agent, else
  advertiser); dashboard "Inquiries" nav item with new-count badge (`NavCounts` =
  review-queue counts + inquiry counts), `/dashboard/inquiries` (status tabs, read-only badge,
  pager) and `/dashboard/inquiries/[id]` (message, contact, reply by email, status buttons,
  read-only notice); overview page with the new-inquiry card and platform stats for Admins
  (`PlatformStats`); listing editor `insights` slot showing `ListingAnalyticsCard` (stats +
  `ViewsChart`, a CSS bar chart) for listings that were published. Audit table entity map
  (`ENTITIES`) includes inquiries. Removed `dashboard.comingSoon`.
- **Tests:** `inquiries.integration.test.ts` (routing incl. deactivated agent, read-only
  creator, strangers, trap field, both limits, validation, sold → 404, status changes +
  audit, admin counts), `analytics.integration.test.ts` (once per visitor per day, crawlers /
  owner / admin not counted, next day counts again and old fingerprints are deleted, access,
  platform totals); unit tests for routing, days, inquiry schema, bot detection and the
  fingerprint; E2E `inquiries.spec.ts` (visitor sends → seller badge → detail → contacted →
  listing stats 1 view / 1 inquiry → admin platform stats).

Verified at the end of Phase 9 incl. the sent history (also in a clean worktree with CI's
env, before pushing): format, lint, typecheck, build; unit tests (shared 187, validation 53, web 43,
api 14); integration 22 database + 155 api; 13 Playwright E2E tests. An intermittent E2E failure (an image
upload answering 422) was caused by parallel tests writing the same fixture photo files;
`listingPhotos()` now writes uniquely named files.

Phase 8 contents:

- **Exchange rates** (`apps/api/src/exchange-rates/*`): `ExchangeRateProvider` interface,
  `NbsExchangeRateProvider` (kurs.resenje.org `.../currencies/eur/rates/today`,
  `exchange_middle`, 10 s timeout, zod-checked), `FixedExchangeRateProvider` (dev offline,
  tests, E2E). `ExchangeRatesService.current()` reads the newest `exchange_rates` row;
  `refreshIfStale()` inserts a new row when the latest is older than 12 h;
  `startExchangeRateRefresher` runs at startup and hourly in `server.ts` (failures logged,
  stored rate kept). Config `EXCHANGE_RATE_PROVIDER` (`nbs` default, required in production)
  and `EXCHANGE_RATE_FIXED_EUR_RSD`; empty values count as unset (`config.test.ts`).
- **Public listing API** (`apps/api/src/public/*`, all under `/api/v1/public`):
  `GET /listings` (search, `listingSearchQuerySchema`, 24 per page, `total`), `GET
/listings/:slug` (detail), `GET /home` (≤ 8 unexpired featured + 8 latest), `GET
/exchange-rate` (or `null`), `GET /sitemap`. `listing-cards.ts` holds the shared visibility
  condition (`creator` alias + `publiclyVisible`) and `toCards`; `public-profile-view.ts`
  holds `toPublicProfile` (profiles and listing advertiser/agent cards use both).
- **Search SQL** (`public-listings.repository.ts`): keyword = prefix `to_tsquery` over
  `listing_texts.search_vector` (generated `to_tsvector('simple', walls_unaccent(title || ' '
|| description))`, GIN index); location = `walls_unaccent(...) ILIKE` on city/municipality/
  neighbourhood per comma-separated part (LIKE wildcards escaped); prices compared via
  `priceIn(currency, rate)` (CASE on the listing currency, rate passed as a parameter, null
  without a rate); area = `coalesce(floor_area, plot_area)`; amenities = one EXISTS per code;
  sort with `NULLS LAST`, then newest. Count is a separate query.
- **Shared:** `approximateArea()` + `PublicListingLocation.approximate` (grid snapping, 350 m
  cells, 250 m radius), `toDisplayPrice()` + `DEFAULT_DISPLAY_CURRENCY` (`pricing/display.ts`),
  `ListingSort`, `LISTING_SEARCH_PAGE_SIZE`, `ROOM_FILTER_OPTIONS`, `HOME_LISTINGS_LIMIT`,
  `api/public-listings.ts` types, `publicListingPath()`. Validation: `listing-search.ts`
  (`listingSearchQuerySchema` strict for the API, `parseListingSearch` lenient for page URLs,
  `listingSearchToQuery`, `hasListingFilters`).
- **Database:** `0010_search_unaccent` (custom: IMMUTABLE `walls_unaccent(text)` with
  `search_path = public, extensions, pg_catalog` for Supabase), `0011_listing_text_search`
  (generated column + GIN index).
- **Web:** home page (hero with `HomeSearch`: buy/rent, location, type → `/properties?...`;
  featured and latest sections; advertise/for-agents block), `/properties` (sidebar
  `SearchFilters`, `MobileFilters` sheet, `SortSelect`, count, pager "Page x of y", empty
  state, rate note), `/properties/[slug]` (gallery, key facts, description with "Serbian only"
  note on English pages, features, `ListingMap` with pin or circle, `AdvertiserCard` for the
  advertiser and an assigned agent, JSON-LD `RealEstateListing`), `CurrencySwitcher` in the
  header and mobile menu (cookie `walls_currency`, `router.refresh()`), `PriceTag` ("≈" +
  "Listed at …"), `ListingGrid`, `app/sitemap.ts` (force-dynamic, both locales with
  alternates), `app/robots.ts`, `lib/seo.ts` (`localizedAlternates`, `jsonLd`, `absoluteUrl`),
  `lib/currency.ts`, `lib/pricing.ts` (`getPricing()` reads the cookie + rate), canonical and
  hreflang on every public page, filtered searches `noindex, follow`.
- **Tests:** `public-listings.integration.test.ts` (search filters/sorts/currencies,
  visibility, detail hiding the address, revisions not leaking, sold → 404, home featured
  expiry, rate refresh, sitemap); unit tests for approximate area, display price, search
  schema, NBS provider, config; E2E `public-site.spec.ts` (home search → filters → listing →
  RSD → Serbian page keeps RSD → sitemap). E2E API uses the fixed rate 117.2.

Verified at the end of Phase 8 (also in a clean worktree with CI's env, before pushing): format, lint,
typecheck, build; unit tests (shared 181, validation 50, web 43, api 12); integration 22
database + 138 api; 12 Playwright E2E tests. Pages checked at 1280 px and 390 px: no
horizontal overflow, no browser errors.

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
- **Proof retention (user's review request):** an approved agent's account page
  (`/dashboard/users/[id]`) shows an "Agent application" card with the proof files
  (`UserDetail.agentApplication`, `ProofFileList` component) linking to the application.
- **Supporting changes:** `http/paging.ts` (`toPage`, `pageBounds`), `http/uploads.ts`
  (`singleImageUpload(maxBytes)`), `http/database-errors.ts` (`isUniqueViolation`),
  `media/cloudinary-client.ts` (shared signing), `rejectionInputSchema`, `slugParamSchema`,
  `publicProfilePath(role, slug)`, `lib/initials.ts`, `lib/intl-locale.ts`, `lib/api/public.ts`
  (server-only public reads), `AUTH_RATE_LIMIT_PER_IP` (default 30), `LOCAL_PRIVATE_FILES_DIR`,
  migration `0009_agent_profiles` (`profile_change_requests`, `users.avatar_url`,
  `agent_applications.locale`, `agent_application_files.position`).

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
  `2dd3577` CI env fix, `7324d35` brand, `d8be2d8` Phase 4, `e442d6e` CI lint fix,
  `56a6446` Phase 5, `083a6f7` Phase 6, `bd75757` Phase 7, `a6f0838` progress, `6732a82` Phase 8,
  `58824fe` progress, `e53b0d8` Phase 9, then the Phase 10 commits listed above.
- Working agreement: **commit and push only when the user asks** ("commit" alone means do
  not push). Work phase by phase; the user reviews each phase, then asks to commit/push,
  checks GitHub Actions and reports the result (`gh` is not installed), then says when to
  start the next phase. Ask before inventing product rules (AGENTS.md); offer recommended
  options with AskUserQuestion. Conventional-commit messages with the co-author trailer from
  the harness reminder.
- **Before every push, reproduce CI in a clean worktree**: commit, `git worktree add <scratch>
HEAD`, then with `env -i` and only CI's variables (`CI=true`, `TEST_DATABASE_URL`,
  `API_INTERNAL_URL`) run in order: `pnpm install --frozen-lockfile`, `format:check`, `lint`,
  `typecheck`, `test`, `test:integration`, `build`, `test:e2e`. Remove the worktree after.
  To check uncommitted work the same way, rsync `git ls-files -m -o --exclude-standard` into
  the worktree.

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
- `packages/database`: schema (`src/schema`), migrations `0000`–`0011`, client, test helpers
  (`@walls/database/testing`), `db:reset-test` (wipes a `*_test` database; used by E2E).
- `packages/ui`: shadcn components, `brand/` SVGs, `src/brand/brand.ts` (single source of brand
  values), generated `src/styles/brand-tokens.css`, theme `src/styles/globals.css`.
- `apps/api`: `config`, `logger`, `http/` (errors, security, validation, paging, uploads),
  `auth/`, `email/` (templates, outbox, EmailService), `audit/`, `media/` (MediaStorage,
  PrivateFileStorage, Cloudinary/local/in-memory), `listings/`, `users/`, `agents/`,
  `profiles/`, `public/` (unauthenticated reads under `/api/v1/public`: profiles, search,
  listing pages, home, sitemap), `exchange-rates/`, `review-queue/`,
  `scripts/create-super-admin.ts`, `test/` (one integration file per module).
- `e2e`: Playwright tests (`@walls/e2e`; `pnpm test:e2e`). `playwright.config.ts` builds and
  starts the API (port 4100, `NODE_ENV=test`, database `TEST_DATABASE_URL`) and the web app
  (port 3100, production build) itself, never reusing dev servers. Emailed links are read
  from the API log file (`support/api-log.ts`); `support/fixtures.ts` fails any test on an
  uncaught browser exception. First run needs `pnpm --filter @walls/e2e browsers`.
- `apps/web`: `src/app/[locale]/…` (public, auth, dashboard groups), `src/components`
  (`admin/`, `agents/`, `profiles/`, `public/` incl. `ListingCard`/`PriceTag`, `search/`,
  `listing/` (public listing page), `home/`, `listings/` (dashboard), `dashboard/`),
  `src/i18n`, `src/lib` (`api/` browser clients, `api/server.ts` cookie-forwarding reads,
  `api/public.ts` public reads), `messages/{sr,en}.json`, `src/proxy.ts`.

## Product decisions made with the user (beyond the original spec; also recorded in SPEC.md)

- **Published listing edits:** price (amount/currency/period/negotiable/on-request),
  `isExactAddressPublic`, and media reorder/cover change apply immediately and are audited;
  everything else becomes a pending revision reviewed by an admin while the live version
  stays public. One open revision per listing.
- **Listing text:** per-locale; Serbian required, English optional with fallback to Serbian.
- **Locale:** Serbian **Latin** at unprefixed URLs, English under `/en`. URL alone decides the
  language: no browser-language redirect, no locale cookie. No Cyrillic.
- **Currency (Phase 8):** NBS official middle rate via kurs.resenje.org (free, no key);
  prices shown in EUR by default, converted prices marked "≈" with the listed price beside
  them; the EUR/RSD choice is a preference cookie (language still only from the URL).
- **Inquiries (Phase 9):** trap field + per-IP (5/h) and per-email-per-listing (3/24 h)
  limits, no captcha; a deactivated assigned agent's inquiries go to the creator; replies to
  the notification email go to the visitor; no confirmation email to the visitor; status moves
  freely between new/contacted/closed (audited).
- **Sent inquiries (Phase 9):** signed-in private sellers and agents keep a "Sent" history
  (without the recipient's status); replies stay by email. A two-way inbox is deferred until
  after the MVP (SPEC §44).
- **Analytics (Phase 9):** a view counts once per visitor per day (daily-keyed anonymous
  fingerprint, from the browser, not crawlers, not the listing's own seller/agent or Admins);
  Admins see platform + all listings, sellers/agents see their own listings' numbers.
- **Hidden address map (Phase 8):** an approximate-area circle (~500 m across, no pin,
  never centred on the property).
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
  (my addition, user hasn't objected). Reason required, audit-logged, user emailed. Nobody
  deactivates themselves or Super Admins.
- **Branding:** logo colors are authoritative: orange `#C2410C`, charcoal `#171B1E`.
  **2026-10-15: the user changed the orange from `#FF6A00` to `#C2410C`** (after comparing it
  with a green `#236500` and a two-tone variant in screenshots), so text on orange passes AA:
  cream on orange 4.83:1 (the earlier knowingly-below-AA cream-on-`#FF6A00` exception is gone).
  `#FF6A00` stays as `orangeOnDark` for the inverse logos and dark-surface accents
  (`--sidebar-primary`, `--sidebar-ring`; 6.03:1 on charcoal); buttons keep `#C2410C`
  everywhere because cream on `#FF6A00` is 2.68:1. Email buttons now use cream text (charcoal
  on `#C2410C` is 3.35:1). Typeface: **Montserrat** for
  all UI text. Logo variants (stacked/horizontal × default/inverse) are generated outlined
  SVGs; `REAL ESTATE` is centered under `WALLS` in the horizontal lockup. The original
  `walls-logo.svg` has live text and must not be used directly. OG image is generated.
- Public repo/personal GitHub; hosting plan unchanged (Netlify, Render, Supabase, Cloudinary, Resend).
- **Home page hero (2026-10-15):** a full-width photo backdrop that cross-fades through four
  photos every 5 seconds (not user-controlled; interval and photos in
  `apps/web/src/components/home/hero-photos.ts`), with the title, subtitle and two CTAs over it:
  "Browse properties" (→ `/properties`, orange) and "List a property" (→ `/register`). The
  search form moved to a band directly below the hero; featured and latest listings follow, and
  the "Selling or renting out a property?" block stays at the bottom. Photos are free Unsplash
  Licence photos; the user chose all four from a shortlist (Zemun rooftops, a modern villa, a living
  room, the Sava riverside in winter; credits in the config), stored as 2400 px JPEGs in
  `apps/web/src/assets/hero`. The rotation stops for visitors with reduced motion and while the
  tab is hidden. With no pause control it may not meet WCAG 2.2.2 (Pause, Stop, Hide) if
  auditors treat a decorative backdrop as moving content; the user chose a rotation without
  controls.
- **Home page shortcuts (2026-10-15):** below the search band, "Browse by property type" tiles
  (one per property type, icon + label → `/properties?propertyType=…`); at the bottom, above the
  footer, "Popular searches": 32 preset search links in four columns (two on phones). "Prodaja"
  and "Izdavanje" list every property type except Other; "Stanovi" and "Kuće" list sale in
  Beograd, Novi Sad, Niš, Kragujevac and Novi Pazar and rent in the first three (cities chosen by
  the user). Type phrases are written out per language because Serbian case forms differ
  ("Stanovi na prodaju", "Izdavanje stanova"); city links use "Prodaja stanova {city}" to avoid
  the locative. The `location` in city links is always the Serbian name as listings store it, so
  English pages say "Belgrade" but search for `Beograd`. Considered and deferred: the "Stanje"
  condition filter (uknjiženo, legalizovano, novogradnja…: a new listing field with legal weight,
  needs its own spec decision), featured agencies (no real agencies yet) and a blog.
- **Furnished filter, home stats, agent banner (2026-10-15):** search has a "Nameštenost" filter
  (`furnishedStatus`, exact match, one value; listings without a status never match), shown when
  no type or a type with the field is chosen (apartment, house, villa, office; from
  `VISIBLE_ATTRIBUTES`); recorded in SPEC §17. `GET /public/home` returns `stats`: public
  listings, distinct cities of public listings (case- and accent-insensitive, trimmed) and active
  agents; the home page shows them under the search, leaving out any zero count and the whole
  row when all are zero. Small numbers are shown as they are; whether to hide them until launch
  traffic is the user's call. A dark "Agent ste za nekretnine?" banner after the featured
  listings links to `/for-agents`; the bottom block now addresses sellers only. The translation
  test no longer mistakes single-word plural branches (`one {grad}`) for arguments.
- **Home page: city tiles, "How it works", FAQ (2026-10-16):** a "Browse by city" tile row
  (same 5 cities as the popular searches, factored into `apps/web/src/components/home/cities.ts`
  so both reuse one list) sits under the property-type tiles. A 3-step "How it works" (list → we
  review → it goes live) sits before the seller call-to-action. An FAQ accordion (6 questions:
  free to list, agent vs. private seller, review process, editing a published listing, phone
  number visibility, EUR/RSD) sits above "Popular searches", with `FAQPage` JSON-LD for SEO
  (SPEC §32); content only restates existing rules (§4, §6, §12, §19), nothing new. Added the
  shadcn/Base UI `accordion` component. Caught in a real dev-server run (not just typecheck):
  the FAQ's "Is it free on {brand}?" string crashed next-intl because the component didn't pass
  `brand`, a reminder that an intl formatting error only surfaces at render, not at compile time.

- **About, contact and legal pages (2026-10-16, SPEC §16):** `/about` tells the story the user
  asked for (one place to find, sell or rent out property, directly or with an approved agent),
  three ways to use Walls, five trust points that restate SPEC rules, the live totals and a
  closing call to action. `/contact` has a form (user's choice over plain email links) that
  emails `info@walls.rs` (`brand.company.email`, also the address shown) with reply-to set to
  the visitor; no table, no confirmation email, trap field, 5 per IP per hour
  (`POST /api/v1/public/contact`, `CONTACT_MESSAGE` template, in Serbian with a note of which
  site the visitor wrote from). Company details live in `brand.company`; the registered name,
  street address, MB and PIB are `null` and read "U postupku registracije" until the company is
  registered (user's choice over realistic fake values); the location shown is "Beograd,
  Srbija". `/privacy` and `/terms` are drafts (user's choice), marked as such, linked from the
  footer's bottom bar and listed in the sitemap; they describe only what Walls actually does
  (data collected, providers, the two essential cookies, the Poverenik) and leave retention
  periods, cross-border safeguards and liability limits for the lawyer. Before launch:
  `info@walls.rs` must receive mail (Resend only sends), the company details and a reviewed
  legal text must replace the placeholders, and `LAST_UPDATED` in `legal-page.tsx` must be
  updated with every change. The unused "coming soon" component and texts were removed.

## Technical decisions

- **Auth:** scrypt (OWASP params) instead of argon2; opaque session token in an HttpOnly,
  SameSite=Lax cookie (`__Host-` prefix in production), only an HMAC-SHA-256 of tokens stored
  (key `SESSION_SECRET`); 30-day sliding sessions; emailed tokens single-use (verify 24 h,
  reset 1 h, account setup 7 days). Password ≥10 chars. Passwords reset signs out everywhere.
  No account enumeration; re-registering a pending email cannot change its password.
  Login throttling per IP+email (5/15 min); `AUTH_RATE_LIMIT_PER_IP` auth requests/15 min per
  IP (default 30; in-memory store, fine for one instance). Changing the login email needs the
  current password and a link to the new address.
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
- **Web:** pages that show prices (home, search, listing, profiles) render per request
  because they read the currency cookie; other public pages are statically pre-rendered per
  locale; the header loads the session
  in the browser; dashboard/auth pages are dynamic and check the session on the server.
  Email verification requires a button click (protects against link-scanning bots).
  Show/hide password toggle instead of a confirm field. No dark mode.
- **Bundling:** the API bundles `@walls/*` and `postgres` (`onlyBundle` enforces this).
- **Private files:** `PrivateFileStorage` (Cloudinary `authenticated` raw uploads read back via
  a 60 s signed download URL; local `.private-files` in dev). The API streams files to
  authorized users with `Cache-Control: private, no-store` and a sandbox CSP; they never get a
  public URL. Verified against the user's Cloudinary (upload + download) on 2026-10-12.
- **Public pages** (`/agents`, `/agents/[slug]`, `/sellers/[slug]`) render per request and
  read the API with `cache: 'no-store'` (`lib/api/public.ts`); 400/404 become a 404 page.
  Visibility rule mirrors `isListingPubliclyVisible` in SQL (`public.repository.ts`).
- **Exchange rates** are refreshed in the API process (no separate cron job): at startup
  and hourly when older than 12 h, so a sleeping free-tier instance refreshes on wake. One
  row per refresh in `exchange_rates`; pages never call the provider. Search converts with the
  rate as a SQL parameter.
- **Views are reported by the browser** (`ViewReporter`), not counted during server render:
  Next prefetches and re-renders (e.g. currency switch) would otherwise count. The API reads
  the session cookie to skip the owner and Admins.
- **Client IP matters for views and inquiry limits:** behind the web proxy every request comes
  from the Next server unless `TRUST_PROXY_HOPS` is right (production: Netlify + Render).
  In dev and E2E all visitors share one IP; tests tell visitors apart by user agent.
- **Approximate area** is grid snapping, not a random offset: the repo is public, so any
  offset derived from public data could be reversed, and random offsets can be averaged.
- **Search** uses Postgres full text with the "simple" configuration plus prefix matching
  (no Serbian stemmer exists) and an immutable unaccent wrapper. No trigram index yet; add
  one if location search gets slow.
- **Review queues** (applications, profile changes): `?status=PENDING|APPROVED|REJECTED` tabs,
  pending items oldest first, 50 per page.

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
- **Testing on a phone over Wi-Fi:** Next.js dev refuses its live-reload connection from
  unknown hosts, so the page renders but nothing is interactive (menu, gallery, map).
  `allowedDevOrigins` in `next.config.ts` allows `192.168.*.*`, `10.*.*.*` and `*.local`
  (add `172.16.*`-style ranges if needed). The API also only accepts `WEB_ORIGIN`
  (`http://localhost:3000`) on state-changing requests: for login from a phone set
  `WEB_ORIGIN=http://<lan-ip>:3000` in `.env`.
- **Base UI `SheetClose render={<Link/>}` logs a "native button" error**, and `nativeButton={false}`
  adds `role="button"` to the link; the mobile menu uses plain `Link`s that close a
  controlled sheet instead.
- **Safari/iPhone bugs only show in WebKit:** `pnpm exec playwright install webkit` and test
  with `devices['iPhone 15']`; a hostname mapped with Chromium's `--host-resolver-rules`
  reproduces the "unknown dev origin" failure.
- **New pages need `next typegen`** before `tsc` knows their `PageProps<'/…'>` route
  (the `typecheck` script runs it; a bare `tsc` does not).
- **Leaflet SVG colors:** `color: 'var(--primary)'` is not reliable in SVG attributes; style
  paths with a `className` (`fill-primary stroke-primary`) instead.
- **Postgres `numeric` comes back padded** ("117.3693000000"); the rate view trims it.
- **`unaccent()` is not IMMUTABLE**, so generated columns/indexes use `walls_unaccent`;
  Supabase keeps extensions in the `extensions` schema, hence its `search_path`.
- **E2E fixtures must not share file names:** tests run in parallel, so photos written to
  one fixed path were sometimes read half-written by another test (upload → 422, passing on
  retry). `listingPhotos()` writes new, uniquely named files on every call.
- **Paged lists in integration tests:** all test users of a role share one display name, so
  lists sorted by name fall back to random IDs, and other test files add rows to the same
  database. Never assume a row is on page 1 (the agent directory test failed in CI only); search
  every page, or sort so the new row comes first.
- **`drizzle-kit migrate` hides why it failed** (only "pnpm recursive run failed"; the first
  Render build failed this way). `pnpm db:migrate` runs `packages/database/src/apply-migrations.ts`
  (Drizzle's migrator) instead, which prints the Postgres error and its code but never the
  connection string. drizzle-kit is still used for `db:generate` and `db:studio`.
- Prettier reformats files; re-read a file before string-replacing it in scripts.
- Tools generate `AGENTS.md` blocks (root: Turborepo; `apps/web/AGENTS.md`: Next.js) that are
  committed on purpose.
- pnpm may auto-add `minimumReleaseAgeExclude` during `pnpm add`; check `pnpm-workspace.yaml`
  afterwards and remove it.
- Bundled Next.js docs live in `node_modules/next/dist/docs` (version 16.4 differs from older
  knowledge: async `params`/`cookies()`, `proxy.ts`, Turbopack default, no `next lint`).

## Open questions and deferred decisions

- Phase 9 choices to confirm: inquiry status changes are free in every direction; the
  inquiry list has new/contacted/closed tabs (no "all" tab); a listing's analytics card
  appears once it has been published; analytics show 30 days; the listing creator does not
  get an email when an inquiry goes to the assigned agent (SPEC §20: the agent only).
- Phase 8 choices to confirm: bedroom/bathroom filters mean "at least"; rental prices sort
  by amount whatever their period (day/week/month); price bounds keep the currency they were
  entered in (in the URL); the sitemap lists private sellers only when they have a public
  listing; filtered search pages are `noindex`; on phones the advertiser card comes after
  the map (the inquiry form in Phase 9 may change this layout).
- `/about` and `/contact` are still "coming soon" placeholders: their content is the user's
  to provide (they are in the sitemap already).
- Resend: the walls.rs sending domain is verified and the production key is set on Render.
  Cloudinary: separate accounts since 2026-10-13 (see above): dev = new account, prod = the
  original one.
- Phase 5 choices the user has not objected to: the "listing submitted" email goes to the
  submitter as a confirmation; admins cannot create listings; the form fixes the country to
  Serbia.
- Phase 6 choices to confirm: Admins and Super Admins can both read the audit log; listing
  emails for approval/rejection go to the creator only (not an assigned agent); a deactivated
  _assigned agent_ does not hide the listing (only the creator's status does); its inquiries
  go to the creator (decided in Phase 9). Removing an image from a published listing
  can't be undone except by re-uploading.
- Super Admins are created only with `pnpm admin:create`; "delete administrators" (SPEC
  §2.1) is implemented as deactivation (soft, reversible).
- OSM standard tiles label Serbian places in Cyrillic (visible on every public listing map).
  The user decided to keep Cyrillic map labels for now; providers considered if that changes:
  MapTiler or Stadia Maps (~$20–25/month for commercial use; free tiers are non-commercial),
  OpenFreeMap (free, MapLibre). Google Maps was ruled out (billing, not OSM-based, SPEC §14).
- Phase 7 choices to confirm: profile pictures are
  JPEG/PNG/WebP/HEIC, ≥ 200 × 200 px, ≤ 10 MB; profile slugs never change when the name
  changes; changing the login email needs the current password; an approved agent's public
  page appears only once they have set their password.
- Parallel invitations with the same name can collide on the profile slug (unique
  violation → 500); rare, not fixed.
- **Map tiles (decision 2026-10-14): keep the free `tile.openstreetmap.org` tiles for now and
  revisit when the site gets real traffic (pre-launch/post-launch checklist item).** Why it
  matters: the OSM tile policy gives best-effort availability with no SLA, says commercial services
  may have access withdrawn at any point, may block without notice, and forbids heavy use; the
  data licence (ODbL) is fine and the required attribution is shown (`lib/map/map-provider.ts`).
  Switching is one environment variable (`NEXT_PUBLIC_MAP_TILE_URL` plus
  `NEXT_PUBLIC_MAP_ATTRIBUTION`, rebuild of the web app) for raster providers (MapTiler/Stadia,
  ~$20–25/month commercial); vector providers (OpenFreeMap: free, commercial use allowed, no key, no
  SLA) need MapLibre instead of Leaflet in `ListingMap`/`LocationMap`, which would also allow
  choosing the label language (the current raster tiles label Serbian places in Cyrillic and cannot
  be changed; the user keeps Cyrillic for now; how each provider renders Serbian Latin names is
  untested). The site must not send a `Referrer-Policy` that strips the Referer (the policy
  requires it; today none is set). "Find address on map" uses Nominatim (same OSM policy) on
  button press only.

## Phase 10 starting notes

- Scope still to do: responsive pass on all pages (dashboard, auth and agent pages at phone and
  tablet width), the per-visitor client IP fix (launch
  blocker, see above; `TRUST_PROXY_HOPS=3` until then),
  and a final check of the deployed site (emails from the walls.rs domain,
  uploads to Cloudinary incl. a 10+ MB image through the Netlify proxy, sign-in over HTTPS,
  a listing through review and publication).
- ~~Delete `.github/workflows/keep-api-awake.yml`~~: done 2026-10-19, with the move to the VPS.
- Revisit when real traffic arrives (not a launch blocker): the production map tile host, see
  "Map tiles" under open questions.
- **Demo data on the preview site (decision 2026-10-15):** the user wanted many listings to test
  search, filters and sorting on preview.walls.rs, which runs on the production database and
  production Cloudinary. `pnpm demo:seed` (`apps/api/src/scripts/seed-demo.ts`, data in
  `demo-data.ts`, descriptions generated in `demo-text.ts`) adds 8 demo accounts (4 sellers, 4
  approved agents with approved applications but no proof files) and 50 published listings
  (every type, sale/rent, EUR/RSD, day/week/month rents, price on request, negotiable, 6
  featured, 3 seller listings assigned to agents, a month of daily views), checked with the
  shared schemas and `checkSubmissionRequirements`, written straight to the database so no
  emails are queued (approving through the services would queue ~100 emails, Resend's whole
  free daily quota). Demo emails are `delivered+walls-demo-<name>@resend.dev` (Resend's
  test mailbox: accepted, never bounces, counts against the quota); photos are Unsplash
  Licence photos fetched from `images.unsplash.com` (the unsplash.com download links now sit
  behind an anti-bot check that rejects scripts), stored under `demo/listings/…` keys.
  `--remove` deletes demo users and everything referring to them. The user runs it against
  preview with production credentials entered at prompts (README "Demo data"); I tested seed,
  duplicate-run refusal and remove on the local database (local photo storage, not
  Cloudinary).
- **Before launch (user's choice): start the live site on a fresh database** (new or reset
  Supabase database, migrations, re-create the Super Admin with `admin:create`) rather than
  relying on `--remove`, and delete the `demo` folder in the production Cloudinary account.
- Answered by the user: hosting plans and domains (Render free/Frankfurt, Netlify, walls.rs
  only through Netlify, preview.walls.rs first), Resend sender domain (verified), Supabase
  project (created, EU), rate limits (decided 2026-10-13: keep the in-memory counters; they
  reset on every deploy or restart and would multiply with several API instances, so revisit a
  shared store, e.g. Postgres or Redis, when scaling beyond one instance). The `/about` and
  `/contact` content was decided on 2026-10-16.

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
