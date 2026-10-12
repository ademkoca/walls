-- Accent-insensitive search (SPEC §17): "vracar" finds "Vračar". unaccent() is only STABLE,
-- so this IMMUTABLE wrapper (fixed dictionary, fixed search_path) lets generated columns and
-- indexes use it. Supabase installs extensions in the "extensions" schema; locally they are
-- in "public".
CREATE FUNCTION walls_unaccent(text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
SET search_path = public, extensions, pg_catalog
AS $$ SELECT unaccent('unaccent', $1) $$;
