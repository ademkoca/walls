#!/usr/bin/env bash
# Deploys one version of Walls on the VPS. Run by .github/workflows/deploy-vps.yml as the
# deploy user, after it has copied this file, compose.yaml and Caddyfile to /opt/walls:
#   deploy.sh <version> <registry user>   (registry token on stdin)
# Pulls the images, applies migrations, starts the new containers and waits until they are
# healthy. If they don't become healthy, the previous version is started again.
set -euo pipefail

version=${1:?version (commit SHA)}
registry_user=${2:?registry user}
cd /opt/walls

docker login ghcr.io --username "$registry_user" --password-stdin > /dev/null
trap 'docker logout ghcr.io > /dev/null' EXIT

previous=$(sed -n 's/^WALLS_VERSION=//p' .env)
export WALLS_VERSION=$version

docker compose pull --quiet web api
docker compose run --rm migrate

if ! docker compose up --detach --wait --wait-timeout 180 --remove-orphans; then
  echo "Version $version did not become healthy." >&2
  if [[ -n $previous && $previous != "$version" ]]; then
    echo "Starting the previous version $previous again." >&2
    WALLS_VERSION=$previous docker compose up --detach --wait --wait-timeout 180
  fi
  exit 1
fi

# Recorded only now, so manual `docker compose` commands use the running version.
if grep -q '^WALLS_VERSION=' .env; then
  sed -i "s/^WALLS_VERSION=.*/WALLS_VERSION=$version/" .env
else
  echo "WALLS_VERSION=$version" >> .env
fi
# Applies Caddyfile changes without dropping connections.
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
# Removes images no container uses that are older than a week (newer ones allow a rollback).
docker image prune --all --force --filter until=168h > /dev/null
echo "Deployed $version."
