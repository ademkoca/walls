CREATE TYPE "public"."currency" AS ENUM('EUR', 'RSD');--> statement-breakpoint
CREATE TYPE "public"."inquiry_status" AS ENUM('NEW', 'CONTACTED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'SOLD', 'RENTED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('sr', 'en');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('IMAGE', 'FLOOR_PLAN', 'VIDEO', 'VIRTUAL_TOUR');--> statement-breakpoint
CREATE TYPE "public"."phone_verification_status" AS ENUM('UNVERIFIED', 'VERIFIED');--> statement-breakpoint
CREATE TYPE "public"."price_mode" AS ENUM('FIXED', 'ON_REQUEST');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('APARTMENT', 'HOUSE', 'VILLA', 'OFFICE', 'RETAIL', 'WAREHOUSE', 'LAND', 'GARAGE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."rental_period" AS ENUM('DAY', 'WEEK', 'MONTH');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('SUPER_ADMIN', 'ADMIN', 'REAL_ESTATE_AGENT', 'PRIVATE_SELLER');--> statement-breakpoint
CREATE TYPE "public"."seller_type" AS ENUM('PRIVATE_SELLER', 'REAL_ESTATE_AGENT');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('SALE', 'RENT');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('PENDING_VERIFICATION', 'PENDING_SETUP', 'ACTIVE', 'DEACTIVATED');--> statement-breakpoint
CREATE TYPE "public"."auth_token_type" AS ENUM('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'ACCOUNT_SETUP', 'EMAIL_CHANGE');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('PENDING', 'SENT', 'FAILED');--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "auth_token_type" NOT NULL,
	"token_hash" text NOT NULL,
	"new_email" "citext",
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_tokens_tokenHash_unique" UNIQUE("token_hash"),
	CONSTRAINT "auth_tokens_new_email_only_for_email_change" CHECK (("auth_tokens"."type" = 'EMAIL_CHANGE') = ("auth_tokens"."new_email" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_sessions_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"password_hash" text,
	"role" "role" NOT NULL,
	"status" "user_status" NOT NULL,
	"email_verified_at" timestamp with time zone,
	"display_name" text NOT NULL,
	"slug" text NOT NULL,
	"bio" text,
	"avatar_storage_key" text,
	"agency_name" text,
	"phone" text,
	"phone_verification_status" "phone_verification_status" DEFAULT 'UNVERIFIED' NOT NULL,
	"is_phone_public" boolean DEFAULT false NOT NULL,
	"is_email_public" boolean DEFAULT false NOT NULL,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_slug_unique" UNIQUE("slug"),
	CONSTRAINT "users_deactivated_at_matches_status" CHECK (("users"."status" = 'DEACTIVATED') = ("users"."deactivated_at" IS NOT NULL)),
	CONSTRAINT "users_active_has_verified_email" CHECK ("users"."status" <> 'ACTIVE' OR "users"."email_verified_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "agent_application_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"original_file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_application_files_bytes" CHECK ("agent_application_files"."bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "agent_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" "citext" NOT NULL,
	"phone" text NOT NULL,
	"agency_name" text,
	"status" "review_status" DEFAULT 'PENDING' NOT NULL,
	"rejection_reason" text,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp with time zone,
	"resulting_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_applications_review_fields" CHECK (("agent_applications"."status" = 'PENDING') = ("agent_applications"."reviewed_at" IS NULL AND "agent_applications"."reviewed_by_id" IS NULL)),
	CONSTRAINT "agent_applications_rejection_reason" CHECK (("agent_applications"."status" = 'REJECTED') = ("agent_applications"."rejection_reason" IS NOT NULL)),
	CONSTRAINT "agent_applications_approved_has_user" CHECK (("agent_applications"."status" = 'APPROVED') = ("agent_applications"."resulting_user_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "amenities" (
	"code" text PRIMARY KEY NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_type" "property_type",
	"created_by_id" uuid NOT NULL,
	"floor_area" numeric(12, 2),
	"plot_area" numeric(12, 2),
	"bedrooms" smallint,
	"bathrooms" smallint,
	"floor" smallint,
	"total_floors" smallint,
	"year_built" smallint,
	"parking_spaces" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "properties_floor_area_positive" CHECK ("properties"."floor_area" > 0),
	CONSTRAINT "properties_plot_area_positive" CHECK ("properties"."plot_area" > 0),
	CONSTRAINT "properties_rooms_non_negative" CHECK ("properties"."bedrooms" >= 0 AND "properties"."bathrooms" >= 0),
	CONSTRAINT "properties_total_floors_positive" CHECK ("properties"."total_floors" >= 1),
	CONSTRAINT "properties_floor_within_total" CHECK ("properties"."floor" <= "properties"."total_floors"),
	CONSTRAINT "properties_parking_non_negative" CHECK ("properties"."parking_spaces" >= 0)
);
--> statement-breakpoint
CREATE TABLE "property_amenities" (
	"property_id" uuid NOT NULL,
	"amenity_code" text NOT NULL,
	CONSTRAINT "property_amenities_property_id_amenity_code_pk" PRIMARY KEY("property_id","amenity_code")
);
--> statement-breakpoint
CREATE TABLE "property_locations" (
	"property_id" uuid PRIMARY KEY NOT NULL,
	"country" char(2),
	"city" text,
	"municipality" text,
	"neighborhood" text,
	"postal_code" text,
	"street" text,
	"street_number" text,
	"latitude" double precision,
	"longitude" double precision,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "property_locations_latitude" CHECK ("property_locations"."latitude" BETWEEN -90 AND 90),
	CONSTRAINT "property_locations_longitude" CHECK ("property_locations"."longitude" BETWEEN -180 AND 180)
);
--> statement-breakpoint
CREATE TABLE "listing_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"agent_id" uuid,
	"assigned_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"type" "media_type" NOT NULL,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"sort_order" integer NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"alt_text" text,
	"mime_type" text,
	"bytes" integer,
	"width" integer,
	"height" integer,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_media_sort_order" CHECK ("listing_media"."sort_order" >= 0),
	CONSTRAINT "listing_media_bytes" CHECK ("listing_media"."bytes" > 0),
	CONSTRAINT "listing_media_dimensions" CHECK ("listing_media"."width" > 0 AND "listing_media"."height" > 0)
);
--> statement-breakpoint
CREATE TABLE "listing_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"from_status" "listing_status",
	"to_status" "listing_status" NOT NULL,
	"actor_id" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_texts" (
	"listing_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_texts_listing_id_locale_pk" PRIMARY KEY("listing_id","locale")
);
--> statement-breakpoint
CREATE TABLE "listing_views_daily" (
	"listing_id" uuid NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "listing_views_daily_listing_id_day_pk" PRIMARY KEY("listing_id","day"),
	CONSTRAINT "listing_views_daily_views" CHECK ("listing_views_daily"."views" >= 0)
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"seller_type" "seller_type" NOT NULL,
	"assigned_agent_id" uuid,
	"transaction_type" "transaction_type",
	"status" "listing_status" DEFAULT 'DRAFT' NOT NULL,
	"price_mode" "price_mode" DEFAULT 'ON_REQUEST' NOT NULL,
	"price_amount_minor" bigint,
	"price_currency" "currency",
	"price_period" "rental_period",
	"price_negotiable" boolean DEFAULT false NOT NULL,
	"is_exact_address_public" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"featured_until" timestamp with time zone,
	"slug" text,
	"rejection_reason" text,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listings_slug_unique" UNIQUE("slug"),
	CONSTRAINT "listings_price_shape" CHECK (("listings"."price_mode" = 'ON_REQUEST'
            AND "listings"."price_amount_minor" IS NULL AND "listings"."price_currency" IS NULL
            AND "listings"."price_period" IS NULL AND NOT "listings"."price_negotiable")
          OR ("listings"."price_mode" = 'FIXED'
            AND "listings"."price_amount_minor" IS NOT NULL AND "listings"."price_amount_minor" > 0
            AND "listings"."price_currency" IS NOT NULL)),
	CONSTRAINT "listings_rental_period_only_for_rent" CHECK ("listings"."price_period" IS NULL OR ("listings"."transaction_type" = 'RENT') IS TRUE),
	CONSTRAINT "listings_rejected_has_reason" CHECK ("listings"."status" <> 'REJECTED' OR "listings"."rejection_reason" IS NOT NULL),
	CONSTRAINT "listings_published_has_slug" CHECK ("listings"."status" NOT IN ('PUBLISHED', 'SOLD', 'RENTED', 'ARCHIVED') OR ("listings"."slug" IS NOT NULL AND "listings"."published_at" IS NOT NULL)),
	CONSTRAINT "listings_only_drafts_deleted" CHECK ("listings"."deleted_at" IS NULL OR "listings"."status" = 'DRAFT'),
	CONSTRAINT "listings_featured_until_requires_featured" CHECK ("listings"."featured_until" IS NULL OR "listings"."is_featured")
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"assigned_agent_id" uuid,
	"visitor_name" text NOT NULL,
	"visitor_email" "citext" NOT NULL,
	"visitor_phone" text,
	"message" text NOT NULL,
	"status" "inquiry_status" DEFAULT 'NEW' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template" text NOT NULL,
	"recipient_email" text NOT NULL,
	"locale" "locale" NOT NULL,
	"payload" jsonb,
	"status" "email_status" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_outbox_attempts" CHECK ("email_outbox"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base" "currency" NOT NULL,
	"quote" "currency" NOT NULL,
	"rate" numeric(20, 10) NOT NULL,
	"provider" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	CONSTRAINT "exchange_rates_positive" CHECK ("exchange_rates"."rate" > 0),
	CONSTRAINT "exchange_rates_distinct_currencies" CHECK ("exchange_rates"."base" <> "exchange_rates"."quote")
);
--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_application_files" ADD CONSTRAINT "agent_application_files_application_id_agent_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."agent_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_applications" ADD CONSTRAINT "agent_applications_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_applications" ADD CONSTRAINT "agent_applications_resulting_user_id_users_id_fk" FOREIGN KEY ("resulting_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_amenity_code_amenities_code_fk" FOREIGN KEY ("amenity_code") REFERENCES "public"."amenities"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_locations" ADD CONSTRAINT "property_locations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_assignments" ADD CONSTRAINT "listing_assignments_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_assignments" ADD CONSTRAINT "listing_assignments_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_assignments" ADD CONSTRAINT "listing_assignments_assigned_by_id_users_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_status_history" ADD CONSTRAINT "listing_status_history_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_status_history" ADD CONSTRAINT "listing_status_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_texts" ADD CONSTRAINT "listing_texts_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_views_daily" ADD CONSTRAINT "listing_views_daily_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_tokens_user_id_type_index" ON "auth_tokens" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "user_sessions_user_id_index" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sessions_expires_at_index" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "users_role_status_index" ON "users" USING btree ("role","status");--> statement-breakpoint
CREATE INDEX "agent_application_files_application_id_index" ON "agent_application_files" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "agent_applications_status_created_at_index" ON "agent_applications" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_applications_one_pending_per_email" ON "agent_applications" USING btree ("email") WHERE "agent_applications"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "properties_created_by_id_index" ON "properties" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "property_amenities_amenity_code_index" ON "property_amenities" USING btree ("amenity_code");--> statement-breakpoint
CREATE INDEX "property_locations_city_municipality_index" ON "property_locations" USING btree ("city","municipality");--> statement-breakpoint
CREATE INDEX "listing_assignments_listing_id_created_at_index" ON "listing_assignments" USING btree ("listing_id","created_at");--> statement-breakpoint
CREATE INDEX "listing_media_listing_id_sort_order_index" ON "listing_media" USING btree ("listing_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_media_one_primary_per_listing" ON "listing_media" USING btree ("listing_id") WHERE "listing_media"."is_primary";--> statement-breakpoint
CREATE INDEX "listing_status_history_listing_id_created_at_index" ON "listing_status_history" USING btree ("listing_id","created_at");--> statement-breakpoint
CREATE INDEX "listings_status_transaction_type_index" ON "listings" USING btree ("status","transaction_type");--> statement-breakpoint
CREATE INDEX "listings_property_id_index" ON "listings" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "listings_created_by_id_index" ON "listings" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "listings_assigned_agent_id_index" ON "listings" USING btree ("assigned_agent_id");--> statement-breakpoint
CREATE INDEX "listings_published_at_idx" ON "listings" USING btree ("published_at" DESC NULLS LAST) WHERE "listings"."status" = 'PUBLISHED';--> statement-breakpoint
CREATE INDEX "listings_featured_idx" ON "listings" USING btree ("featured_until") WHERE "listings"."is_featured" AND "listings"."status" = 'PUBLISHED';--> statement-breakpoint
CREATE INDEX "inquiries_recipient_user_id_status_created_at_index" ON "inquiries" USING btree ("recipient_user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "inquiries_listing_id_created_at_index" ON "inquiries" USING btree ("listing_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_index" ON "audit_logs" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_created_at_index" ON "audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "email_outbox_pending_idx" ON "email_outbox" USING btree ("next_attempt_at") WHERE "email_outbox"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "exchange_rates_base_quote_fetched_at_index" ON "exchange_rates" USING btree ("base","quote","fetched_at" DESC NULLS LAST);