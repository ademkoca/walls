-- Utilities and permits offered mainly for land (SPEC §10). Codes match `Amenity` in
-- @walls/shared; sort order continues the existing catalogue.
INSERT INTO amenities (code, sort_order) VALUES
  ('ELECTRICITY', 140),
  ('WATER', 150),
  ('SEWAGE', 160),
  ('GAS_CONNECTION', 170),
  ('ROAD_ACCESS', 180),
  ('BUILDING_PERMIT', 190);
