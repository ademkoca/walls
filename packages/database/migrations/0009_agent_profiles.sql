CREATE TABLE "profile_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "review_status" DEFAULT 'PENDING' NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"agency_name" text,
	"phone" text,
	"is_phone_public" boolean NOT NULL,
	"is_email_public" boolean NOT NULL,
	"avatar_storage_key" text,
	"avatar_url" text,
	"new_email" "citext",
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_change_requests_avatar_key_and_url" CHECK (("profile_change_requests"."avatar_storage_key" IS NULL) = ("profile_change_requests"."avatar_url" IS NULL)),
	CONSTRAINT "profile_change_requests_review_fields" CHECK (("profile_change_requests"."status" = 'PENDING') = ("profile_change_requests"."reviewed_at" IS NULL)),
	CONSTRAINT "profile_change_requests_rejection_reason" CHECK (("profile_change_requests"."status" = 'REJECTED') = ("profile_change_requests"."rejection_reason" IS NOT NULL))
);
--> statement-breakpoint
DROP INDEX "agent_application_files_application_id_index";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "agent_application_files" ADD COLUMN "position" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_applications" ADD COLUMN "locale" "locale" DEFAULT 'sr' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_change_requests" ADD CONSTRAINT "profile_change_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_change_requests" ADD CONSTRAINT "profile_change_requests_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_change_requests_user_id_created_at_index" ON "profile_change_requests" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "profile_change_requests_status_updated_at_index" ON "profile_change_requests" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_change_requests_one_pending_per_user" ON "profile_change_requests" USING btree ("user_id") WHERE "profile_change_requests"."status" = 'PENDING';--> statement-breakpoint
CREATE UNIQUE INDEX "agent_application_files_position" ON "agent_application_files" USING btree ("application_id","position");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_key_and_url" CHECK (("users"."avatar_storage_key" IS NULL) = ("users"."avatar_url" IS NULL));