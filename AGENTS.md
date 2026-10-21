# AI Coding Agent Instructions

## Purpose

This repository is a real-estate listing platform.

`SPEC.md` is the authoritative product and domain specification.

Read `SPEC.md` before implementing or changing product behavior.

------------------------------------------------------------------------

## Core Rule

**Do not invent product requirements.**

If the specification defines a behavior, implement that behavior.

If the specification does not define an important business decision, ask
for clarification rather than silently creating a new rule.

Technical implementation details may be chosen by the agent when they do
not alter product behavior.

------------------------------------------------------------------------

## Before Coding

Always:

1.  Inspect the repository.
2.  Understand the existing architecture.
3.  Inspect package manager and scripts.
4.  Inspect database configuration.
5.  Inspect authentication.
6.  Inspect frontend structure.
7.  Inspect shared packages.
8.  Inspect environment configuration.
9.  Read `SPEC.md`.
10. Identify conflicts before making changes.

If the repository is empty, scaffold the architecture described in
`SPEC.md`.

------------------------------------------------------------------------

## Implementation Principles

### Keep layers separated

Prefer:

``` text
UI
 ↓
API client
 ↓
API
 ↓
Application/service layer
 ↓
Domain rules
 ↓
Repository/data access
 ↓
Database
```

Do not place substantial business logic inside React components or
Express route handlers.

------------------------------------------------------------------------

## Domain Rules

Business rules should be represented in reusable services/functions
rather than duplicated across endpoints.

Examples:

-   listing state transitions
-   role permissions
-   listing creator/advertiser access
-   optional agent assignment
-   private-seller email verification
-   agent application review and approval
-   publication requirements
-   phone verification-status integrity
-   profile change approval
-   price conversion

A rule should have one authoritative implementation whenever practical.

------------------------------------------------------------------------

## Authorization

Never rely on the frontend for authorization.

Always verify permissions server-side.

For private sellers, resource access must be based on the authenticated user and listings they created/are authorized to manage. For agents, enforce listing access using the authenticated identity plus explicit listing assignment/authorization rules. An optional `assignedAgent` (an agent or agency, never an investor) is not a replacement for `createdBy` or the advertiser identity.

Agents, agencies and investors all have the `REAL_ESTATE_AGENT` role; their kind is the account's `sellerType` (`REAL_ESTATE_AGENT`, `AGENCY`, `INVESTOR`; `PRIVATE_SELLER` for private sellers, none for admins). Decide permissions by role and use the seller type only where a rule names a kind (assignment, agency name, badges). The shared rules live in `packages/shared/src/user/seller-type.ts`; the database checks that role and type match.

Private seller accounts become active after email verification. Public registration must never allow users to select or self-assign the agent role. Applications from agents, agencies and investors require supporting proof and Admin/Super Admin approval before an active account/profile is created.

Never trust these values when sent by the client:

``` text
userId
role
agentId
createdBy
sellerType
assignedAgent
listing ownership
phone verification status
```

Derive or validate them server-side.

------------------------------------------------------------------------

## Validation

Validate all external input.

Use shared Zod schemas where appropriate.

Validate:

-   request bodies
-   query parameters
-   route parameters
-   uploaded files
-   listing data
-   profile changes

Do not assume frontend validation is sufficient.

------------------------------------------------------------------------

## Database

Use PostgreSQL and Drizzle.

Prefer relational modeling for domain data.

Use:

-   foreign keys
-   unique constraints
-   check constraints where useful
-   indexes based on actual query patterns
-   transactions for multi-step state changes

Avoid storing important domain information exclusively inside opaque
JSON fields.

------------------------------------------------------------------------

## API

Use REST.

Controllers should remain thin.

Prefer:

``` text
Route
 → Controller
 → Service
 → Repository
```

API errors should use a consistent structure.

Never expose internal stack traces to clients.

------------------------------------------------------------------------

## Authentication

Use secure HTTP-only cookies.

Never store authentication tokens in localStorage.

Password hashes must never be returned to clients.

Private sellers register with email/password and must verify email before their account can submit listings. Do not require phone verification for MVP.

Provide a separate “For professionals” application flow for agents, agencies and investors. Collect the advertiser type, professional details and supporting proof; do not create/activate a professional account or public profile until an Admin/Super Admin approves the application. Do not expose an agent role selector in ordinary public registration.

Phone verification status must be stored accurately. Public contact details label only verified numbers ("Verified") and never present an unverified number as verified; unverified numbers carry no label. Never allow a user to mark their own number verified. No phone-verification workflow is in MVP scope; it is planned after launch (`SPEC.md` §45.1).

Authentication and authorization must be tested independently.

Design authentication so Google OAuth can be added later.

------------------------------------------------------------------------

## Listing Workflow

Do not bypass the defined lifecycle.

``` text
DRAFT
→ PENDING_REVIEW
→ PUBLISHED
→ SOLD/RENTED
→ ARCHIVED
```

Rejected listings return to Draft with a rejection reason.

Both private sellers and approved professionals (agents, agencies, investors) can submit listings; neither can publish directly. Admin/Super Admin review is required before publication.

Keep `createdBy`, advertiser/seller type, and optional `assignedAgent` separate. Private sellers manage their own listings by default and do not need an assigned agent. Enforce all access rules server-side.

------------------------------------------------------------------------

## Media

Listings require at least three images before submission for review.

Use Cloudinary.

Keep media handling behind a service abstraction.

Do not couple domain entities directly to Cloudinary-specific
implementation details.

------------------------------------------------------------------------

## Internationalization

Support Serbian and English.

Do not hard-code user-facing strings inside components when they should
be translated.

Use stable internal enum values.

Example:

``` text
APARTMENT
```

not:

``` text
"Stan"
```

inside business logic.

------------------------------------------------------------------------

## Branding

Do not hard-code brand colors, logos, or names throughout the
application.

Centralize design tokens and branding configuration.

The application should be rebrandable without rewriting components.

------------------------------------------------------------------------

## UI

Use:

-   Next.js
-   TypeScript
-   Tailwind CSS
-   shadcn/ui

Favor reusable components.

Maintain consistent:

-   spacing
-   typography
-   buttons
-   forms
-   cards
-   tables
-   dialogs
-   badges
-   empty states
-   loading states
-   error states

Avoid unnecessary visual complexity.

The public website should feel modern and premium.

The dashboard should prioritize information clarity and efficient
workflows.


### Web app conventions

-   Put user-facing text in `apps/web/messages/sr.json` (reference) and
    `en.json`. A unit test fails if the two differ in keys or
    placeholders.
-   Use `Link`, `redirect` and `useRouter` from `@/i18n/navigation`,
    never from `next/link` or `next/navigation`, so URLs keep the locale.
-   Call `resolveLocale(params)` at the top of every page and layout
    under `[locale]` so pages can render statically.
-   Validate forms with the shared `@walls/validation` schemas through
    `useSchemaForm`; show API errors with `useErrorMessage`.
-   Do not export values (constants, functions) from `'use client'`
    modules for use in Server Components: they arrive as client
    references, not values. Put shared values in plain modules.
-   Add shadcn/ui components with
    `pnpm dlx shadcn@<version> add <component> -c apps/web`; they are
    written to `packages/ui/src/components` and use Base UI primitives.

------------------------------------------------------------------------

## Responsive Design

Public website:

-   mobile
-   tablet
-   desktop

Dashboard:

-   desktop-first
-   tablet-compatible

Avoid horizontal overflow.

Test important views at common viewport sizes.

------------------------------------------------------------------------

## Testing

Every important business rule should have tests.

Prioritize:

1.  authorization
2.  registration and email verification
3.  agent application approval
4.  listing lifecycle
5.  publication requirements and media validation
6.  creator/advertiser/assignment access rules
7.  phone verification-status integrity
8.  profile-change approval
9.  price conversion
10. inquiries

Add API integration tests for protected endpoints.

Add E2E coverage for critical user journeys.

E2E tests are Playwright tests in `e2e/` (`pnpm test:e2e`). Prefer
asserting what a user sees; the shared fixture already fails a test on any
uncaught browser error. Unit and API tests cannot catch a component that
crashes when it renders in a real browser, so add or extend an E2E test for
every new interactive flow.

Do not write tests merely to satisfy coverage metrics; test meaningful
behavior.

------------------------------------------------------------------------

## Security

Never commit:

-   API keys
-   database credentials
-   session secrets
-   passwords
-   tokens

Use environment variables.

Validate uploads.

Rate-limit sensitive endpoints.

Protect authentication endpoints.

Do not leak sensitive data through API responses.

------------------------------------------------------------------------

## Error Handling

Handle expected errors explicitly.

Use appropriate HTTP status codes.

Distinguish:

-   400 validation
-   401 authentication
-   403 authorization
-   404 not found
-   409 conflict
-   422 business-rule validation where appropriate
-   429 rate limit
-   500 unexpected failure

Do not expose implementation details.

------------------------------------------------------------------------

## Logging

Use structured logging.

Never log:

-   passwords
-   session tokens
-   secrets

Avoid unnecessary personal-data logging.

Business-critical changes should be traceable through audit logs.

------------------------------------------------------------------------

## Code Quality

Prefer:

-   small focused functions
-   explicit types
-   clear naming
-   predictable control flow
-   reusable abstractions
-   minimal duplication

Avoid:

-   giant components
-   giant route handlers
-   hidden side effects
-   unnecessary abstractions
-   premature generic frameworks
-   magic strings
-   magic numbers

------------------------------------------------------------------------

## Dependencies

Use **pnpm** (workspaces) as the only package manager.

-   Install and run scripts with `pnpm`; do not use `npm` or `yarn`.
-   Commit only `pnpm-lock.yaml`; never add `package-lock.json` or
    `yarn.lock`.
-   Reference internal packages with the `workspace:*` protocol.
-   Declare every dependency in the package that imports it; do not
    rely on hoisting.
-   The pnpm version is pinned in the root `package.json`
    `packageManager` field; pnpm switches to that version automatically.
    Corepack 0.34 and older cannot run pnpm 12, so do not rely on it.
-   Shared tool versions live in the `catalog` in `pnpm-workspace.yaml`;
    reference them with `catalog:`.
-   Dependency install scripts are blocked unless approved under
    `allowBuilds` in `pnpm-workspace.yaml`. Record each decision there
    with a reason.
-   pnpm refuses package versions that were published too recently
    (supply-chain protection). Do not bypass it with
    `minimumReleaseAgeExclude`; use the newest version that passes. pnpm
    may add such an exclusion automatically during an interactive
    `pnpm add` — check `pnpm-workspace.yaml` and remove it.

Before introducing a dependency:

1.  Check whether existing dependencies already solve the problem.
2.  Prefer established libraries with active maintenance.
3.  Avoid dependencies for trivial functionality.
4.  Keep the dependency surface reasonably small.

------------------------------------------------------------------------

## Database Migrations

Every schema change must have a migration.

Do not manually mutate production schema.

Migrations should be reproducible.

------------------------------------------------------------------------

## Environment Variables

Maintain `.env.example`.

Document every required variable.

Never commit real environment files containing secrets.

------------------------------------------------------------------------

## Documentation

Update documentation when architecture or behavior changes.

At minimum maintain:

-   `SPEC.md`
-   `AGENTS.md`
-   `README.md`
-   `.env.example`

------------------------------------------------------------------------

## Git Hygiene

Keep changes focused.

Prefer small logical commits when working in a git repository.

Do not modify unrelated files.

Do not remove existing functionality unless the specification explicitly
requires it.

------------------------------------------------------------------------

## Before Finishing a Task

Run the relevant:

-   type checks
-   lint
-   unit tests
-   integration tests
-   E2E tests where applicable
-   build

Report failures honestly.

Do not claim tests passed unless they were actually run.

------------------------------------------------------------------------

## Definition of Done

A feature is not complete merely because the UI exists.

A complete feature should have, where applicable:

-   UI
-   API
-   validation
-   authorization
-   database persistence
-   error handling
-   tests
-   loading state
-   empty state
-   error state
-   responsive behavior
-   localization
-   documentation

------------------------------------------------------------------------

## When Requirements Are Ambiguous

Use this priority:

``` text
Explicit SPEC.md requirement
        ↓
Existing architecture
        ↓
Security/data integrity
        ↓
Conventional technical solution
        ↓
Ask the user
```

Do not turn an unresolved product decision into an implementation
assumption.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
