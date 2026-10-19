// Applies pending migrations to DATABASE_URL. Built as dist/migrate.mjs so a production
// image can migrate without the development tools that `pnpm db:migrate` needs; the image
// keeps the SQL files in `migrations/` next to `dist/`.
import '@walls/database/apply-migrations';
