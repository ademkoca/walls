-- Heating type and furnished status are structured property fields (SPEC §10), so the
-- yes/no amenities they replace are removed from the catalogue.
DELETE FROM property_amenities WHERE amenity_code IN ('CENTRAL_HEATING', 'FURNISHED');--> statement-breakpoint
DELETE FROM amenities WHERE code IN ('CENTRAL_HEATING', 'FURNISHED');
