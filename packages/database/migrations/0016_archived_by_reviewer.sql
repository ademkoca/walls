-- Creators may archive and unarchive their own listings, except ones an Admin or Super Admin
-- archived (decision 2026-10-30). Until now only reviewers could archive, so every archived
-- listing was archived by one.
ALTER TABLE "listings" ADD COLUMN "archived_by_reviewer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "listings" SET "archived_by_reviewer" = true WHERE "status" = 'ARCHIVED';--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_archived_by_reviewer_only_when_archived" CHECK (NOT "listings"."archived_by_reviewer" OR "listings"."status" = 'ARCHIVED');
