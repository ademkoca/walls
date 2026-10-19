# Deploying Walls to the VPS

The web app and the API run on one netcup VPS (Debian 13) with Docker Compose. Caddy serves
HTTPS and sends `/api/*` to the API and everything else to the web app. The database
(Supabase), photos (Cloudinary) and email (Resend) stay with their providers, so the server
keeps no data of its own and can be rebuilt from this repository.

```text
visitor ──HTTPS──▶ Caddy (host network, :80/:443)
                     ├── /api/*  ──▶ api  (127.0.0.1:4000) ──▶ Supabase, Cloudinary, Resend
                     └── other   ──▶ web  (127.0.0.1:3000) ──▶ api (server-side rendering)
```

| File | Purpose |
| --- | --- |
| `compose.yaml` | The containers: `caddy`, `web`, `api`, and `migrate` (one-off) |
| `Caddyfile` | HTTPS, HSTS, compression, upload size limit, routing |
| `deploy.sh` | Runs on the server for every deploy (pull, migrate, start, health check) |
| `setup-server.sh` | One-time server setup (users, swap, Docker, updates, firewall) |
| `harden-ssh.sh` | Allows only SSH key logins by the admin and deploy users |
| `env.example` | Template for `/opt/walls/.env` (Compose values, not secret) |
| `api.env.example` | Template for `/opt/walls/api.env` (the API's secrets) |

## How a deploy works

`.github/workflows/deploy-vps.yml` runs after CI passes on `main` (or by hand: Actions →
Deploy (VPS) → Run workflow):

1. Builds `ghcr.io/ademkoca/walls-api` and `walls-web` tagged with the commit SHA and pushes
   them to GitHub's container registry. The web image has the site URL compiled in.
2. Copies `compose.yaml`, `Caddyfile` and `deploy.sh` to `/opt/walls` as the `deploy` user.
3. Runs `deploy.sh`: pulls the images with a registry token that expires with the job,
   applies migrations, starts the new containers and waits until they report healthy. If they
   don't, it starts the previous version again and the workflow fails.

The API trusts exactly one proxy (`TRUST_PROXY_HOPS=1`): Caddy replaces any `X-Forwarded-For`
a visitor sends, so rate limits use the visitor's real address. Caddy runs on the host network
because Docker's port publishing would hide IPv6 visitors' addresses.

## Server layout

- Users: the admin user (SSH key, passwordless sudo, Docker) and `deploy` (Docker only, used by
  GitHub Actions). Root and password logins are disabled; netcup's web console with the root
  password is the way in if SSH is ever locked out.
- `/opt/walls` (owned by `deploy`): the files above, `.env` and `api.env` (mode 600).
- Firewall (ufw): SSH, 80/tcp, 443/tcp and 443/udp only.
- Debian and Docker security updates install automatically; when one needs a restart, the
  server restarts at 03:00 UTC and the containers start again on their own.
- 2 GB swap; container logs are capped at 5 × 10 MB per container.

## GitHub settings

Settings → Environments → `production`, secrets:

- `VPS_HOST`: the server's IPv4 address.
- `VPS_SSH_KEY`: the private key whose public half is in `/home/deploy/.ssh/authorized_keys`.
- `VPS_KNOWN_HOSTS`: output of `ssh-keyscan -t ed25519 <host>`, checked against the server.

Settings → Secrets and variables → Actions → Variables (compiled into the web image):

- `SITE_URL`: the public origin, e.g. `https://preview.walls.rs`.
- `SITE_INDEXING`: `off` while on a preview host, otherwise empty.
- `MAP_TILE_URL`, `MAP_ATTRIBUTION`: optional, as `NEXT_PUBLIC_MAP_*` in `.env.example`.

## Everyday commands

Log in with `ssh walls-vps`, then in `/opt/walls`:

```text
sudo -u deploy docker compose ps                  # containers and their health
sudo -u deploy docker compose logs -f api         # follow the API log (also: web, caddy)
sudo -u deploy docker compose restart api         # restart one container
sudo -u deploy docker compose run --rm migrate    # apply migrations by hand
```

Roll back to an earlier version (its images must still be on the server; unused images are
kept for a week):

```text
sudo -u deploy WALLS_VERSION=<commit SHA> docker compose up -d --wait
```

Then set `WALLS_VERSION` in `.env` to that SHA so later manual commands use it. Migrations
are not rolled back.

To change a secret, edit `api.env` (`sudo -u deploy nano /opt/walls/api.env`) and run
`sudo -u deploy docker compose up -d api`.

## Setting up a new server

1. Order Debian 13, add your SSH key for root, and change the emailed root password.
2. `ssh root@<server> 'bash -s' -- <admin user> < deploy/setup-server.sh`
3. Check `ssh <admin user>@<server>` works, then
   `ssh <admin user>@<server> 'sudo bash -s' -- <admin user> < deploy/harden-ssh.sh`.
4. Create a key pair for GitHub Actions, put the public half in
   `/home/deploy/.ssh/authorized_keys`, and fill in the GitHub settings above.
5. Fill in `/opt/walls/.env` and `/opt/walls/api.env` from the examples (same
   `SESSION_SECRET` as before, or everyone is signed out).
6. Point DNS (A and AAAA records) at the server, then run the deploy workflow. Caddy obtains
   the certificate once DNS points at the server.
