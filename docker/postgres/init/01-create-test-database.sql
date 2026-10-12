-- Runs once, when the Postgres volume is first initialised.
-- Integration tests use a separate database so they never touch development data.
CREATE DATABASE walls_test OWNER walls;
