#!/usr/bin/env bash
# One-time setup of the nightly database backup (deploy/backup.sh), run as root. Safe to run
# again: keeps an existing key and settings.
#   ssh <admin user>@<server> 'sudo bash -s' < deploy/setup-backups.sh
# Installs the tools, creates the age key, a backup.env template to fill in, and a systemd
# timer that runs the backup every night at 02:00 UTC.
set -euo pipefail

APP_DIR=/opt/walls
BACKUP_DIR=$APP_DIR/backup
export DEBIAN_FRONTEND=noninteractive

echo '== Tools'
# pg_dump must be at least the database's major version (Supabase: 17).
apt-get install -y -q postgresql-client-17 age rclone > /dev/null

echo "== $BACKUP_DIR"
install -d -m 700 -o deploy -g deploy "$BACKUP_DIR"
if [[ ! -f $BACKUP_DIR/age-key.txt ]]; then
  # Prints only the public key. Keep a copy of the private key outside the server.
  sudo -u deploy age-keygen -o "$BACKUP_DIR/age-key.txt"
fi
chmod 600 "$BACKUP_DIR/age-key.txt"
if [[ ! -f $BACKUP_DIR/backup.env ]]; then
  cat > "$BACKUP_DIR/backup.env" << 'EOF'
# Settings for backup.sh (deploy/README.md, "Backups").
# Optional: with these, backups go to Cloudflare R2 instead of /opt/walls/backup/archive.
# R2 token limited to the bucket, permission "Object Read & Write".
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
# The bucket's EU endpoint: https://<account id>.eu.r2.cloudflarestorage.com
R2_ENDPOINT=
R2_BUCKET=walls-backups
# healthchecks.io ping URL (period 1 day, grace 2 hours); empty turns the reports off.
HEALTHCHECK_URL=
EOF
fi
chown deploy:deploy "$BACKUP_DIR/backup.env"
chmod 600 "$BACKUP_DIR/backup.env"

echo '== Timer'
cat > /etc/systemd/system/walls-backup.service << EOF
[Unit]
Description=Walls database backup and restore test (deploy/backup.sh)
Wants=network-online.target
After=network-online.target docker.service

[Service]
Type=oneshot
User=deploy
ExecStart=/bin/bash $APP_DIR/backup.sh
EOF
cat > /etc/systemd/system/walls-backup.timer << 'EOF'
[Unit]
Description=Nightly Walls database backup

[Timer]
# Before the 03:00 UTC restart window for updates; runs on the next boot if missed.
OnCalendar=*-*-* 02:00:00 UTC
RandomizedDelaySec=10m
Persistent=true

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now walls-backup.timer
systemctl list-timers walls-backup.timer --no-pager | head -2
