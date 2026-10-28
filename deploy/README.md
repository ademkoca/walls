# Deploying Walls to the VPS

Walls runs on one netcup VPS (Debian 13) with Docker Compose, in two environments:

- **production**, walls.rs (and www.walls.rs, which redirects): the real site.
- **staging**, preview.walls.rs: the demo and test site, with made-up listings (`pnpm demo:seed`)
  and a banner on every page saying it isn't the real Walls (`NEXT_PUBLIC_DEMO_SITE=on`). Safe
  to break: its data is disposable.

Each environment has its own database (Supabase project), photo storage (Cloudinary account),
secrets and containers; they share the server, Caddy and the Resend account (and so its daily
sending limit). Caddy serves HTTPS and sends each host's `/api/*` to that environment's API and
everything else to its web app. The databases, photos and email stay with their providers, so
the server keeps no data of its own and can be rebuilt from this repository.

```text
visitor ──HTTPS──▶ Caddy (host network, :80/:443)
                     ├── walls.rs          /api/* ──▶ api :4000 ─┐  production
                     │                     other  ──▶ web :3000 ─┘  ──▶ Supabase, Cloudinary (production)
                     ├── www.walls.rs      ──▶ redirect to walls.rs
                     └── preview.walls.rs  /api/* ──▶ api :4001 ─┐  staging
                                           other  ──▶ web :3001 ─┘  ──▶ Supabase, Cloudinary (staging)
```

| File | Purpose |
| --- | --- |
| `compose.yaml` | One environment: `web`, `api`, and `migrate` (one-off); used by both |
| `caddy/compose.yaml`, `caddy/Caddyfile` | Caddy: HTTPS, HSTS, compression, upload size limit, routing for every host |
| `deploy.sh` | Runs on the server for every deploy (Caddy, pull, migrate, start, health check) |
| `backup.sh` | Nightly encrypted backup of production's database with a restore test |
| `setup-server.sh` | One-time server setup (users, swap, Docker, updates, firewall, folders) |
| `harden-ssh.sh` | Allows only SSH key logins by the admin and deploy users |
| `setup-backups.sh` | One-time setup of the backup (tools, age key, settings, nightly timer) |
| `split-environments.sh` | One-time move from the single preview stack to production and staging |
| `env.example` | Template for `/opt/walls/<environment>/.env` (Compose values, not secret) |
| `api.env.example` | Template for `/opt/walls/<environment>/api.env` (the API's secrets) |
| `caddy/env.example` | Template for `/opt/walls/caddy/.env` (host names, ACME email) |

## How a deploy works

`.github/workflows/deploy-vps.yml` deploys one commit to one environment:

- **Staging:** automatically after CI passes on `main`. To try a branch on staging, start it by
  hand (Actions → Deploy (VPS) → Run workflow, choose the branch and `staging`); the next push
  to `main` deploys `main` over it.
- **Production:** only by hand (Run workflow on `main`, choose `production`), and only after
  you approve it in GitHub. It accepts only commits on `main` that passed CI, so try a commit
  on staging first.

Each run:

1. Checks the environment's settings: production never has the demo-site banner, staging is
   never indexed by search engines.
2. Builds `ghcr.io/ademkoca/walls-api:<commit SHA>` and `walls-web:<commit SHA>-<environment>`
   and pushes them to GitHub's container registry. The web image has the environment's site
   address compiled in, so each environment has its own.
3. Copies `compose.yaml`, `deploy.sh`, `backup.sh` and the `caddy/` files to `/opt/walls` as
   the `deploy` user.
4. Runs `deploy.sh <environment> <SHA>`: starts Caddy if needed and applies its configuration
   without dropping connections, then pulls the environment's images with a registry token
   that expires with the job, applies its migrations, starts the new containers and waits
   until they report healthy. If they don't, it starts the previous version again and the
   workflow fails. The other environment is not touched.

The API trusts exactly one proxy (`TRUST_PROXY_HOPS=1`): Caddy replaces any `X-Forwarded-For`
a visitor sends, so rate limits use the visitor's real address. Caddy runs on the host network
because Docker's port publishing would hide IPv6 visitors' addresses.

## Server layout

- Users: the admin user (SSH key, passwordless sudo, Docker) and `deploy` (Docker only, used by
  GitHub Actions). Root and password logins are disabled; netcup's web console with the root
  password is the way in if SSH is ever locked out.
- `/opt/walls` (owned by `deploy`): `compose.yaml`, `deploy.sh`, `backup.sh`, `backup/`, and:
  - `caddy/`: `compose.yaml`, `Caddyfile`, `.env` (Compose project `walls-caddy`);
  - `production/` and `staging/`: `.env` and `api.env` (mode 600), and the `compose.yaml` that
    `deploy.sh` copies in (Compose projects `walls-production` and `walls-staging`).
- Staging has lower memory limits than production (512 MB web, 384 MB API, against 1 GB and
  768 MB), so it can't starve production.
- Firewall (ufw): SSH, 80/tcp, 443/tcp and 443/udp only.
- Debian and Docker security updates install automatically; when one needs a restart, the
  server restarts at 03:00 UTC and the containers start again on their own.
- 2 GB swap; container logs are capped at 5 × 10 MB per container.

## Environment settings

`/opt/walls/<environment>/api.env`, from `api.env.example`; each environment has its own
values:

| Setting | Production | Staging |
| --- | --- | --- |
| `DATABASE_URL` | Production Supabase project | Staging Supabase project |
| `SESSION_SECRET` | Its own (`openssl rand -base64 48`) | Its own |
| `WEB_ORIGIN` | `https://walls.rs` | `https://preview.walls.rs` |
| `EMAIL_FROM` | `"Walls <no-reply@walls.rs>"` | `"Walls Preview <no-reply@walls.rs>"`, so test emails stand out |
| `CLOUDINARY_*` | Production Cloudinary account | Staging Cloudinary account |
| `RESEND_API_KEY`, `EXCHANGE_RATE_PROVIDER` | Shared | Shared |

Never point staging at production's database or Cloudinary account: `pnpm demo:seed --remove`
and any test on staging would then touch real data.

## GitHub settings

Settings → Environments:

- `staging`: no protection rules.
- `production`: required reviewer (you), deployment branches limited to `main`.

Each environment has these secrets (the same values in both):

- `VPS_HOST`: the server's IPv4 address.
- `VPS_SSH_KEY`: the private key whose public half is in `/home/deploy/.ssh/authorized_keys`.
- `VPS_KNOWN_HOSTS`: output of `ssh-keyscan -t ed25519 <host>`, checked against the server.

and these variables, compiled into the web image:

| Variable | Production | Staging |
| --- | --- | --- |
| `SITE_URL` | `https://walls.rs` | `https://preview.walls.rs` |
| `SITE_INDEXING` | `off` until the public launch, then empty | `off` |
| `DEMO_SITE` | empty (the deploy fails on `on`) | `on` |
| `MAP_TILE_URL`, `MAP_ATTRIBUTION` | optional, as `NEXT_PUBLIC_MAP_*` in `.env.example` | the same |

Don't keep these variables at repository level as well: a variable missing from an environment
would silently fall back to the repository's value.

## Everyday commands

Log in with `ssh walls-vps`, then in `/opt/walls/production` or `/opt/walls/staging`:

```text
sudo -u deploy docker compose ps                  # containers and their health
sudo -u deploy docker compose logs -f api         # follow the API log (also: web)
sudo -u deploy docker compose restart api         # restart one container
sudo -u deploy docker compose run --rm migrate    # apply migrations by hand
```

Caddy's commands run in `/opt/walls/caddy` (`docker compose logs -f caddy`, and
`docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile` after editing `.env`).

Roll back an environment to an earlier version (its images must still be on the server; unused
images are kept for a week):

```text
sudo -u deploy WALLS_VERSION=<commit SHA> docker compose up -d --wait
```

Then set `WALLS_VERSION` in that environment's `.env` to that SHA so later manual commands use
it. Migrations are not rolled back.

To change a secret, edit the environment's `api.env`
(`sudo -u deploy nano /opt/walls/production/api.env`) and run
`sudo -u deploy docker compose up -d api` in its folder.

## Backups

Supabase's free plan has no restorable backups, so the server makes its own of production's
database (staging's data is disposable). Every night at 02:00 UTC (systemd timer
`walls-backup.timer`), `backup.sh`:

1. dumps the Walls schemas (`public` with its extensions, and `drizzle`, the migration history);
2. encrypts the dump with [age](https://age-encryption.org) and stores it in `daily/`, plus a
   copy in `monthly/` on the 1st: in `/opt/walls/backup/archive` on this server, or in a
   Cloudflare R2 bucket once `backup.env` has R2 settings (a separate provider, so the backups
   survive losing the server; planned for launch);
3. reads the stored file back, decrypts it, restores it into a throwaway Postgres container and
   checks that every table came back with its rows (a missing table, or an empty copy of a
   non-empty one, fails the backup);
4. deletes daily backups after 30 days and monthly ones after a year;
5. reports to healthchecks.io when `HEALTHCHECK_URL` is set, which emails if a night fails or
   is missed.

Files in `/opt/walls/backup` (deploy only): `age-key.txt`, the private key that decrypts the
backups; `backup.env` (healthchecks.io URL, optional R2 settings: `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT` = `https://<account id>.eu.r2.cloudflarestorage.com`,
`R2_BUCKET`); `archive/`. **A copy of `age-key.txt` must be kept outside the server**
(password manager); without it the backups cannot be read anywhere else.

```text
sudo systemctl start walls-backup              # run a backup now (takes about a minute)
sudo journalctl -u walls-backup -n 30          # the last runs' output
systemctl list-timers walls-backup.timer       # next run
```

Copy the newest backup to your computer (it stays encrypted):

```text
ssh walls-vps 'sudo sh -c "cat \$(ls -t /opt/walls/backup/archive/daily/*.age | head -1)"' > walls-latest.dump.age
```

`pg_dump` must be at least the database's major version (Debian's `postgresql-client-17`,
Supabase 17). If Supabase upgrades to 18, install `postgresql-client-18` and change the
package in `setup-backups.sh` and `RESTORE_IMAGE` in `backup.sh`.

### Restoring after data loss

1. Take a backup from `/opt/walls/backup/archive` (or a copy on your computer, or the R2
   bucket once it is used).
2. Decrypt: `age --decrypt --identity age-key.txt --output walls.dump <file>`.
3. Create a new, empty Supabase project (Frankfurt, Data API off) or empty the database, then
   restore with the same command the nightly test uses:
   `pg_restore --dbname="<connection string>" --clean --if-exists --no-owner --no-privileges --exit-on-error walls.dump`
4. Put the new connection string in `/opt/walls/production/api.env` and run
   `sudo -u deploy docker compose up -d api` in `/opt/walls/production`. Run
   `docker compose run --rm migrate` there if the backup is older than the running version's
   migrations.

## Moving to two environments (one-time)

Until 2026-10, the server ran one stack in `/opt/walls` serving preview.walls.rs, and walls.rs
showed a "coming soon" page from GitHub Pages. The move keeps today's preview database, photos
and accounts as staging, and starts production empty. Do steps 5 to 11 in one sitting: the
nightly backup reads `production/api.env`, so it fails until production is set up.

Before (no downtime):

1. **Supabase:** create a new project for production (Frankfurt, `eu-central-1`), turn off the
   Data API, and copy the session pooler connection string with `?sslmode=require` appended.
   Today's project becomes staging's.
2. **Cloudinary:** create a new account (free plan) for production's photos. Today's account
   becomes staging's.
3. **GitHub:** create the `staging` environment and update the existing `production` one
   ("GitHub settings" above; environments can't be renamed): the same three `VPS_*` secrets in
   both, and each one's variables. Leave production's protection rules and the
   repository-level variables until step 5: the old workflow still deploys preview.walls.rs
   through `production` with the repository's `SITE_URL`.
4. **Cloudflare:** in walls.rs's DNS, check that preview.walls.rs is "DNS only" (grey cloud),
   as walls.rs and www.walls.rs will be; Caddy obtains its own certificates.

The move:

5. Push the deploy changes to `main`. The automatic staging deploy fails when it copies the
   Caddy files, since the server isn't split yet; that is expected, and preview.walls.rs keeps
   running. Now add production's protection rules (you as required reviewer, `main` only) and
   delete the repository-level variables.
6. Split the server (preview.walls.rs is down until step 8):
   `ssh walls-vps 'sudo bash -s' < deploy/split-environments.sh`
7. Fill in production's settings on the server, in an editor so no secret lands in a shell
   history: `ssh -t walls-vps sudo -u deploy nano /opt/walls/production/api.env` (values in
   "Environment settings" above; `SESSION_SECRET` from `openssl rand -base64 48`). In
   `/opt/walls/staging/api.env`, set `EMAIL_FROM="Walls Preview <no-reply@walls.rs>"`.
8. Run the deploy workflow for `staging`: preview.walls.rs is back, with the demo-site banner.
9. Run it for `production` and approve it. The site starts behind Caddy, which can't get
   walls.rs's certificate yet (DNS still points at GitHub Pages); its log shows failed
   attempts until step 11.
10. Create production's first Super Admin from your Mac, entering production's values at
    prompts so they stay out of the shell history (zsh):

    ```text
    read -rs "DATABASE_URL?Production DATABASE_URL: "; echo; export DATABASE_URL
    read -rs "SESSION_SECRET?Production SESSION_SECRET: "; echo; export SESSION_SECRET
    read -rs "RESEND_API_KEY?RESEND_API_KEY: "; echo; export RESEND_API_KEY
    export WEB_ORIGIN=https://walls.rs
    pnpm admin:create --email <your email> --name "<your name>"
    ```

    The setup link in the email works once walls.rs points at the server (valid 7 days).
    Close the terminal afterwards.
11. **Cloudflare:** point walls.rs and www.walls.rs at the server (A `159.195.128.124`, AAAA
    `2a03:4000:b:1913:b4e5:3dff:fe3c:c014`, DNS only) instead of GitHub Pages, and remove the
    custom domain from the GitHub Pages site. Once `dig +short walls.rs @1.1.1.1` shows the
    server, restart Caddy so it requests the certificates at once instead of waiting for its
    next retry: `ssh walls-vps 'cd /opt/walls/caddy && sudo -u deploy docker compose restart'`.
    walls.rs then shows the real, empty site, still hidden from search engines.
12. Run a backup and check it: `sudo systemctl start walls-backup`, then
    `sudo journalctl -u walls-backup -n 30`.

At the public launch, empty production's `SITE_INDEXING` variable in GitHub and deploy
production again.

## Setting up a new server

1. Order Debian 13, add your SSH key for root, and change the emailed root password.
2. `ssh root@<server> 'bash -s' -- <admin user> < deploy/setup-server.sh`
3. Check `ssh <admin user>@<server>` works, then
   `ssh <admin user>@<server> 'sudo bash -s' -- <admin user> < deploy/harden-ssh.sh`.
4. Create a key pair for GitHub Actions, put the public half in
   `/home/deploy/.ssh/authorized_keys`, and fill in the GitHub settings above.
5. Fill in `/opt/walls/caddy/.env`, and each environment's `.env` and `api.env` in
   `/opt/walls/production` and `/opt/walls/staging`, from the examples (each environment's
   `SESSION_SECRET` as before, or everyone is signed out).
6. Backups: `ssh <admin user>@<server> 'sudo bash -s' < deploy/setup-backups.sh`, then fill
   in `/opt/walls/backup/backup.env`. To read old backups, put the saved `age-key.txt` in
   place before the first run instead of using the newly generated one.
7. Point DNS (A and AAAA records for walls.rs, www.walls.rs and preview.walls.rs) at the
   server, then run the deploy workflow for each environment. Caddy obtains the certificates
   once DNS points at the server.
