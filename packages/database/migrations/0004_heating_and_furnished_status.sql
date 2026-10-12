CREATE TYPE "public"."furnished_status" AS ENUM('FURNISHED', 'SEMI_FURNISHED', 'UNFURNISHED');--> statement-breakpoint
CREATE TYPE "public"."heating_type" AS ENUM('DISTRICT', 'INDIVIDUAL_CENTRAL', 'ELECTRIC', 'GAS', 'STORAGE_HEATERS', 'UNDERFLOOR', 'HEAT_PUMP', 'SOLID_FUEL', 'OTHER', 'NONE');--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "heating_type" "heating_type";--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "furnished_status" "furnished_status";