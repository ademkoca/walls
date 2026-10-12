CREATE TABLE "listing_view_visitors" (
	"listing_id" uuid NOT NULL,
	"day" date NOT NULL,
	"visitor_hash" text NOT NULL,
	CONSTRAINT "listing_view_visitors_listing_id_day_visitor_hash_pk" PRIMARY KEY("listing_id","day","visitor_hash")
);
--> statement-breakpoint
ALTER TABLE "listing_view_visitors" ADD CONSTRAINT "listing_view_visitors_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_view_visitors_day_index" ON "listing_view_visitors" USING btree ("day");