-- Agencies and investors join agents as professional advertisers (SPEC §2.1, §5).
-- The enum is recreated rather than extended with ALTER TYPE ... ADD VALUE: Drizzle applies
-- all pending migrations in one transaction, and Postgres refuses values added to an existing
-- enum until that transaction commits, so the checks below could not use them.
ALTER TYPE "public"."seller_type" RENAME TO "seller_type_old";--> statement-breakpoint
CREATE TYPE "public"."seller_type" AS ENUM('PRIVATE_SELLER', 'REAL_ESTATE_AGENT', 'AGENCY', 'INVESTOR');--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "seller_type" SET DATA TYPE "public"."seller_type" USING "seller_type"::text::"public"."seller_type";--> statement-breakpoint
DROP TYPE "public"."seller_type_old";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "seller_type" "seller_type";--> statement-breakpoint
-- Every existing professional is an individual agent.
UPDATE "users" SET "seller_type" = CASE "role"
  WHEN 'PRIVATE_SELLER' THEN 'PRIVATE_SELLER'::"seller_type"
  WHEN 'REAL_ESTATE_AGENT' THEN 'REAL_ESTATE_AGENT'::"seller_type"
END;--> statement-breakpoint
ALTER TABLE "agent_applications" ADD COLUMN "seller_type" "seller_type";--> statement-breakpoint
UPDATE "agent_applications" SET "seller_type" = 'REAL_ESTATE_AGENT';--> statement-breakpoint
ALTER TABLE "agent_applications" ALTER COLUMN "seller_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_seller_type_matches_role" CHECK (CASE "users"."role"
        WHEN 'PRIVATE_SELLER' THEN "users"."seller_type" IS NOT DISTINCT FROM 'PRIVATE_SELLER'
        WHEN 'REAL_ESTATE_AGENT' THEN COALESCE("users"."seller_type" IN ('REAL_ESTATE_AGENT', 'AGENCY', 'INVESTOR'), false)
        ELSE "users"."seller_type" IS NULL
      END);--> statement-breakpoint
ALTER TABLE "agent_applications" ADD CONSTRAINT "agent_applications_professional_seller_type" CHECK ("agent_applications"."seller_type" IN ('REAL_ESTATE_AGENT', 'AGENCY', 'INVESTOR'));
