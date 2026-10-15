# Real Estate Platform --- Product & Technical Specification

**Status:** MVP Specification\
**Document role:** Source of truth for product behavior, domain rules,
architecture, and acceptance criteria.

------------------------------------------------------------------------

## 1. Product Overview

Build a professional real-estate listing platform consisting of:

1.  A public-facing responsive website where visitors can discover and
    inspect real-estate listings.
2.  A protected dashboard used by Super Admins, Admins, and Real Estate
    Agents to manage listings, agents, inquiries, and related data.
3.  A backend API and PostgreSQL database providing authentication,
    authorization, domain logic, persistence, search, media metadata,
    inquiries, notifications, analytics, and administrative operations.

The platform supports properties offered for:

-   Sale
-   Rent

It supports multiple property types, including:

-   Apartment
-   House
-   Villa
-   Office
-   Retail / Commercial
-   Warehouse
-   Land
-   Garage
-   Other

The platform is **not** a transaction/payment platform. No purchase,
rental contract, escrow, checkout, or payment processing is part of the
MVP.

The primary goal is to create a clean, production-quality foundation
that can later evolve into a larger real-estate platform without
requiring a domain rewrite.

------------------------------------------------------------------------

# 2. Non-Negotiable Product Decisions

The coding agent MUST NOT independently change these decisions.

## 2.1 Roles

The MVP has four application roles:

-   `SUPER_ADMIN`
-   `ADMIN`
-   `REAL_ESTATE_AGENT`
-   `PRIVATE_SELLER`

There is no Manager role. Anonymous visitors do not have accounts. A private seller account is created automatically after email verification. Real-estate agents must apply through a separate flow and are not given an agent account/profile until an Admin or Super Admin approves the application.

### Super Admin

Can:

-   manage administrators
-   manage agents
-   manage all listings
-   approve/reject listings
-   assign listings to agents
-   manage inquiries
-   manage featured listings
-   view platform analytics
-   manage system-level settings
-   deactivate Admin, agent, and private-seller accounts
-   permanently delete archived records where permitted

### Admin

Can:

-   manage agents
-   manage all listings
-   approve/reject listings
-   assign listings to agents
-   manage inquiries
-   manage featured listings
-   view platform analytics
-   deactivate private-seller and agent accounts (see below)

Account deactivation (both Admins and Super Admins): an Admin may deactivate private-seller and agent accounts, for example for abuse; a Super Admin may additionally deactivate Admin accounts. A deactivation always requires a written reason, is recorded in the audit log, and the affected user is notified by email. Nobody can deactivate their own account, and Super Admin accounts cannot be deactivated through the application.

While an account is deactivated, the user cannot sign in (existing sessions end) and the listings they created are hidden from the public site; the listings keep their status and reappear when the account is reactivated. Whoever may deactivate an account may also reactivate it; reactivation likewise requires a written reason, is audit-logged, and the user is notified by email.

Admins cannot:

-   create/delete administrators
-   permanently delete listings

### Real Estate Agent

Agent accounts and public agent profiles are created only after an Admin or Super Admin approves an agent application and its supporting proof. Public/private seller registration must not allow a user to select or self-assign the `REAL_ESTATE_AGENT` role.

Can:

-   view listings they created and listings assigned to them
-   create listings for properties they own or are authorized to advertise
-   edit listings they created or that are assigned to them, subject to server-side authorization
-   submit listings for review
-   see listing status/rejection feedback
-   manage their own profile
-   view inquiries associated with their listings

Agents cannot:

-   publish listings directly
-   approve/reject listings
-   assign listings
-   view listings assigned exclusively to other agents in the dashboard unless they are also the recorded creator and the permissions explicitly allow access
-   manage other agents
-   permanently delete listings
-   change their own role or verification status
-   independently activate/deactivate their account

### Private Seller

A private seller account is created automatically after the user registers with email/password and verifies their email. Private sellers do not need phone verification to register, create listings, or submit them for review.

Can:

-   create and manage their own listings
-   submit eligible listings for review
-   see listing status and rejection feedback
-   edit their own permitted profile/contact fields
-   view inquiries for their own listings
-   have a public seller profile page showing their public listings

Private sellers cannot:

-   select or grant themselves the agent role
-   publish listings directly
-   approve/reject listings
-   manage other users' listings
-   assign listings to agents
-   manage their role or verification status

### Agent Applicant

An agent applicant submits a separate application through the “For real-estate agents” entry point and provides the required professional details and supporting proof. An application is not an active agent account and must not grant dashboard or listing-management access. Admin/Super Admin reviews the application; on approval, the system creates or activates the agent account/profile and sends the applicant an email to complete account setup. On rejection, no active agent account/profile is created and the applicant receives an appropriate outcome notification.

An agent application contains:

-   full name
-   email address
-   phone number
-   agency name (optional)
-   at least one supporting proof file (PDF, JPG, or PNG)

No licence/registry number is collected in the MVP. Proof files are private: they are visible only to Admins/Super Admins and are never exposed publicly.

Application rules:

-   An agent account needs its own email address. An application from an email that already belongs to a Walls account (for example a private seller) is not saved; the applicant is told by email to apply with a different address. Accounts never change role. The form's response is the same either way, so it does not reveal which addresses are registered.
-   An email address can have only one application waiting for review at a time; after a rejection the applicant may apply again.
-   The applicant receives a confirmation email. Admins are not emailed about new applications; the dashboard shows how many are waiting.
-   A rejection reason is required and is included in the email to the applicant.
-   Applications and their proof files are kept after review. An approved agent's application and proof stay available to Admins/Super Admins from the agent's account, as evidence of eligibility for internal controls or official inspections.

------------------------------------------------------------------------

# 3. Authentication

MVP authentication:

-   Email/password
-   Secure server-side authentication
-   HTTP-only secure cookies
-   Role-based authorization
-   Email verification before a private seller account is activated for listing submission
-   Password reset
-   Separate real-estate agent application and approval workflow

MVP does not include:

-   Google login
-   Microsoft login
-   MFA
-   phone-number verification

Private sellers register through the standard public registration flow. Once they verify their email, their `PRIVATE_SELLER` account is activated automatically. Public registration must not offer a role selector or any way to request `REAL_ESTATE_AGENT` privileges.

Prospective agents use a distinct “For real-estate agents” entry point and submit professional details plus supporting proof. Admin/Super Admin approval is required before an active agent account and public agent profile are created. After approval, the agent completes account setup using a secure email flow; never send or manually share passwords.

Phone verification is not required in the MVP. Whenever a phone number is shown in public seller/agent contact details, its verification status must be clearly labelled. Unverified phone numbers must never be presented as verified. Do not implement phone verification as part of MVP.

However, authentication architecture MUST allow Google login to be added later without replacing the existing user model.

Email addresses are identity/authentication fields and cannot be freely changed by users. Keep the existing email-change approval rule for active agent profiles unless the product specification explicitly changes it.

------------------------------------------------------------------------

# 4. User Profile Rules

Private sellers and agents may edit permitted profile information such as:

-   Display name
-   Profile picture
-   Bio
-   Other approved public profile fields
-   Contact phone number

Email changes for active accounts require the email-verification flow and must not silently replace the authenticated identity. Retain administrator approval for agent email/phone changes where applicable under the existing agent-profile workflow. Private seller contact changes must be auditable.

Phone verification is not required for MVP. Store phone verification status explicitly (for example, `UNVERIFIED` / `VERIFIED`) and display a clear status label beside public phone contact details. The status may only be set to verified by a trusted verification process; users must not be able to mark their own phone number verified. No phone-verification process is included in MVP, so newly supplied numbers remain unverified unless a future approved verification feature is implemented.

Approval rules by account type:

-   **Agents:** changes to any public profile field (display name, bio, profile picture, phone number, email address) are submitted as change requests and take effect only after Admin/Super Admin approval. An email change additionally requires verifying the new address.
-   **Private sellers:** permitted profile changes take effect immediately and are audited. An email change requires verifying the new address.

An agent has at most one pending change request. Until it is reviewed, further changes update that same request (so the reviewer always sees the latest version), and the agent may discard it. A rejected request includes a reason, emailed to the agent; the public profile stays unchanged.

All important profile changes should be auditable.

------------------------------------------------------------------------

# 5. Listing Ownership and Assignment

Keep these concepts separate:

-   `createdBy`: the authenticated user who created the listing; immutable for audit/history purposes
-   `sellerType`: whether the listing is advertised by a `PRIVATE_SELLER` or a `REAL_ESTATE_AGENT`
-   `assignedAgent`: optional agent assignment managed by Admin/Super Admin; it is not a substitute for the seller or creator

The creator/advertiser is responsible for managing their own listing, subject to role-based authorization. A private seller's listing has no assigned agent by default. An admin may assign an agent when appropriate. Agent assignment must not silently remove the creator's access to their own listing, and a listing may only be managed by users explicitly authorized by the server-side policy.

Example:

``` text
Private Seller A creates Listing X
Listing X has sellerType = PRIVATE_SELLER and assignedAgent = null
Admin may later assign Agent B to assist with Listing X
createdBy remains Private Seller A
```

For an agent-created listing, `createdBy` identifies the agent and `sellerType = REAL_ESTATE_AGENT`; `assignedAgent` can identify the agent responsible for ongoing management. Keep these fields distinct to support later reassignment and auditing.

------------------------------------------------------------------------

# 6. Listing Lifecycle

Listings use the following lifecycle:

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

A rejected listing returns to `DRAFT` and contains a rejection reason.

Recommended state model:

-   `DRAFT`
-   `PENDING_REVIEW`
-   `PUBLISHED`
-   `REJECTED`
-   `SOLD`
-   `RENTED`
-   `ARCHIVED`

## Allowed transitions

### Private Seller / Real Estate Agent

``` text
DRAFT → PENDING_REVIEW
REJECTED → DRAFT
```

### Admin / Super Admin

``` text
PENDING_REVIEW → PUBLISHED
PENDING_REVIEW → REJECTED
PUBLISHED → SOLD
PUBLISHED → RENTED
PUBLISHED → ARCHIVED
SOLD → ARCHIVED
RENTED → ARCHIVED
```

The UI MUST NOT expose actions that are invalid for the current
role/state.

## Editing published listings

A creator (or other user authorized to edit the listing) may edit a `PUBLISHED` listing. Edits are split into two groups:

**Minor edits — applied immediately and audited:**

-   price amount, currency, rental period, and `priceNegotiable`
-   `isExactAddressPublic`
-   reordering media or changing the primary/cover image among already-approved images

**Major edits — require Admin/Super Admin review:** every other change, including title, description, property type, property attributes, location, amenities, and adding or removing media. Major edits are saved as a pending revision. The currently published version stays public, unchanged, until an Admin/Super Admin approves the revision; a rejected revision includes a rejection reason and the live listing is unaffected. A listing has at most one open revision at a time. Until it is reviewed, further major edits update that same pending revision, so the reviewer always sees the latest version.

Admins and Super Admins do not edit listing content themselves; they approve, or reject with a reason, and the creator makes the changes.

------------------------------------------------------------------------

# 7. Property and Listing Domain Model

`Property` and `Listing` are separate concepts.

A property represents the physical real-estate asset.

A listing represents an offer concerning that property.

A property may have multiple listings, including the possibility of:

``` text
Property
 ├── Sale listing
 └── Rental listing
```

The model should not assume that a physical property can only ever have
one listing.

------------------------------------------------------------------------

# 8. Transaction Types

Supported transaction types:

-   `SALE`
-   `RENT`

------------------------------------------------------------------------

# 9. Property Types

Initial property types:

-   `APARTMENT`
-   `HOUSE`
-   `VILLA`
-   `OFFICE`
-   `RETAIL`
-   `WAREHOUSE`
-   `LAND`
-   `GARAGE`
-   `OTHER`

The architecture should allow additional property types later without
restructuring the listing model.

------------------------------------------------------------------------

# 10. Property Attributes

Use structured, typed fields for common property attributes.

Do NOT implement all property data as arbitrary JSON.

Common fields may include:

-   Living area
-   Total area
-   Bedrooms
-   Bathrooms
-   Floor
-   Total floors
-   Year built
-   Heating type
-   Parking spaces
-   Furnished status
-   Garden
-   Garage
-   Balcony
-   Terrace

Property-type-specific fields may be added where appropriate.

Use a reusable amenity/feature model for boolean or categorical
characteristics.

Examples:

-   Elevator
-   Air conditioning
-   Central heating
-   Furnished
-   Balcony
-   Terrace
-   Garden
-   Parking
-   Garage
-   Security system
-   Internet
-   Pets allowed
-   Smoking allowed

Heating type and furnished status are structured, optional property
fields rather than amenities (so "Central heating" and "Furnished" are not
in the amenity list):

-   Heating type: `DISTRICT` (district heating, "CG"), `INDIVIDUAL_CENTRAL`
    (central heating for one unit or building, "etažno", "EG"), `ELECTRIC`,
    `GAS`, `STORAGE_HEATERS` ("TA"), `UNDERFLOOR`, `HEAT_PUMP`, `SOLID_FUEL`,
    `OTHER`, `NONE`
-   Furnished status: `FURNISHED`, `SEMI_FURNISHED`, `UNFURNISHED`

Features offered per property type (the server rejects others):

| Property type | Features |
|---|---|
| Apartment | elevator, air conditioning, balcony, terrace, garden, parking, garage, security system, internet, pets allowed, smoking allowed |
| House | air conditioning, balcony, terrace, garden, parking, garage, security system, internet, pets allowed, smoking allowed, sewage, gas connection |
| Villa | as House, plus elevator |
| Office | elevator, air conditioning, balcony, terrace, parking, garage, security system, internet, smoking allowed |
| Retail | elevator, air conditioning, terrace, parking, security system, internet |
| Warehouse | elevator, air conditioning, parking, security system, internet |
| Garage | elevator (car lift), security system |
| Land | electricity, water, sewage, gas connection, paved road access, building permit |
| Other | all features |

When the property type changes, features that don't apply to the new type are removed.

Avoid creating a generic dynamic field builder for MVP.

------------------------------------------------------------------------

# 11. Price Model

Price MUST be structured.

Do not store formatted prices as free text.

Recommended structure:

``` text
amount
currency
period
```

For example:

``` text
250000 EUR
```

or:

``` text
1200 EUR / MONTH
```

Supported currencies:

-   EUR
-   RSD

Supported rental periods:

-   DAY
-   WEEK
-   MONTH

Additional fields may include:

-   `priceNegotiable`

The original listing currency/value is the authoritative stored price.

Price is optional. A listing has either a fixed price (amount, currency, rental period for `RENT` listings, and `priceNegotiable`) **or** "price on request" — never both. The listing form uses a single control that switches between the two modes; choosing "price on request" clears any entered amount. Listings with price on request display "Price on request" and sort after priced listings when sorting by price.

------------------------------------------------------------------------

# 12. Currency Conversion

The UI must support displaying prices in EUR or RSD.

The database stores the original price and currency.

Exchange rates should:

-   come from an external exchange-rate provider
-   be cached
-   be updated periodically, preferably daily
-   include a timestamp indicating when the rate was retrieved
-   not require an external API request for every page view

Do not permanently overwrite the original listing price during
conversion.

The conversion service MUST be abstracted so the provider can be
replaced.

Currency decisions:

-   The rate is the **National Bank of Serbia (NBS) official middle rate** for EUR, read from kurs.resenje.org, a free service (no key) that republishes the NBS exchange rate list. The API refreshes it when the stored rate is older than 12 hours (checked hourly and at startup); if a refresh fails, the last stored rate stays in use.
-   Prices are shown in **EUR** until the visitor chooses otherwise. A converted price is marked as approximate (≈) and the price as listed is shown next to it. Pages that show converted prices say which rate was used and when it was retrieved.
-   The visitor's EUR/RSD choice is remembered in a preference cookie. It affects only how prices are shown; the language is still decided by the URL alone.

------------------------------------------------------------------------

# 13. Location

Listings should support structured location data:

-   Country
-   City
-   Municipality/District
-   Neighborhood
-   Street
-   Street number
-   Postal code
-   Latitude
-   Longitude

Exact address visibility is controlled per listing.

The user who manages the listing — a private seller or an agent — decides whether the exact address is public. The exact address is **hidden by default** to prevent accidental location leakage. Before the user makes it public, the UI must clearly warn them that the street address and exact map location will become visible to everyone, and ask them to confirm.

Recommended field:

``` text
isExactAddressPublic
```

Only listings with public exact locations should expose exact map
coordinates/address to public visitors.

Listings with private exact addresses may still show broader location
information.

------------------------------------------------------------------------

# 14. Maps

Use a free/OpenStreetMap-based mapping solution for MVP.

The architecture must abstract the mapping implementation enough that
the provider can be replaced later.

MVP does NOT require map-based property search.

The map on a listing page should only expose exact location when the
listing explicitly permits public exact-address visibility.

When the exact address is hidden, the map shows an **approximate area**: a circle about 500 m across, with no pin, that contains the property. Its centre is never the property's location: hidden locations are snapped to a fixed grid of about 350 m cells, and the circle covers the whole cell, so every property in a cell gets the same circle and the exact point cannot be worked out. Structured data for search engines likewise omits the street and coordinates.

------------------------------------------------------------------------

# 15. Media

Each listing requires at least **3 images** before it can be submitted
for review.

Support:

-   multiple images
-   primary/cover image
-   image ordering
-   drag-and-drop ordering

Optional media:

-   floor plans
-   video
-   virtual tour

Media should be represented as a first-class entity rather than only an
array of URLs.

Recommended conceptual fields:

``` text
id
listingId
type
url
sortOrder
isPrimary
altText
createdAt
```

Listing image limits:

-   formats: JPEG, PNG, WebP, HEIC/HEIF, checked by file content (signature), not only by extension
-   file size: 50 KB to 15 MB per image
-   dimensions: at least 1024 px on the longer side and 768 px on the shorter side (portrait and landscape both accepted)
-   at most 30 images per listing

Use Cloudinary for image/media storage and delivery in the MVP.

Media operations should be abstracted so the storage provider can be
replaced.

------------------------------------------------------------------------

# 16. Public Website

Required pages:

``` text
/
 /properties
 /properties/:slug
 /agents
 /agents/:slug
 /about
 /contact
```

The homepage should support:

-   prominent search
-   featured properties
-   selected/latest listings
-   clear calls to action
-   professional branding

Property details should include:

-   images
-   property type
-   sale/rent status
-   price
-   key attributes
-   amenities
-   location
-   agent information
-   inquiry/contact action
-   optional map
-   optional additional media

------------------------------------------------------------------------

# 17. Search

Public property search is a core MVP feature.

Search should support:

-   keyword
-   location

Filters should include:

-   transaction type
-   property type
-   minimum price
-   maximum price
-   minimum area
-   maximum area
-   bedrooms
-   bathrooms
-   furnished status
-   relevant amenities/features

Sorting should support at minimum:

-   newest
-   price low → high
-   price high → low
-   area small → large
-   area large → small

Search state should be URL-addressable so results can be
shared/bookmarked.

How the filters behave:

-   **Keyword** matches words of the title and description (Serbian and English) by prefix, ignoring case and accents ("vracar" finds "Vračaru").
-   **Location** matches the city, municipality or neighbourhood, ignoring case and accents; comma-separated parts ("Vračar, Beograd") must all match.
-   **Bedrooms and bathrooms** mean "at least" (1+ … 5+).
-   **Price bounds** are entered in a currency (the visitor's, kept in the URL with the bounds) and compared with every listing's price converted at the current rate. "Price on request" listings never match a price bound.
-   **Area** is the floor area, or the plot area for land.
-   **Furnished status** is one of furnished, semi-furnished or unfurnished and matches exactly; listings that don't state it never match. It is offered when no property type is chosen or the chosen type has the field (apartment, house, villa, office).
-   **Features** offered are those of the chosen property type (all without one); a listing must have every chosen feature.
-   Sorting by price compares prices in EUR at the current rate; rental prices are compared as stated, whatever their period. Listings without a price or area sort last.

------------------------------------------------------------------------

# 18. Public Registration and Buyer Accounts

Anonymous visitors can browse without registering and can submit inquiries without a buyer account. Users who want to advertise properties must register and verify their email as a private seller, or apply through the separate agent approval process.

MVP does not include buyer-only accounts, favorites, or saved searches. Do not require registration to browse public listings or submit a standard inquiry.

------------------------------------------------------------------------

# 19. Seller and Agent Profiles

Both approved agents and private sellers have public profile pages.

Public agent pages show:

-   profile picture
-   display name
-   approved public contact information
-   biography and professional details
-   phone verification status alongside the phone number
-   all currently public listings attributed to that agent

Public private-seller pages show:

-   display name and optional profile picture/bio
-   contact information the seller has chosen to make public
-   phone verification status alongside the phone number
-   all currently public listings attributed to that seller

Contact details on public profiles: an agent's phone number is always shown; a private seller chooses whether to show theirs. An email address is shown only when its owner opts in (for agents, that choice is part of the reviewed profile change). An agent's page lists the public listings the agent created and those assigned to them.

A public profile must not expose internal/admin-only information, email addresses unless explicitly configured for public display, agent application documents, identity evidence, or other verification evidence. The public site must not label an agent as approved/verified unless the agent application was approved by an Admin/Super Admin. Phone verification status is separate from professional agent approval.

------------------------------------------------------------------------

# 20. Inquiries

Visitors can contact the advertiser from a listing, whether the advertiser is a private seller or a real-estate agent.

An inquiry should contain:

-   listing
-   recipient/advertiser user
-   optional assigned agent, where applicable
-   visitor name
-   visitor email
-   visitor phone (optional if appropriate)
-   message
-   timestamp
-   status

Inquiry statuses:

-   `NEW`
-   `CONTACTED`
-   `CLOSED`

The inquiry must be stored in the database and delivered through email
notification.

Agents can manage inquiries belonging to their listings.

Admins/Super Admins can manage all inquiries (read them and set their status); they do not reply to visitors: only the inquiry's recipient is offered the "reply by email" action and the visitor's contact links (decision, 2026-10-14).

Inquiry routing:

-   If the listing has an `assignedAgent`, the inquiry is routed to the assigned agent only. The assigned agent receives the email notification and manages the inquiry status. The listing creator/advertiser can view the inquiry read-only.
-   If the listing has no `assignedAgent`, the inquiry is routed to the listing creator/advertiser, who receives the notification and manages it.

The recipient is always determined server-side from the listing at the time the inquiry is created.

Inquiry decisions:

-   If the assigned agent's account is deactivated, the inquiry goes to the listing creator/advertiser instead, as if no agent were assigned. The assignment itself stays on the listing.
-   The recipient's email contains the message and the visitor's contact details; replying to it writes to the visitor directly. The visitor gets no confirmation email.
-   Spam protection: a hidden trap field that people never see (inquiries with it filled in are dropped silently, with the normal answer), at most 5 inquiries per IP address per hour, and at most 3 per email address per listing per 24 hours. No captcha.
-   The recipient and Admins/Super Admins can move an inquiry between `NEW`, `CONTACTED` and `CLOSED` in any direction; every change is audited.
-   Anyone can send an inquiry without an account. A signed-in private seller or agent sends it under their account's name and email, and sees it afterwards under "Sent" in the dashboard: the listing, the recipient's name, the message and the time, but not the recipient's status. Replies still arrive by email. Nobody can send an inquiry about a listing they created or are assigned to. Signed-in Admins send inquiries like visitors without an account. A two-way inbox (replies inside Walls) is deferred until after the MVP (§44: no messaging between users).

------------------------------------------------------------------------

# 21. Email Notifications

The system should support transactional email for:

-   private seller email verification
-   password reset
-   agent application received
-   agent application approved/rejected
-   listing submitted for review
-   listing approved
-   listing rejected
-   new inquiry
-   email/phone change requests
-   approval/rejection of profile changes
-   account deactivated (including the reason)

Use Resend for MVP, behind an `EmailService` abstraction.

The domain/business logic should not depend directly on Resend.

------------------------------------------------------------------------

# 22. Featured Listings

Listings may be marked as featured by Admin/Super Admin.

Featured listings can appear in dedicated homepage sections.

Prefer supporting:

``` text
isFeatured
featuredUntil
```

rather than only a boolean, even if the initial UI only exposes simple
featured/unfeatured functionality.

------------------------------------------------------------------------

# 23. Analytics

MVP analytics should be intentionally simple.

Track:

### Listing

-   total views
-   views over time
-   inquiry count

### Platform

-   total listings
-   published listings
-   pending listings
-   sold listings
-   rented listings
-   total inquiries
-   total property views

The architecture should allow richer analytics later without requiring
analytics logic inside UI components.

Analytics decisions:

-   A view counts **once per visitor per day**. Visitors are told apart by a fingerprint of IP address and browser, keyed with a secret that changes daily, so nothing identifying is stored and visitors cannot be followed across days. Views are reported by the browser (server renders and link prefetches never count), and crawlers, link previews, the listing's own creator and assigned agent, and Admins are not counted. Days follow Serbian time.
-   "Views over time" shows views per day for the last 30 days.
-   Admins/Super Admins see the platform totals and every listing's numbers. Private sellers and agents see the numbers of the listings they may open in the dashboard (created by them or assigned to them).

------------------------------------------------------------------------

# 24. Delete vs Archive

Normal deletion is archival.

Listings should be archived rather than permanently deleted.

Only Super Admin may permanently delete archived listings.

Permanent deletion should require an explicit confirmation step.

Prefer soft-delete/archive semantics wherever practical.

Draft deletion:

-   The listing creator may delete their own listing while it is in `DRAFT`. Deletion is a soft delete: the draft disappears from the creator's dashboard but the record and its audit trail are retained.
-   A listing in `PENDING_REVIEW` cannot be withdrawn or deleted by its creator; it stays in review until an Admin/Super Admin approves or rejects it.

------------------------------------------------------------------------

# 25. Audit Logging

Important mutations should be auditable.

Track:

-   actor
-   action
-   entity type
-   entity ID
-   timestamp
-   relevant before/after changes where practical

Examples:

``` text
Admin changed listing price
Admin assigned listing to Agent X
Agent submitted listing
Admin approved listing
Admin rejected listing
Super Admin permanently deleted listing
```

The audit model should be generic enough to support future entities.

------------------------------------------------------------------------

# 26. Role-Based Access Control

Authorization MUST be enforced server-side.

Hiding UI buttons is not authorization.

Every protected API operation must validate:

1.  authentication
2.  role
3.  resource ownership/assignment
4.  allowed state transition
5.  input validation

Example:

``` text
Agent requests GET /listings/:id

→ authenticated?
→ role = REAL_ESTATE_AGENT?
→ listing.assignedAgent = currentUser?
→ yes → return
→ no → forbidden
```

Never rely on a frontend-provided agent ID to establish ownership.

Note: the example above is simplified. For agents, the full access rule in §2.1 applies: an agent may access a listing they created **or** a listing assigned to them.

------------------------------------------------------------------------

# 27. Technology Stack

Use the following stack unless a documented technical blocker makes an
item impossible.

## Frontend

-   Next.js
-   TypeScript
-   Tailwind CSS
-   shadcn/ui
-   React Hook Form
-   Zod

## Backend

-   Node.js
-   TypeScript
-   Express

## Database

-   PostgreSQL
-   Drizzle ORM

## Authentication

-   Email/password
-   HTTP-only secure cookies
-   server-side session validation
-   RBAC

## Media

-   Cloudinary

## Maps

-   OpenStreetMap-based provider

## Email

-   Resend behind an abstraction

## Hosting

-   Frontend: Netlify
-   API: Render
-   PostgreSQL: Supabase
-   Media: Cloudinary

------------------------------------------------------------------------

# 28. Monorepo Architecture

Use a monorepo with:

``` text
apps/
  web/
  api/

packages/
  shared/
  validation/
  database/
  ui/
```

The `web` application contains:

-   public website
-   authenticated dashboard

The `api` application contains:

-   authentication
-   authorization
-   domain/business logic
-   persistence
-   integrations
-   API endpoints

The monorepo uses **pnpm workspaces** with **Turborepo** for task orchestration. See `AGENTS.md` (Dependencies) for package-manager rules.

Shared validation/types should not be duplicated between frontend and
backend.

------------------------------------------------------------------------

# 29. API Architecture

Use REST for MVP.

API responsibilities should be clearly separated into:

``` text
Routes
  ↓
Controllers
  ↓
Application/Service layer
  ↓
Domain/business rules
  ↓
Repositories/data access
  ↓
Database
```

Do not place substantial business logic directly inside route handlers.

Validate request payloads with Zod or an equivalent shared schema
mechanism.

Use consistent error responses.

------------------------------------------------------------------------

# 30. Database Design

At minimum, expect entities conceptually equivalent to:

``` text
users
user_sessions
agent_applications
properties
listings
listing_media
amenities
property_amenities
property_locations
listing_assignments
inquiries
audit_logs
exchange_rates
notifications/email-related records
```

The exact table decomposition may be adjusted if justified, but the
domain relationships MUST remain intact.

Important relationships include:

``` text
User 1 ─── N Listings (createdBy)
User 0..1 ─── N Listings (assignedAgent)
AgentApplication ─── reviewed by Admin/Super Admin; approved application creates/activates an agent account

Property 1 ─── N Listings

Listing 1 ─── N Media
Listing N ─── N Amenities

Listing 1 ─── N Inquiries

User 1 ─── N AuditLogs
```

Use foreign keys and database constraints where appropriate.

Create indexes based on actual search/access patterns.

------------------------------------------------------------------------

# 31. Internationalization

MVP languages:

-   Serbian
-   English

Do not hard-code user-facing strings throughout components.

Use a proper i18n strategy.

Domain values should use stable internal identifiers rather than storing
translated labels.

Example:

``` text
propertyType = APARTMENT
```

with translations:

``` text
Apartment
Stan
```

Translation files should be easy to extend.

Locale decisions:

-   Serbian uses the **Latin** script. Cyrillic is not part of the MVP.
-   Serbian is the default locale and is served at unprefixed URLs (for example `/properties`). English is served under the `/en` prefix (for example `/en/properties`).
-   Listing text content (title, description) is stored per locale. Serbian text is required for submission; English text is optional. When English text is missing, English pages fall back to the Serbian text.
-   The URL alone determines the language. Visitors are not redirected based on browser language, and no locale cookie is stored; a language switcher on every page links to the same page in the other language.

------------------------------------------------------------------------

# 32. SEO

Public pages must be SEO-friendly.

Requirements:

-   human-readable URLs
-   stable property slugs
-   dynamic metadata
-   Open Graph metadata
-   sitemap
-   robots.txt
-   canonical URLs where appropriate
-   semantic HTML
-   appropriate structured data where justified

Example:

``` text
/properties/three-bedroom-apartment-belgrade-vracar
```

rather than:

``` text
/property?id=123
```

The sitemap lists the public pages, every public listing, every active agent, and the private sellers who have at least one public listing, each with its Serbian and English URL. Search result pages with filters are not indexed (`noindex, follow`); every public page names its canonical URL and its language alternates.

------------------------------------------------------------------------

# 33. Branding

The brand is **Walls**, using the domain **walls.rs**. Do not invent or substitute another brand name.

Use the approved Walls logo: a geometric, architectural house/roof mark above the spaced `WALLS` wordmark, with `REAL ESTATE` as the descriptor where space permits. The mark uses angular building forms in orange, charcoal, and cream/white. Use the provided scalable SVG asset as the source of truth for the logo.

### Brand color palette

- Primary orange: `#FF6A00`
- Charcoal: `#171B1E`
- Slate gray: `#6B7280`
- Cream: `#F8F7F4`
- White: `#FFFFFF` (neutral surface)

### Typography

Montserrat is the typeface for all UI text, headings and body. It matches the logo wordmark. The choice is centralized in the branding configuration so it can be changed later.

The approved artwork sets the wordmark as live text; production logo files are generated from it with the text converted to outlines (see `packages/ui/brand/README.md`).

Use orange for primary actions and selected accents, charcoal for strong text and dark surfaces, slate gray for secondary text/borders, and cream for warm page backgrounds. Maintain accessible text contrast; do not use orange for small text on cream/white unless contrast is verified.

The orange and charcoal values match the approved logo artwork, which is authoritative for brand color. Verified contrast: white text on orange is 2.87:1 and fails WCAG AA even for large text, so text on orange surfaces is **cream** (2.68:1) by the owner's decision, knowingly below WCAG AA; charcoal (6.03:1) is the accessible alternative and can be restored by changing one design token. Orange text on white/cream (2.87:1 / 2.68:1) also fails; use orange text only on dark surfaces. See `packages/ui/brand/README.md`.

The branding must remain easy to replace. Do NOT scatter branding values through components. Centralize the brand name, domain, logo asset, favicon, colors, typography, and theme tokens in one clearly documented branding/theme configuration.

The design should use a modern, professional, flat visual language.

Avoid excessive:

-   gradients
-   glassmorphism
-   decorative animations
-   excessive shadows
-   visual clutter

Use a coherent design system shared by public website and dashboard.

------------------------------------------------------------------------

# 34. Design System

Define reusable components for:

-   buttons
-   inputs
-   selects
-   comboboxes
-   cards
-   property cards
-   badges
-   tables
-   dialogs
-   confirmation dialogs
-   dropdowns
-   tabs
-   alerts
-   toast notifications
-   pagination
-   filters
-   empty states
-   loading states
-   skeletons
-   error states

The dashboard and public website should share brand tokens but may have
different information-density requirements.

------------------------------------------------------------------------

# 35. Responsive Requirements

Public website:

-   mobile
-   tablet
-   desktop
-   large desktop

Dashboard:

-   desktop-first
-   tablet-compatible
-   usable on smaller screens where practical

Do not allow desktop layouts to overflow horizontally on normal viewport
sizes.

------------------------------------------------------------------------

# 36. Security

Implement at minimum:

-   secure password hashing
-   secure cookies
-   CSRF protection where applicable
-   input validation
-   output encoding where applicable
-   authorization checks
-   rate limiting on sensitive endpoints
-   login throttling/brute-force protection
-   safe file upload validation
-   file type/size limits
-   server-side ownership checks
-   environment secrets
-   no credentials committed to source control

Never trust:

-   client-provided roles
-   client-provided ownership
-   client-provided prices without validation
-   client-provided file metadata
-   hidden UI fields as authorization

------------------------------------------------------------------------

# 37. File Upload Security

For property images/media:

-   validate file type
-   validate file size
-   validate content where practical
-   use provider-side transformations
-   avoid trusting arbitrary extensions
-   enforce reasonable per-listing limits
-   generate optimized delivery formats where supported

------------------------------------------------------------------------

# 38. Testing

The project must include automated tests.

At minimum:

### Unit tests

For:

-   business rules
-   price/currency conversion
-   listing state transitions
-   permissions
-   validation
-   domain services

### Integration/API tests

For:

-   authentication
-   authorization
-   listing CRUD
-   agent assignment
-   approval workflow
-   inquiries
-   profile change approval

### E2E tests

Cover critical flows:

1.  Private seller registers and verifies email.
2.  Private seller creates a listing and uploads at least three valid images.
3.  Private seller submits listing.
4.  Admin reviews, rejects, and provides a reason.
5.  Private seller updates/resubmits.
6.  Admin approves; listing appears publicly.
7.  Prospective agent submits an application with supporting proof.
8.  Admin approves or rejects the agent application; an approved applicant completes account setup.
9.  Approved agent creates/submits a listing and receives the same manual listing review.
11. Visitor searches/filter listings.
12. Visitor opens listing.
13. Visitor submits inquiry.
14. Agent sees inquiry.
15. Admin can assign listing.
16. Agent cannot access another agent's listing.

------------------------------------------------------------------------

# 39. Validation

Use shared schemas wherever practical.

Listing submission must fail if required data is missing.

At minimum, publication/review submission requires:

-   authenticated active account
-   verified email address
-   advertiser is the listing creator or otherwise explicitly authorized
-   valid property type
-   valid transaction type
-   valid location
-   valid price if price is supplied
-   minimum 3 valid images meeting configured file type, size, and dimension limits
-   required property attributes
-   valid advertiser contact information
-   assigned agent only when explicitly required by an approved business rule; private-seller listings do not require an assigned agent

The exact set of required attributes may depend on property type.

Required for review submission:

| Applies to | Required |
|---|---|
| All property types | property type; transaction type; Serbian title and description; country; city; street and street number; map location (latitude/longitude); at least 3 valid images |
| All types except `LAND` | floor area (m²) |
| `LAND` | plot area (m²) |
| `APARTMENT`, `HOUSE`, `VILLA` | number of bedrooms and bathrooms |
| `APARTMENT` | floor and total number of floors (floor may not exceed total floors) |

If a fixed price is supplied it must be valid: a positive amount and a currency, with a rental period for `RENT` listings and no rental period for `SALE` listings. Contact information comes from the advertiser's verified account.

------------------------------------------------------------------------

# 40. Error Handling

Use consistent API error responses.

Errors should distinguish:

-   validation failure
-   authentication failure
-   authorization failure
-   resource not found
-   invalid state transition
-   conflict
-   external service failure
-   unexpected server failure

Do not leak stack traces or internal implementation details to public
clients.

------------------------------------------------------------------------

# 41. Logging

Use structured server-side logging.

Do not log:

-   passwords
-   authentication secrets
-   session tokens
-   sensitive personal data unnecessarily

Important business events should be identifiable in logs.

------------------------------------------------------------------------

# 42. Environment Configuration

All environment-specific configuration must use environment variables.

Examples:

``` text
DATABASE_URL
SESSION_SECRET
CLOUDINARY_*
RESEND_API_KEY
EXCHANGE_RATE_PROVIDER
```

Provide:

``` text
.env.example
```

Never commit actual credentials.

------------------------------------------------------------------------

# 43. MVP Scope

The MVP includes:

-   public property browsing
-   private-seller registration and email verification
-   private-seller dashboard and public profile pages
-   separate real-estate agent application with supporting proof and admin approval
-   public phone verification-status labels (no phone verification flow)
-   property search
-   filtering
-   sorting
-   property detail pages
-   public agent pages
-   listing creation
-   listing editing
-   listing approval workflow
-   agent assignment
-   admin management
-   super-admin management
-   authentication
-   approved-agent account setup/invitation email
-   agent application review
-   profile change approval
-   media uploads
-   map display
-   inquiries
-   email notifications
-   EUR/RSD conversion
-   basic analytics
-   audit logging
-   Serbian/English
-   SEO
-   responsive design

------------------------------------------------------------------------

# 44. Explicitly Out of Scope for MVP

Do NOT implement unless explicitly requested later:

-   payment processing
-   online property purchase
-   rental contract generation
-   escrow
-   buyer-only accounts
-   favorites
-   saved searches
-   Google login
-   Microsoft login
-   MFA
-   map-based search
-   full CRM
-   advanced marketing automation
-   advanced BI/reporting
-   automated property valuation
-   AI-generated property valuations
-   mortgage integrations
-   electronic signatures
-   booking/calendar system
-   chat/messaging between users
-   mobile native apps

The architecture should not prevent these features from being added
later.

------------------------------------------------------------------------

# 45. Future Extensibility

Design clean extension points for:

-   Google authentication
-   MFA
-   buyer-only accounts
-   favorites
-   saved searches
-   push notifications
-   additional currencies
-   additional languages
-   additional map providers
-   additional media providers
-   additional email providers
-   advanced analytics
-   CRM capabilities
-   property valuation
-   additional roles

Do not prematurely implement these features.

------------------------------------------------------------------------

# 46. Acceptance Criteria

## Public Website

-   Visitor can browse published listings.
-   Visitor cannot see drafts, rejected, archived, sold, or rented
    listings.
-   Visitor can search and filter listings.
-   Visitor can sort results.
-   Visitor can open a property detail page.
-   Visitor can see the listing advertiser (private seller or agent) and any assigned agent, where applicable.
-   Visitor can open public profile pages for both private sellers and approved agents.
-   Visitor can contact the listing advertiser.
-   Visitor can see the exact map location only when permitted.
-   Visitor can switch EUR/RSD display.
-   Visitor can browse agent profiles.
-   Website is responsive.

## Private Seller

-   User can register with email/password.
-   A private seller account becomes active after email verification.
-   Public registration cannot assign the agent role.
-   Private seller can create, edit, submit, and manage their own listings.
-   Private seller must provide at least three valid images before submission.
-   Private seller cannot publish directly.
-   Private seller can see rejection reasons and resubmit rejected listings.
-   Private seller has a public profile page showing their public listings.
-   Public contact details clearly show whether the phone number is verified; phone verification is not required for MVP.
-   Private seller cannot access or manage another user's listings.

## Agent

-   Prospective agent applies through the separate “For real-estate agents” flow.
-   Application requires professional details and supporting proof.
-   Agent account/profile is not active until Admin/Super Admin approval.
-   Agent can authenticate after completing approved account setup.
-   Agent can edit permitted profile fields.
-   Agent can create and manage listings they are authorized to advertise, subject to assignment/authorization rules.
-   Agent must provide at least three valid images before submission.
-   Agent cannot publish directly.
-   Agent can see rejection reasons and resubmit rejected listings.
-   Agent can see inquiries for their listings.
-   Public agent profile clearly distinguishes professional approval from phone verification status.

## Admin

-   Admin can authenticate.
-   Admin can review, approve, or reject agent applications and supporting proof.
-   Admin can manage approved agents.
-   Admin can assign listings.
-   Admin can review listings.
-   Admin can approve/reject listings.
-   Admin can provide rejection reasons.
-   Admin can manage all inquiries.
-   Admin can feature listings.
-   Admin can deactivate private-seller and agent accounts; a reason is required, the action is audit-logged, and the user is notified by email.
-   Admin cannot permanently delete listings.
-   Admin cannot manage Super Admins.

## Super Admin

-   Super Admin can perform all Admin actions.
-   Super Admin can manage administrators.
-   Super Admin can deactivate Admin accounts, with a reason.
-   Super Admin can permanently delete archived listings where
    permitted.

------------------------------------------------------------------------

# 47. Development Process for AI Agents

Before modifying code:

1.  Inspect the repository.
2.  Identify existing applications/packages.
3.  Inspect package manager and scripts.
4.  Inspect existing database configuration.
5.  Inspect existing authentication.
6.  Inspect existing design system.
7.  Inspect environment configuration.
8.  Identify conflicts with this specification.

Do not overwrite an existing architecture blindly.

If the repository is empty, scaffold according to this specification.

Before substantial implementation, produce a concise implementation plan
covering:

-   architecture
-   database
-   API
-   frontend
-   authentication
-   testing
-   deployment

Then implement incrementally.

------------------------------------------------------------------------

# 48. Source of Truth

When requirements conflict:

1.  Explicit user decisions in this specification win.
2.  Security and data-integrity requirements win over convenience.
3.  Existing repository constraints should be preserved where
    compatible.
4.  Technical implementation details may be chosen by the agent.
5.  Product/business behavior MUST NOT be invented when unspecified.

If an important product decision is genuinely missing, stop and ask
rather than silently inventing business behavior.

------------------------------------------------------------------------

# 49. Agent Decision Boundary

The coding agent MAY decide:

-   component organization
-   internal function names
-   repository implementation details
-   exact API URL naming conventions
-   internal utility organization
-   test helper structure
-   exact CSS implementation
-   appropriate database indexes
-   minor implementation optimizations

The coding agent MUST NOT independently decide:

-   roles
-   permissions
-   listing lifecycle
-   property/listing relationship
-   transaction types
-   property types
-   pricing model
-   currency behavior
-   public address visibility rules
-   media minimum
-   inquiry behavior
-   authentication scope
-   MVP scope
-   deletion behavior
-   deployment architecture
-   whether a feature should be added to MVP
