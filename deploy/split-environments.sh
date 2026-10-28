#!/usr/bin/env bash
# One-time move of the VPS from one environment (preview.walls.rs in /opt/walls) to production
# and staging (deploy/README.md, "Server layout"), run as root:
#   ssh <admin user>@<server> 'sudo bash -s' < deploy/split-environments.sh
# Stops the old stack and turns its settings into staging's: its api.env (database, photos,
# secrets) becomes staging/api.env unchanged. Creates caddy/.env, staging/.env and an empty
# production/.env and production/api.env to fill in. Starts nothing: the next deploy of each
# environment does. preview.walls.rs is down until staging's deploy.
set -euo pipefail

APP_DIR=/opt/walls
cd "$APP_DIR"
if [[ -d staging ]]; then
  echo "$APP_DIR is already split into environments." >&2
  exit 1
fi

old() { sed -n "s/^$1=//p" .env; }
acme_email=$(old ACME_EMAIL)
image_prefix=$(old IMAGE_PREFIX)

echo '== Stopping the old stack'
# By its Compose project name: a deploy may already have replaced compose.yaml with the new one.
(cd / && sudo -u deploy docker compose --project-name walls down)
# Caddy's certificates move to a new volume; Caddy obtains them again on its first start.
docker volume rm walls_caddy-data walls_caddy-config > /dev/null || true

echo '== Folders'
for dir in caddy production staging; do
  install -d -m 750 -o deploy -g deploy "$dir"
done
mv api.env staging/api.env

write_env() { # file, content
  install -m 600 -o deploy -g deploy /dev/null "$1"
  printf '%s\n' "$2" > "$1"
}
write_env caddy/.env "PRODUCTION_HOST=walls.rs
STAGING_HOST=preview.walls.rs
ACME_EMAIL=$acme_email"
write_env staging/.env "WALLS_ENVIRONMENT=staging
WEB_PORT=3001
API_PORT=4001
WEB_MEMORY=512m
API_MEMORY=384m
IMAGE_PREFIX=$image_prefix
WALLS_VERSION="
write_env production/.env "WALLS_ENVIRONMENT=production
WEB_PORT=3000
API_PORT=4000
WEB_MEMORY=1g
API_MEMORY=768m
IMAGE_PREFIX=$image_prefix
WALLS_VERSION="
write_env production/api.env ''

# The deploy workflow copies the new files; the old single-stack ones go.
rm -f compose.yaml Caddyfile .env deploy.sh
echo 'Done. Fill in production/api.env, then deploy staging and production.'
