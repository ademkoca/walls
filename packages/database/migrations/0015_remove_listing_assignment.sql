-- Listings belong to their creators: Admins no longer assign agents (decision 2026-10-30).
-- Inquiries an assigned agent received move to the listing's creator, who now manages them.
UPDATE "inquiries" SET "recipient_user_id" = "listings"."created_by_id"
FROM "listings"
WHERE "listings"."id" = "inquiries"."listing_id"
  AND "inquiries"."recipient_user_id" <> "listings"."created_by_id";--> statement-breakpoint
DROP TABLE "listing_assignments" CASCADE;--> statement-breakpoint
ALTER TABLE "listings" DROP CONSTRAINT "listings_assigned_agent_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "inquiries" DROP CONSTRAINT "inquiries_assigned_agent_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "listings_assigned_agent_id_index";--> statement-breakpoint
ALTER TABLE "listings" DROP COLUMN "assigned_agent_id";--> statement-breakpoint
ALTER TABLE "inquiries" DROP COLUMN "assigned_agent_id";
