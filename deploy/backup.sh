#!/usr/bin/env bash
# Nightly database backup with a restore test (deploy/README.md, "Backups"). Runs as the deploy
# user from the walls-backup systemd timer.
#  1. Dumps the Walls schemas (public, drizzle) from DATABASE_URL in api.env.
#  2. Encrypts the dump with age and stores it (daily/, and monthly/ on the 1st): in the
#     Cloudflare R2 bucket when backup.env has R2 settings, otherwise in archive/ on this server.
#  3. Reads the stored copy back, decrypts it and restores it into a throwaway Postgres
#     container, then checks that every table and the migration history came back with their rows.
#  4. Deletes daily backups after 30 days and monthly ones after a year.
#  5. Reports start, success or failure to healthchecks.io, which emails if a night is missed.
set -euo pipefail
# Backups and temporary dumps are readable by the deploy user only.
umask 077

APP_DIR=/opt/walls
BACKUP_DIR=$APP_DIR/backup
AGE_KEY=$BACKUP_DIR/age-key.txt
RESTORE_IMAGE=postgres:17-alpine
RESTORE_CONTAINER=walls-restore-test
ARCHIVE_DIR=$BACKUP_DIR/archive
DAILY_KEEP_DAYS=30
MONTHLY_KEEP_DAYS=365

# Only DATABASE_URL is needed from the API's settings.
database_url=$(bash -c "set -a; . $APP_DIR/api.env; printf '%s' \"\$DATABASE_URL\"")
set -a
# shellcheck source=/dev/null
. "$BACKUP_DIR/backup.env"
set +a
[[ -n ${R2_ENDPOINT:-} ]] && storage=r2 || storage=server

# rclone reads the R2 remote from these variables; no config file.
export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID:-}
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY:-}
export RCLONE_CONFIG_R2_ENDPOINT=${R2_ENDPOINT:-}
# The token may only use this bucket, so rclone must not try to create or list buckets.
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true

work=$(mktemp -d "$BACKUP_DIR/work.XXXXXX")
log=$work/backup.log
exec > >(tee "$log") 2>&1

ping_healthcheck() { # "" | /start | /fail, with the log as the body
  [[ -n ${HEALTHCHECK_URL:-} ]] || return 0
  curl -fsS -m 10 --retry 3 --data-binary "@$log" "$HEALTHCHECK_URL$1" > /dev/null || true
}

finish() {
  local status=$?
  docker rm -f "$RESTORE_CONTAINER" > /dev/null 2>&1 || true
  if ((status == 0)); then
    ping_healthcheck ''
  else
    echo "Backup FAILED (exit $status)."
    ping_healthcheck /fail
  fi
  rm -rf "$work"
}
trap finish EXIT
ping_healthcheck /start

name=walls-$(date -u +%Y-%m-%dT%H%MZ).dump.age
echo "== $name"

# Row count of every Walls table, one "table count" line each, in a fixed order.
counts_sql="SELECT table_schema || '.' || table_name || ' ' || (xpath('/row/c/text()',
  query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]
  FROM information_schema.tables
  WHERE table_schema IN ('public', 'drizzle') AND table_type = 'BASE TABLE'
  ORDER BY 1"

echo '1/4 Dumping'
# Sorted in byte order for `join` below (the database may sort differently).
export LC_ALL=C
psql "$database_url" -X -A -t -v ON_ERROR_STOP=1 -c "$counts_sql" | sort > "$work/source-counts"
# A dump limited to schemas leaves out extensions, so name the ones the Walls tables use
# (installed in public by the migrations, e.g. citext).
mapfile -t extensions < <(psql "$database_url" -X -A -t -v ON_ERROR_STOP=1 -c \
  "SELECT e.extname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
   WHERE n.nspname = 'public' ORDER BY 1")
pg_dump "$database_url" --format=custom --schema=public --schema=drizzle \
  "${extensions[@]/#/--extension=}" --no-owner --no-privileges --file="$work/walls.dump"
echo "    $(wc -l < "$work/source-counts") tables, extensions: ${extensions[*]}, dump $(du -h "$work/walls.dump" | cut -f1)"

echo "2/4 Encrypting and storing ($storage)"
age --encrypt --recipient "$(age-keygen -y "$AGE_KEY")" --output "$work/$name" "$work/walls.dump"
rm "$work/walls.dump"
monthly=false
[[ $(date -u +%d) == 01 ]] && monthly=true
# The restore test reads the stored copy back, so it also proves the stored file is intact.
if [[ $storage == r2 ]]; then
  rclone copyto "$work/$name" "r2:$R2_BUCKET/daily/$name"
  [[ $monthly == false ]] || rclone copyto "r2:$R2_BUCKET/daily/$name" "r2:$R2_BUCKET/monthly/$name"
  rclone copyto "r2:$R2_BUCKET/daily/$name" "$work/stored.age"
else
  install -d -m 700 "$ARCHIVE_DIR/daily" "$ARCHIVE_DIR/monthly"
  cp "$work/$name" "$ARCHIVE_DIR/daily/$name"
  [[ $monthly == false ]] || cp "$work/$name" "$ARCHIVE_DIR/monthly/$name"
  cp "$ARCHIVE_DIR/daily/$name" "$work/stored.age"
fi

echo '3/4 Restore test'
age --decrypt --identity "$AGE_KEY" --output "$work/restored.dump" "$work/stored.age"
docker rm -f "$RESTORE_CONTAINER" > /dev/null 2>&1 || true
docker run --detach --name "$RESTORE_CONTAINER" --network none \
  --env POSTGRES_PASSWORD=restore-test --tmpfs /var/lib/postgresql/data:size=2g \
  "$RESTORE_IMAGE" > /dev/null
# The image's first start runs a temporary server on the socket only; the real one listens on TCP.
for _ in $(seq 1 60); do
  docker exec "$RESTORE_CONTAINER" pg_isready -q -h 127.0.0.1 -U postgres && break
  sleep 1
done
restore_psql() { docker exec -i "$RESTORE_CONTAINER" psql -h 127.0.0.1 -U postgres -X -A -t -v ON_ERROR_STOP=1 "$@"; }
# The same command restores into a new database in an emergency (deploy/README.md). --clean
# replaces the empty public schema every new database has; the dump creates it again.
docker exec -i "$RESTORE_CONTAINER" pg_restore -h 127.0.0.1 -U postgres --dbname=postgres \
  --clean --if-exists --no-owner --no-privileges --exit-on-error < "$work/restored.dump"
restore_psql -c "$counts_sql" | sort > "$work/restored-counts"

# Rows written while the dump ran may differ by a few; a missing table or an empty copy of a
# non-empty table means the backup is broken.
broken=$(join -a 1 -e MISSING -o 0,1.2,2.2 "$work/source-counts" "$work/restored-counts" |
  awk '$3 == "MISSING" || ($2 > 0 && $3 == 0)')
if [[ -n $broken ]]; then
  echo "Restore test failed (table, rows in database, rows restored):"
  echo "$broken"
  exit 1
fi
changed=$(join "$work/source-counts" "$work/restored-counts" | awk '$2 != $3')
echo "    restored $(wc -l < "$work/restored-counts") tables, $(awk '{s += $2} END {print s}' "$work/restored-counts") rows"
[[ -z $changed ]] || echo "    changed during the backup (database, restored): $changed"

echo '4/4 Removing old backups'
if [[ $storage == r2 ]]; then
  rclone delete "r2:$R2_BUCKET/daily" --min-age "${DAILY_KEEP_DAYS}d"
  rclone delete "r2:$R2_BUCKET/monthly" --min-age "${MONTHLY_KEEP_DAYS}d"
  echo "    in R2: $(rclone lsf "r2:$R2_BUCKET/daily" | wc -l) daily, $(rclone lsf "r2:$R2_BUCKET/monthly" | wc -l) monthly"
else
  find "$ARCHIVE_DIR/daily" -name '*.dump.age' -mtime +$((DAILY_KEEP_DAYS - 1)) -delete
  find "$ARCHIVE_DIR/monthly" -name '*.dump.age' -mtime +$((MONTHLY_KEEP_DAYS - 1)) -delete
  echo "    on this server: $(find "$ARCHIVE_DIR/daily" -name '*.dump.age' | wc -l) daily, $(find "$ARCHIVE_DIR/monthly" -name '*.dump.age' | wc -l) monthly ($(du -sh "$ARCHIVE_DIR" | cut -f1))"
fi
echo "Backup OK: $name"
