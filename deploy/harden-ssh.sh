#!/usr/bin/env bash
# Allows only SSH key logins by the admin and deploy users. Run as root, after
# deploy/setup-server.sh and after checking that the admin user can log in with their key:
#   ssh <admin user>@<server> 'sudo bash -s' -- <admin user> < deploy/harden-ssh.sh
# netcup's web console (root password) still works if SSH is ever locked out.
set -euo pipefail

ADMIN_USER=${1:?admin user name}
[[ -s /home/$ADMIN_USER/.ssh/authorized_keys ]] || {
  echo "$ADMIN_USER has no SSH key; not changing anything." >&2
  exit 1
}

# sshd uses the first value it reads, and this file is read before the others.
cat > /etc/ssh/sshd_config.d/00-walls.conf << EOF
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
AllowUsers $ADMIN_USER deploy
EOF
sshd -t
systemctl reload ssh
sshd -T | grep -E '^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication|allowusers) '
