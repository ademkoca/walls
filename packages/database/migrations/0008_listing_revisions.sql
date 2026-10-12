CREATE TABLE "listing_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"status" "review_status" DEFAULT 'PENDING' NOT NULL,
	"content" jsonb NOT NULL,
	"removed_media_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"updated_by_id" uuid NOT NULL,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_revisions_rejected_has_reason" CHECK ("listing_revisions"."status" <> 'REJECTED' OR "listing_revisions"."rejection_reason" IS NOT NULL),
	CONSTRAINT "listing_revisions_reviewed" CHECK (("listing_revisions"."status" = 'PENDING') = ("listing_revisions"."reviewed_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "listing_revisions" ADD CONSTRAINT "listing_revisions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_revisions" ADD CONSTRAINT "listing_revisions_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_revisions" ADD CONSTRAINT "listing_revisions_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_revisions_listing_id_created_at_index" ON "listing_revisions" USING btree ("listing_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_revisions_one_pending_per_listing" ON "listing_revisions" USING btree ("listing_id") WHERE "listing_revisions"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "listing_revisions_pending_idx" ON "listing_revisions" USING btree ("updated_at") WHERE "listing_revisions"."status" = 'PENDING';