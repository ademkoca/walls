CREATE TYPE "public"."auth_provider" AS ENUM('GOOGLE');--> statement-breakpoint
-- Google sign-in (SPEC §3.1). The token type is recreated rather than extended with
-- ALTER TYPE ... ADD VALUE: Drizzle applies all pending migrations in one transaction, and
-- Postgres refuses values added to an existing enum until that transaction commits, so the
-- check below could not use GOOGLE_LINK (as in 0014). The check on the column is dropped
-- while its type changes and added back unchanged.
ALTER TABLE "auth_tokens" DROP CONSTRAINT "auth_tokens_new_email_only_for_email_change";--> statement-breakpoint
ALTER TYPE "public"."auth_token_type" RENAME TO "auth_token_type_old";--> statement-breakpoint
CREATE TYPE "public"."auth_token_type" AS ENUM('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'ACCOUNT_SETUP', 'EMAIL_CHANGE', 'GOOGLE_LINK');--> statement-breakpoint
ALTER TABLE "auth_tokens" ALTER COLUMN "type" SET DATA TYPE "public"."auth_token_type" USING "type"::text::"public"."auth_token_type";--> statement-breakpoint
DROP TYPE "public"."auth_token_type_old";--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_new_email_only_for_email_change" CHECK (("auth_tokens"."type" = 'EMAIL_CHANGE') = ("auth_tokens"."new_email" IS NOT NULL));--> statement-breakpoint
CREATE TABLE "user_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "auth_provider" NOT NULL,
	"provider_user_id" text NOT NULL,
	"email" "citext" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD COLUMN "provider" "auth_provider";--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD COLUMN "provider_user_id" text;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD COLUMN "provider_email" "citext";--> statement-breakpoint
ALTER TABLE "user_sessions" ADD COLUMN "reauthenticated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_identities_provider_user" ON "user_identities" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_identities_one_per_provider" ON "user_identities" USING btree ("user_id","provider");--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_identity_only_for_google_link" CHECK (("auth_tokens"."type" = 'GOOGLE_LINK') = ("auth_tokens"."provider" IS NOT NULL)
        AND ("auth_tokens"."provider" IS NULL) = ("auth_tokens"."provider_user_id" IS NULL)
        AND ("auth_tokens"."provider" IS NULL) = ("auth_tokens"."provider_email" IS NULL));