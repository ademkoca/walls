-- listings.created_by_id records who created the listing and must never change (SPEC §5).
CREATE FUNCTION prevent_listing_creator_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.created_by_id IS DISTINCT FROM OLD.created_by_id THEN
    RAISE EXCEPTION 'listings.created_by_id is immutable'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER listings_created_by_immutable
  BEFORE UPDATE OF created_by_id ON listings
  FOR EACH ROW EXECUTE FUNCTION prevent_listing_creator_change();--> statement-breakpoint

-- Amenity catalogue (SPEC §10). Reference data needed in every environment.
-- Labels are translated in the web app; codes are stable identifiers.
INSERT INTO amenities (code, sort_order) VALUES
  ('ELEVATOR', 10),
  ('AIR_CONDITIONING', 20),
  ('CENTRAL_HEATING', 30),
  ('FURNISHED', 40),
  ('BALCONY', 50),
  ('TERRACE', 60),
  ('GARDEN', 70),
  ('PARKING', 80),
  ('GARAGE', 90),
  ('SECURITY_SYSTEM', 100),
  ('INTERNET', 110),
  ('PETS_ALLOWED', 120),
  ('SMOKING_ALLOWED', 130);
