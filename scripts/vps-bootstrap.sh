#!/usr/bin/env bash
# =============================================================================
#  cmipaportal.com  —  VPS BOOTSTRAP  (run ONCE on the production server)
# =============================================================================
#  Purpose:
#     - Installs Node.js 20, PM2, nginx, certbot
#     - Creates a dedicated `deploy` user (no root login for CI)
#     - Prepares the Capistrano-style release folder layout
#     - Generates the SSH deploy key (added to GitHub Secrets afterwards)
#     - Issues Let's Encrypt SSL for cmipaportal.com + www
#
#  Usage (as root):
#     curl -fsSL https://raw.githubusercontent.com/Nekoutb/apiworkflow/main/scripts/vps-bootstrap.sh | bash
#     # OR clone the repo and run:  bash scripts/vps-bootstrap.sh
#
#  Idempotent: safe to re-run.
# =============================================================================

set -Eeuo pipefail

# ---------- Config (override via env vars) -----------------------------------
APP_NAME="${APP_NAME:-cmipaportal}"
APP_DOMAIN="${APP_DOMAIN:-cmipaportal.com}"
APP_DOMAIN_WWW="${APP_DOMAIN_WWW:-www.cmipaportal.com}"
APP_PORT="${APP_PORT:-3000}"
APP_ROOT="/var/www/${APP_NAME}"
LE_EMAIL="${LE_EMAIL:-admin@cmipaportal.com}"
NODE_MAJOR="${NODE_MAJOR:-20}"

# APP_USER is REQUIRED — you must specify which Linux user GitHub Actions
# will SSH in as. This script does NOT create the user and does NOT set a
# password. You create the user (`adduser <name>`), set its password
# (`passwd <name>`) yourself, then pass the username here.
APP_USER="${APP_USER:-}"
if [[ -z "$APP_USER" ]]; then
  printf "\033[1;31m✗ APP_USER is required. Example:\033[0m\n"
  printf "    APP_USER=myuser LE_EMAIL=you@example.com bash %s\n" "$0"
  printf "  (Create the user first with: adduser myuser && passwd myuser)\n"
  exit 1
fi

# ---------- Pretty logging ---------------------------------------------------
log()  { printf "\033[1;36m▶ %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m✓ %s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m⚠ %s\033[0m\n" "$*"; }
err()  { printf "\033[1;31m✗ %s\033[0m\n" "$*" >&2; }

require_root() {
  if [[ $EUID -ne 0 ]]; then err "Run as root (or with sudo)"; exit 1; fi
}

require_root

# ---------- 1. System update -------------------------------------------------
log "1/9 · Updating system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl ca-certificates gnupg lsb-release ufw rsync jq
ok   "System updated"

# ---------- 2. Node.js -------------------------------------------------------
if ! command -v node >/dev/null || ! node -v | grep -q "v${NODE_MAJOR}\."; then
  log "2/9 · Installing Node.js ${NODE_MAJOR}.x"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
  apt-get install -y -qq nodejs
fi
ok "Node $(node -v) · npm $(npm -v)"

# ---------- 3. PM2 -----------------------------------------------------------
if ! command -v pm2 >/dev/null; then
  log "3/9 · Installing PM2"
  npm install -g pm2 >/dev/null
fi
ok "PM2 $(pm2 -v)"

# ---------- 4. nginx + certbot ----------------------------------------------
log "4/9 · Installing nginx + certbot"
apt-get install -y -qq nginx certbot python3-certbot-nginx
systemctl enable --now nginx >/dev/null
ok "nginx $(nginx -v 2>&1 | awk -F/ '{print $2}')"

# ---------- 5. Firewall ------------------------------------------------------
log "5/9 · Configuring UFW firewall"
ufw allow OpenSSH        >/dev/null 2>&1 || true
ufw allow 'Nginx Full'   >/dev/null 2>&1 || true
yes | ufw enable         >/dev/null 2>&1 || true
ok "Firewall: SSH + HTTP + HTTPS open"

# ---------- 6. Verify the SSH user exists ------------------------------------
# This script does NOT create users. You create the user manually beforehand:
#     adduser <username>
#     passwd <username>
# Then pass APP_USER=<username> to this script. Re-runs leave password intact.
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  err "6/9 · User '$APP_USER' does not exist on this system."
  err "      Create it first:"
  err "        adduser $APP_USER"
  err "        passwd  $APP_USER"
  err "      Then re-run this script with APP_USER=$APP_USER"
  exit 1
fi

# Install a scoped sudoers rule (idempotent) so the SSH user can reload nginx
# without a password — needed by vps-deploy.sh for the nginx symlink swap.
SUDOERS_FILE="/etc/sudoers.d/${APP_USER}-${APP_NAME}"
if [[ ! -f "$SUDOERS_FILE" ]]; then
  log "    · Granting $APP_USER limited sudo (nginx reload only)"
  cat >"$SUDOERS_FILE" <<EOF
${APP_USER} ALL=(root) NOPASSWD: /bin/systemctl reload nginx, /bin/systemctl restart nginx
EOF
  chmod 440 "$SUDOERS_FILE"
fi

# Detect whether the user currently has a usable password (informational only)
PW_STATUS="$(passwd -S "$APP_USER" 2>/dev/null | awk '{print $2}')"
case "$PW_STATUS" in
  P) PW_STATE="set (unchanged — bootstrap will NOT touch it)" ;;
  L) PW_STATE="LOCKED — run: passwd $APP_USER" ;;
  NP) PW_STATE="EMPTY — run: passwd $APP_USER" ;;
  *) PW_STATE="unknown ($PW_STATUS) — verify with: passwd -S $APP_USER" ;;
esac
ok "SSH user: $APP_USER · password ${PW_STATE}"

# ---------- 6b. SSH hardening for password auth ------------------------------
# Enable password auth ONLY for the deploy user, keep root key-only.
log "    · Enabling password auth for $APP_USER only (root stays key-only)"
mkdir -p /etc/ssh/sshd_config.d
cat >/etc/ssh/sshd_config.d/10-${APP_NAME}.conf <<SSHEOF
# Managed by ${APP_NAME} bootstrap
PasswordAuthentication yes
PubkeyAuthentication   yes
PermitRootLogin        prohibit-password
Match User ${APP_USER}
    PasswordAuthentication yes
SSHEOF
systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true

# Install fail2ban to mitigate brute-force on password auth
if ! command -v fail2ban-server >/dev/null; then
  log "    · Installing fail2ban (brute-force protection)"
  apt-get install -y -qq fail2ban
  cat >/etc/fail2ban/jail.d/sshd.local <<'F2BEOF'
[sshd]
enabled  = true
port     = ssh
maxretry = 5
findtime = 10m
bantime  = 1h
F2BEOF
  systemctl enable --now fail2ban >/dev/null
  ok   "fail2ban enabled"
fi

# ---------- 7. Release folder layout (Capistrano-style) ----------------------
log "7/9 · Preparing release layout under $APP_ROOT"
mkdir -p "$APP_ROOT"/{releases,shared/logs}
chown -R "$APP_USER:$APP_USER" "$APP_ROOT"

# Place .env.production into shared/ (DO NOT commit this file)
if [[ ! -f "$APP_ROOT/shared/.env.production" ]]; then
  cat > "$APP_ROOT/shared/.env.production" <<'ENVEOF'
# === FILL IN BEFORE FIRST DEPLOY ============================================
DATABASE_URL="postgresql://USER:PASS@HOST/DB?sslmode=require"
AUTH_SECRET="REPLACE_WITH_OPENSSL_RAND_BASE64_32"
AUTH_URL="https://cmipaportal.com"
NEXTAUTH_URL="https://cmipaportal.com"
NODE_ENV="production"

# Optional integrations (leave empty to use graceful stubs)
ANTHROPIC_API_KEY=""
BLOB_READ_WRITE_TOKEN=""
RESEND_API_KEY=""
ENVEOF
  chown "$APP_USER:$APP_USER" "$APP_ROOT/shared/.env.production"
  chmod 600 "$APP_ROOT/shared/.env.production"
  warn "Created template $APP_ROOT/shared/.env.production — edit it BEFORE deploying"
fi

# Log directory
mkdir -p /var/log/${APP_NAME}
chown -R "$APP_USER:$APP_USER" /var/log/${APP_NAME}
ok "Release layout ready"

# ---------- 8. Prepare home/.ssh skeleton (no key needed for password auth) -
USER_HOME="$(getent passwd "$APP_USER" | cut -d: -f6)"
if [[ -n "$USER_HOME" && -d "$USER_HOME" ]]; then
  SSH_DIR="${USER_HOME}/.ssh"
  mkdir -p "$SSH_DIR"
  chmod 700 "$SSH_DIR"
  chown -R "$APP_USER:$APP_USER" "$SSH_DIR"
  ok "8/9 · SSH home prepared at $SSH_DIR (password auth mode)"
else
  warn "8/9 · Could not resolve home for $APP_USER — skipping .ssh setup"
fi

# ---------- 9. nginx site (HTTP only — certbot will add HTTPS later) --------
NGINX_CONF="/etc/nginx/sites-available/${APP_NAME}"
if [[ ! -f "$NGINX_CONF" ]]; then
  log "9/9 · Installing nginx site for ${APP_DOMAIN}"
  cat > "$NGINX_CONF" <<NGINXEOF
# ${APP_NAME} — reverse proxy to Node on 127.0.0.1:${APP_PORT}
server {
    listen 80;
    listen [::]:80;
    server_name ${APP_DOMAIN} ${APP_DOMAIN_WWW};

    # Larger uploads for document attachments
    client_max_body_size 50M;

    # Health endpoint short-circuit (faster than going through Node)
    location = /_health {
        access_log off;
        proxy_pass http://127.0.0.1:${APP_PORT}/_health;
    }

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
    }

    # Cache Next.js static assets aggressively
    location /_next/static/ {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
NGINXEOF
  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/${APP_NAME}
  # Remove default site if it still occupies port 80
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
fi
ok "nginx site installed"

# ---------- SSL (Let's Encrypt) ---------------------------------------------
if ! [ -d "/etc/letsencrypt/live/${APP_DOMAIN}" ]; then
  log "Issuing Let's Encrypt certificate (requires DNS A records → this server's IP)"
  if certbot --nginx -d "${APP_DOMAIN}" -d "${APP_DOMAIN_WWW}" \
       --non-interactive --agree-tos -m "${LE_EMAIL}" --redirect; then
    ok "SSL issued · auto-renew enabled by certbot.timer"
  else
    warn "SSL issuance failed — likely DNS not pointing here yet."
    warn "Point A records for ${APP_DOMAIN} and ${APP_DOMAIN_WWW} to this server, then run:"
    warn "  certbot --nginx -d ${APP_DOMAIN} -d ${APP_DOMAIN_WWW} --non-interactive --agree-tos -m ${LE_EMAIL} --redirect"
  fi
else
  ok "SSL already configured for ${APP_DOMAIN}"
fi

# ---------- Summary ----------------------------------------------------------
echo
echo "==============================================================="
echo "  ✅  Bootstrap complete"
echo "==============================================================="
echo
echo "  SSH user    : $APP_USER  (you chose this — bootstrap will never change its password)"
echo "  App root    : $APP_ROOT"
echo "  Env file    : $APP_ROOT/shared/.env.production  (EDIT THIS)"
echo "  Logs        : /var/log/${APP_NAME}/"
echo "  Domain      : https://${APP_DOMAIN}"
echo
echo "==============================================================="
echo "  📋  ADD THESE TO GITHUB → Settings → Secrets and variables → Actions"
echo "==============================================================="
echo
echo "  VPS_HOST      = $(curl -s ifconfig.me || hostname -I | awk '{print $1}')"
echo "  VPS_USER      = $APP_USER"
echo "  VPS_PORT      = 22"
echo "  VPS_PASSWORD  = (the password you assigned to ${APP_USER} manually)"
echo
echo "  This script DOES NOT create users, DOES NOT set passwords, and"
echo "  DOES NOT rotate anything. Re-running is fully idempotent."
echo
echo "  Then push to main — the workflow will deploy automatically."
echo "==============================================================="
