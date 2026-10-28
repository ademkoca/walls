#!/usr/bin/env bash
# Deploys one version of Walls to one environment on the VPS. Run by
# .github/workflows/deploy-vps.yml as the deploy user, after it has copied this file,
# compose.yaml and the caddy/ files to /opt/walls:
#   deploy.sh <production|staging> <version> <registry user>   (registry token on stdin)
# Starts Caddy if needed and applies its configuration, then pulls the environment's images,
# applies its migrations, starts the new containers and waits until they are healthy. If they
# don't become healthy, the previous version is started again.
set -euo pipefail

environment=${1:?environment (production or staging)}
version=${2:?version (commit SHA)}
registry_user=${3:?registry user}
[[ $environment == production || $environment == staging ]] ||
  { echo "Unknown environment: $environment" >&2; exit 1; }

# First, while the registry token is still unread on stdin.
docker login ghcr.io --username "$registry_user" --password-stdin > /dev/null
trap 'docker logout ghcr.io > /dev/null' EXIT

# Caddy serves every environment; a configuration change is applied without dropping
# connections, and the container is recreated only when caddy/compose.yaml changed.
cd /opt/walls/caddy
docker compose up --detach --wait --wait-timeout 60
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile < /dev/null

cd "/opt/walls/$environment"
cp ../compose.yaml compose.yaml

previous=$(sed -n 's/^WALLS_VERSION=//p' .env)
export WALLS_VERSION=$version

docker compose pull --quiet web api
docker compose run --rm migrate

if ! docker compose up --detach --wait --wait-timeout 180 --remove-orphans; then
  echo "Version $version did not become healthy in $environment." >&2
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
# Removes images no container uses that are older than a week (newer ones allow a rollback).
docker image prune --all --force --filter until=168h > /dev/null
echo "Deployed $version to $environment."
