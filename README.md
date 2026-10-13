# Walls — Real Estate Platform

A modern real-estate listing platform for Serbia, with public property browsing, private-seller accounts, professionally approved real-estate agents, and an administrative dashboard for reviewing listings and managing inquiries and platform operations.

## Project Status

MVP specification phase / active development.

The authoritative product and technical requirements are defined in:

-   [`SPEC.md`](./SPEC.md)
-   [`AGENTS.md`](./AGENTS.md)

## Brand identity

- **Brand:** Walls
- **Domain:** [walls.rs](https://walls.rs)
- **Logo:** approved geometric architectural mark with the WALLS wordmark; SVG sources in [`packages/ui/brand/`](./packages/ui/brand/README.md).
- **Primary orange:** `#FF6A00`
- **Charcoal:** `#171B1E`
- **Slate gray:** `#6B7280`
- **Cream:** `#F8F7F4`
- **White:** `#FFFFFF`
- **Typeface:** Montserrat (headings and body)

Keep branding values centralized in theme/branding configuration rather than scattering them across components. The brand configuration lives in [`packages/ui/src/brand/brand.ts`](./packages/ui/src/brand/brand.ts). Text on orange must be charcoal: white on orange fails WCAG contrast.

## Architecture

``` text
                    ┌─────────────────────┐
                    │   Public Website    │
                    │      Next.js        │
                    └──────────┬──────────┘
                               │
                               │ REST API
                               ▼
                    ┌─────────────────────┐
                    │      Express API    │
                    │      Node.js/TS     │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
          ┌──────────────────┐   ┌──────────────────┐
          │   PostgreSQL     │   │ External Services│
          │   Supabase       │   │                  │
          └──────────────────┘   │ Cloudinary       │
                                 │ Resend            │
                                 │ Exchange Rates    │
                                 │ OpenStreetMap     │
                                 └──────────────────┘
```

## Applications

``` text
apps/
├── web/       # Public website + authenticated dashboard
└── api/       # Express backend
```

Shared packages:

``` text
packages/
├── shared/
├── validation/
├── database/
└── ui/
```

## Technology

### Frontend

-   Next.js
-   TypeScript
-   Tailwind CSS
-   shadcn/ui
-   React Hook Form
-   Zod

### Backend

-   Node.js
-   TypeScript
-   Express

### Web app

- Serbian pages are served at unprefixed URLs (`/login`), English under `/en`
  (`/en/login`). Translations live in `apps/web/messages/{sr,en}.json`.
- Browsers call the API through the web app's `/api/*` proxy, so the session
  cookie stays first-party. Run the API (`pnpm dev` starts both) and open
  http://localhost:3000.
- Components come from shadcn/ui (Base UI primitives) in `packages/ui`; the theme
  in `packages/ui/src/styles/globals.css` derives every color from the brand
  palette.

### Listing images and maps in development

Without `CLOUDINARY_*`, uploaded listing images and profile pictures are stored in
`apps/api/.media` (`LOCAL_MEDIA_DIR`) and served by the API through the web proxy. Agent
applications' proof files are private: they go to `apps/api/.private-files`
(`LOCAL_PRIVATE_FILES_DIR`), which is never served directly; the API streams them to
administrators only. With Cloudinary they are stored as `authenticated` raw files. Production
requires Cloudinary. Maps use OpenStreetMap tiles by default (`NEXT_PUBLIC_MAP_TILE_URL` to
change).

### Exchange rates in development

The API fetches the National Bank of Serbia EUR middle rate at startup and whenever the
stored rate is older than 12 hours, from kurs.resenje.org (free, no key). To work offline,
set `EXCHANGE_RATE_PROVIDER=fixed` and `EXCHANGE_RATE_FIXED_EUR_RSD=117.2`; tests and the
E2E suite always use a fixed rate. Production must use `nbs`.

### Emails in development

Without `RESEND_API_KEY`, the API prints every email, including its
verification or reset link, to its console instead of sending it.

### First Super Admin

Accounts with admin rights are never created through public registration.
Bootstrap the first one from the command line:

``` text
pnpm admin:create --email admin@walls.rs --name "Ana Anić" --locale sr
```

The new admin receives an email with a single-use link (valid 7 days) to set
their own password; no password is chosen or shown by the command.

### Database

-   PostgreSQL
-   Drizzle ORM
-   Supabase

### Authentication

-   Email/password
-   HTTP-only secure cookies
-   Role-based access control

### Media

-   Cloudinary

### Email

-   Resend

### Maps

-   OpenStreetMap-based provider

### Hosting

-   Netlify --- frontend
-   Render --- API
-   Supabase --- PostgreSQL

## Accounts and roles

The application has four roles:

``` text
SUPER_ADMIN
ADMIN
REAL_ESTATE_AGENT
PRIVATE_SELLER
```

Private sellers register with email/password and can create an active seller account after verifying their email. Ordinary public registration does not allow users to choose the real-estate-agent role.

Prospective real-estate agents use the separate **“For real-estate agents”** application flow and submit professional details plus supporting proof. An Admin or Super Admin must approve the application before an active agent account and public agent profile are created.

Private sellers can manage their own listings and have public seller profile pages. Agents can manage listings they are authorized to advertise, subject to server-side access rules and optional admin assignment. `createdBy`, seller/advertiser type, and `assignedAgent` are separate concepts.

Both private sellers and approved agents submit listings for review. Admins/Super Admins must approve listings before they appear publicly.

Phone verification is not required for MVP. Public contact details must clearly label phone numbers as verified or unverified; users cannot self-mark a number as verified.

Admins can manage all listings and approved agents. Super Admins additionally manage administrators and permanent deletion.

## Listing Workflow

``` text
DRAFT
  ↓
PENDING_REVIEW
  ↓
PUBLISHED
  ↓
SOLD / RENTED
  ↓
ARCHIVED
```

Rejected listings return to Draft with a rejection reason.

## Property Types

The initial platform supports:

-   Apartment
-   House
-   Villa
-   Office
-   Retail / Commercial
-   Warehouse
-   Land
-   Garage
-   Other

## Transaction Types

-   Sale
-   Rent

## Languages

MVP supports:

-   Serbian
-   English

## Local Development

### Prerequisites

-   Node.js 22.18 or newer (see `.nvmrc`)
-   pnpm, version pinned in the root `package.json` `packageManager`
    field
-   Docker, for the local PostgreSQL database

Install pnpm once with `npm install -g pnpm` or the
[standalone installer](https://pnpm.io/installation). Any recent pnpm
switches to the pinned version automatically. Corepack 0.34 and older
cannot run pnpm 12, so do not rely on `corepack enable`.

Do not use `npm` or `yarn` in this repository.

### Setup

``` text
pnpm install
cp .env.example .env      # then fill in the values you need
pnpm db:up                # start PostgreSQL in Docker
pnpm db:migrate           # apply database migrations
pnpm dev                  # API on :4000, web on :3000
```

Both apps read the single root `.env` file in development.

#### Without Docker

Any local PostgreSQL 14 or newer works (production and CI use 17). Create
the same role and databases that Docker would, so `.env.example` values
work unchanged:

``` text
psql -d postgres -c "CREATE ROLE walls LOGIN PASSWORD 'walls'"
psql -d postgres -c "CREATE DATABASE walls OWNER walls"
psql -d postgres -c "CREATE DATABASE walls_test OWNER walls"
psql -d walls -c "ALTER SCHEMA public OWNER TO walls"
psql -d walls_test -c "ALTER SCHEMA public OWNER TO walls"
```

Then skip `pnpm db:up` and run `pnpm db:migrate`.

### Scripts

| Command              | Purpose                                         |
| -------------------- | ----------------------------------------------- |
| `pnpm dev`           | Run all apps in watch mode                      |
| `pnpm build`         | Production build of all apps                    |
| `pnpm typecheck`     | TypeScript checks in every package              |
| `pnpm lint`          | ESLint across the repository                    |
| `pnpm test`          | Unit tests in every package                     |
| `pnpm test:integration` | Database and API integration tests (needs PostgreSQL) |
| `pnpm test:e2e`      | Playwright browser tests (needs PostgreSQL and a built web app; see below) |
| `pnpm format`        | Format with Prettier (`format:check` in CI)     |
| `pnpm db:up` / `db:down` | Start / stop the local PostgreSQL container |
| `pnpm db:migrate`    | Apply pending migrations to `DATABASE_URL`      |
| `pnpm db:generate`   | Create a migration after changing the Drizzle schema |
| `pnpm db:studio`     | Browse the database with Drizzle Studio         |
| `pnpm admin:create --email <email> --name "<name>"` | Invite a Super Admin (see below) |
| `pnpm brand:generate` | Regenerate favicons and app icons from the brand SVGs |

### End-to-end tests

Playwright tests live in `e2e/`. Install the browser once with
`pnpm --filter @walls/e2e browsers`, then run `pnpm test:e2e`. The run builds
and starts its own API (port 4100) and web app (port 3100), so it does not
touch a running `pnpm dev`; it uses the `walls_test` database and only creates
uniquely named users. Emails are read back from the API log, so no email
provider is needed. Reports and traces are written to `e2e/.output/`.

### Database

The schema lives in `packages/database/src/schema`, migrations in
`packages/database/migrations`. After changing the schema, run
`pnpm db:generate` and commit the generated SQL. Hand-written SQL (extensions,
triggers, reference data) goes in a custom migration:
`pnpm --filter @walls/database db:generate --custom --name <name>`.

Integration tests run against a separate `walls_test` database
(`TEST_DATABASE_URL`), which is wiped and re-migrated on every run. Docker
creates it the first time the Postgres volume is initialised.

### Repository layout

``` text
apps/web            Next.js public website and dashboard
apps/api            Express REST API
packages/shared     Domain rules shared by API and web
packages/validation Shared Zod schemas
packages/database   Drizzle schema, migrations, database client
packages/ui         Design system and brand configuration
scripts/            Repository maintenance scripts
```

## Deployment

Each host builds only its own app from the same repository:

| App | Host | Config | Rebuilds when these change |
| --- | --- | --- | --- |
| `apps/web` | Netlify | [`apps/web/netlify.toml`](./apps/web/netlify.toml) | `apps/web`, `packages/shared`, `packages/validation`, `packages/ui`, root package files (`ignore` command) |
| `apps/api` | Render (Frankfurt, free plan) | [`render.yaml`](./render.yaml) (Blueprint) | `apps/api`, `packages/*`, root package files (`buildFilter`); deploys only after GitHub CI passes |
| Database | Supabase | — | migrations run at the end of every Render build |

Browsers only talk to the web app's domain (walls.rs). The web app forwards `/api/*` to the
API's Render address (`API_INTERNAL_URL`), so the API needs no custom domain and the session
cookie stays first-party.

Settings that live outside the repository:

- **Supabase:** turn off the Data API (Project Settings → Data API); Walls connects to Postgres
  directly, and the Data API would otherwise expose the `public` tables. `DATABASE_URL` is the
  **session pooler** connection string (Render cannot reach the IPv6-only direct connection)
  with `?sslmode=require` appended.
- **Render:** create the service from the Blueprint (New → Blueprint) and enter the variables
  marked `sync: false`. `SESSION_SECRET` is generated by Render; keep it, since changing it
  signs everyone out and invalidates emailed links.
- **Netlify:** import the repository, set the **package directory** to `apps/web` and leave the
  base directory empty. Environment variables: `API_INTERNAL_URL` (the Render service URL),
  `NEXT_PUBLIC_SITE_URL` (`https://walls.rs`), optionally `NEXT_PUBLIC_MAP_TILE_URL` and
  `NEXT_PUBLIC_MAP_ATTRIBUTION`. Turn off deploy previews: they would run against the
  production API and database.
- **Domain:** walls.rs and www.walls.rs point to Netlify; set walls.rs as the primary domain.
  Render's `WEB_ORIGIN` and Netlify's `NEXT_PUBLIC_SITE_URL` must be that exact origin.

On the free plan the API sleeps after 15 minutes without requests, and the first request after
that waits for it to start (about a minute).

## Environment Variables

Environment configuration should include variables for:

``` text
DATABASE_URL
SESSION_SECRET
CLOUDINARY_*
RESEND_API_KEY
EXCHANGE_RATE_PROVIDER
```

The exact variables should be documented in `.env.example`.

Never commit real credentials.

## Development Rules

Read [`AGENTS.md`](./AGENTS.md) before making implementation changes.

Read [`SPEC.md`](./SPEC.md) before changing product behavior.

The most important rule is:

> Do not invent product requirements when the specification does not
> define them. Ask before making an important business decision.

## MVP Scope

The MVP includes:

-   property listings
-   private-seller registration and email verification
-   private-seller dashboard and public seller profiles
-   separate real-estate-agent application with proof and admin approval
-   phone verification-status labels (without phone verification workflow)
-   sale/rent support
-   property search
-   filtering and sorting
-   property detail pages
-   agent profiles
-   listing creation/editing
-   listing review and approval
-   listing assignment
-   agent management
-   authentication
-   approved-agent account setup/invitation email
-   agent application review
-   profile-change approval
-   image/media management
-   maps
-   inquiries
-   email notifications
-   EUR/RSD conversion
-   basic analytics
-   audit logging
-   Serbian/English localization
-   SEO
-   responsive design

The MVP does not include payments, buyer-only accounts, favorites, saved
searches, Google login, MFA, phone verification, map-based search, full CRM
functionality, or native mobile applications. Users who want to advertise a property must have a verified private-seller account or an approved agent account.

## Source of Truth

`SPEC.md` defines product and domain behavior.

`AGENTS.md` defines coding-agent behavior and engineering rules.

`README.md` provides project orientation and setup information.
