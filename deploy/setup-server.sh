#!/usr/bin/env bash
# One-time setup of the Walls VPS (Debian 13), run as root. Safe to run again.
#   ssh root@<server> 'bash -s' -- <admin user> < deploy/setup-server.sh
# Creates the admin user (sudo, same SSH keys as root) and the deploy user (Docker only, used
# by GitHub Actions), adds swap, automatic security updates, Docker and the firewall.
# SSH logins stay as they are; deploy/harden-ssh.sh closes root and password logins once the
# admin user can log in.
set -euo pipefail

ADMIN_USER=${1:?admin user name}
APP_DIR=/opt/walls
SWAP_SIZE=2G
REBOOT_TIME=03:00 # UTC, when an update needs a restart
export DEBIAN_FRONTEND=noninteractive
# Keep changed config files and install new defaults otherwise, without asking.
APT_OPTIONS=(-y -q -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold)

echo '== Packages'
apt-get update -q
apt-get full-upgrade "${APT_OPTIONS[@]}"
apt-get install "${APT_OPTIONS[@]}" ca-certificates curl sudo ufw unattended-upgrades
timedatectl set-timezone UTC

echo "== Admin user $ADMIN_USER"
id "$ADMIN_USER" > /dev/null 2>&1 || adduser --disabled-password --comment '' "$ADMIN_USER"
usermod --append --groups sudo "$ADMIN_USER"
# Logins are by SSH key only and the user has no password, so sudo can't ask for one.
echo "$ADMIN_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-$ADMIN_USER"
chmod 440 "/etc/sudoers.d/90-$ADMIN_USER"
visudo --check --quiet
install -d -m 700 -o "$ADMIN_USER" -g "$ADMIN_USER" "/home/$ADMIN_USER/.ssh"
install -m 600 -o "$ADMIN_USER" -g "$ADMIN_USER" /root/.ssh/authorized_keys \
  "/home/$ADMIN_USER/.ssh/authorized_keys"

echo '== Deploy user'
id deploy > /dev/null 2>&1 || adduser --disabled-password --comment '' deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
[[ -f /home/deploy/.ssh/authorized_keys ]] ||
  install -m 600 -o deploy -g deploy /dev/null /home/deploy/.ssh/authorized_keys

echo "== Swap ($SWAP_SIZE)"
if ! swapon --show=NAME --noheadings | grep -qx /swapfile; then
  fallocate -l "$SWAP_SIZE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile > /dev/null
  swapon /swapfile
fi
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo 'vm.swappiness=10' > /etc/sysctl.d/90-walls.conf
sysctl --quiet --load /etc/sysctl.d/90-walls.conf

echo '== Docker'
install -d -m 755 /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $VERSION_CODENAME stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -q
apt-get install "${APT_OPTIONS[@]}" docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
# Container logs: at most 5 files of 10 MB per container.
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "local",
  "log-opts": { "max-size": "10m", "max-file": "5" }
}
EOF
systemctl restart docker
systemctl enable --quiet docker
usermod --append --groups docker deploy
usermod --append --groups docker "$ADMIN_USER"
# Lets the admin user open /opt/walls (the env files stay readable by deploy only).
usermod --append --groups deploy "$ADMIN_USER"

echo '== Automatic updates'
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
# Debian security updates (the default) plus Docker's; restart at night when one needs it.
# Containers start again on their own (restart: unless-stopped).
cat > /etc/apt/apt.conf.d/52walls-unattended-upgrades << EOF
Unattended-Upgrade::Origins-Pattern:: "origin=Docker,label=Docker CE";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "$REBOOT_TIME";
EOF

echo "== $APP_DIR"
install -d -m 750 -o deploy -g deploy "$APP_DIR"
for file in .env api.env; do
  [[ -f $APP_DIR/$file ]] || install -m 600 -o deploy -g deploy /dev/null "$APP_DIR/$file"
done

echo '== Firewall'
ufw default deny incoming > /dev/null
ufw default allow outgoing > /dev/null
ufw allow OpenSSH > /dev/null
ufw allow 80/tcp > /dev/null
ufw allow 443/tcp > /dev/null
ufw allow 443/udp > /dev/null
ufw --force enable > /dev/null
ufw status verbose

echo 'Done. Next: check that the admin user can log in, then run deploy/harden-ssh.sh.'
