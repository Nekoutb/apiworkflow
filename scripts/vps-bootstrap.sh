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

# ---------- 0. Inspect the server (adapt rather than overwrite) -------------
log "0/9 · Inspecting server (adapting to existing apps)"

# 0a. Detect other apps under /var/www so we can warn about co-tenancy
OTHER_APPS=()
if [[ -d /var/www ]]; then
  while IFS= read -r dir; do
    name="$(basename "$dir")"
    [[ "$name" == "$APP_NAME" || "$name" == "html" ]] && continue
    OTHER_APPS+=("$name")
  done < <(find /var/www -mindepth 1 -maxdepth 1 -type d 2>/dev/null)
fi
if [[ ${#OTHER_APPS[@]} -gt 0 ]]; then
  warn "Other apps detected under /var/www: ${OTHER_APPS[*]}"
  warn "This script will NOT touch their files, nginx vhosts, PM2 procs, or SSL certs."
fi

# 0b. Detect existing nginx vhosts that already serve our domain
if [[ -d /etc/nginx/sites-enabled ]]; then
  EXISTING_VHOST="$(grep -rl "server_name.*${APP_DOMAIN}" /etc/nginx/sites-enabled/ 2>/dev/null | grep -v "${APP_NAME}" | head -1 || true)"
  if [[ -n "$EXISTING_VHOST" ]]; then
    err "Another nginx vhost already claims ${APP_DOMAIN}: $EXISTING_VHOST"
    err "Refusing to overwrite. Remove or rename that vhost first."
    exit 1
  fi
fi

# 0c. Pick a free port if APP_PORT is taken by another app
detect_free_port() {
  local p="$1"
  while ss -ltn "( sport = :$p )" 2>/dev/null | grep -q LISTEN; do
    p=$((p+1))
  done
  echo "$p"
}
ORIGINAL_PORT="$APP_PORT"
APP_PORT="$(detect_free_port "$APP_PORT")"
if [[ "$APP_PORT" != "$ORIGINAL_PORT" ]]; then
  warn "Port $ORIGINAL_PORT is already in use — falling back to $APP_PORT"
else
  ok "Port $APP_PORT is free"
fi

# 0d. Detect existing PM2 procs (informational, no action)
if command -v pm2 >/dev/null; then
  PM2_PROCS="$(pm2 jlist 2>/dev/null | jq -r '.[].name' 2>/dev/null | grep -v "^${APP_NAME}$" || true)"
  if [[ -n "$PM2_PROCS" ]]; then
    warn "Existing PM2 processes (untouched): $(echo $PM2_PROCS | tr '\n' ' ')"
  fi
fi

# 0e. Detect existing Let's Encrypt certs for other domains (informational)
if [[ -d /etc/letsencrypt/live ]]; then
  EXISTING_CERTS="$(ls /etc/letsencrypt/live/ 2>/dev/null | grep -v "^${APP_DOMAIN}$" || true)"
  if [[ -n "$EXISTING_CERTS" ]]; then
    ok "Existing SSL certs (won't touch): $(echo $EXISTING_CERTS | tr '\n' ' ')"
  fi
fi

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

# ---------- 5. Firewall (additive — never disrupts existing rules) ----------
log "5/9 · Configuring UFW firewall"
UFW_STATUS="$(ufw status 2>/dev/null | head -1 | awk '{print $2}')"
ufw allow OpenSSH      >/dev/null 2>&1 || true
ufw allow 'Nginx Full' >/dev/null 2>&1 || true
if [[ "$UFW_STATUS" == "active" ]]; then
  ok "Firewall already active — added SSH + HTTP/HTTPS rules (other rules untouched)"
else
  warn "UFW was inactive — enabling now (SSH already whitelisted, you won't be kicked out)"
  yes | ufw enable >/dev/null 2>&1 || true
  ok "Firewall: SSH + HTTP + HTTPS open"
fi

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

# Scoped sudoers rules (re-written every run — kept in sync with deploy needs):
#   1. nginx reload  — for the deploy script's symlink swap
#   2. sudo -u postgres ALL — so the deploy script can create the cmipaportal
#      DB role + database on its first run without a password prompt
SUDOERS_FILE="/etc/sudoers.d/${APP_USER}-${APP_NAME}"
log "    · Granting $APP_USER scoped sudo (nginx reload + psql-as-postgres)"
cat >"$SUDOERS_FILE" <<EOF
# Managed by ${APP_NAME} bootstrap — DO NOT EDIT
${APP_USER} ALL=(root) NOPASSWD: /bin/systemctl reload nginx, /bin/systemctl restart nginx
${APP_USER} ALL=(postgres) NOPASSWD: ALL
EOF
chmod 440 "$SUDOERS_FILE"
# Validate before nginx/sshd reload would lock you out
visudo -cf "$SUDOERS_FILE" >/dev/null || { err "Invalid sudoers file — removed"; rm -f "$SUDOERS_FILE"; exit 1; }

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

# ---------- 6c. PostgreSQL (local DB — zero external dependency) ------------
# Generates a random password ONCE per fresh install. On re-runs the
# existing DB and password are left intact.
DB_NAME="${DB_NAME:-${APP_NAME}}"
DB_USER="${DB_USER:-${APP_NAME}}"
DB_PASS_FILE="/root/.${APP_NAME}-db-password"

log "    · Installing PostgreSQL 16"
if ! command -v psql >/dev/null; then
  # Use the system default Postgres (Ubuntu 24.04 = 16, 22.04 = 14 — both fine)
  apt-get install -y -qq postgresql postgresql-contrib
  systemctl enable --now postgresql >/dev/null
fi
PG_VERSION="$(psql --version | awk '{print $3}' | cut -d. -f1)"
ok "    · PostgreSQL ${PG_VERSION} ready"

# Create or load the DB password (NEVER rotates an existing one)
if [[ -f "$DB_PASS_FILE" ]]; then
  DB_PASSWORD="$(cat "$DB_PASS_FILE")"
  log "    · Reusing existing DB password from $DB_PASS_FILE"
else
  DB_PASSWORD="$(openssl rand -base64 30 | tr -d '/+=' | cut -c1-28)"
  echo -n "$DB_PASSWORD" > "$DB_PASS_FILE"
  chmod 600 "$DB_PASS_FILE"
  log "    · Generated new DB password (stored at $DB_PASS_FILE)"
fi

# Create role + DB (idempotent — re-runs are no-ops)
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER \"${DB_USER}\" WITH ENCRYPTED PASSWORD '${DB_PASSWORD}';"

sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_USER}\" ENCODING 'UTF8';"

# Grant schema privileges (Postgres 15+ requires this explicitly)
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO \"${DB_USER}\";" >/dev/null
ok "    · Database '${DB_NAME}' owned by '${DB_USER}' (password unchanged)"

# Compose the connection string
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}"

# ---------- 6d. Auth secret (auto-generated once, never rotated) ------------
# Same policy as the DB password — if a file exists, reuse it. Otherwise
# generate a fresh 43-char base64 string (32 bytes of entropy) and persist.
# Rotating this string invalidates all logged-in user sessions, so we keep
# it stable across re-runs of bootstrap.
AUTH_SECRET_FILE="/root/.${APP_NAME}-auth-secret"
if [[ -f "$AUTH_SECRET_FILE" ]]; then
  AUTH_SECRET="$(cat "$AUTH_SECRET_FILE")"
  log "    · Reusing existing AUTH_SECRET from $AUTH_SECRET_FILE"
else
  AUTH_SECRET="$(openssl rand -base64 32)"
  echo -n "$AUTH_SECRET" > "$AUTH_SECRET_FILE"
  chmod 600 "$AUTH_SECRET_FILE"
  log "    · Generated new AUTH_SECRET (stored at $AUTH_SECRET_FILE)"
fi
ok "    · AUTH_SECRET ready (unchanged on re-runs)"

# Nightly backup cron — keeps 7 days, dumps to /var/backups/<APP_NAME>/
BACKUP_DIR="/var/backups/${APP_NAME}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
cat >/etc/cron.d/${APP_NAME}-pgbackup <<CRONEOF
# ${APP_NAME} — nightly Postgres backup at 02:30 UTC
30 2 * * * postgres pg_dump -Fc -f ${BACKUP_DIR}/${DB_NAME}-\$(date +\%Y\%m\%d).dump ${DB_NAME} && find ${BACKUP_DIR} -name '${DB_NAME}-*.dump' -mtime +7 -delete
CRONEOF
chmod 644 /etc/cron.d/${APP_NAME}-pgbackup
ok "    · Nightly backup configured (${BACKUP_DIR}, 7-day retention)"

# ---------- 7. Release folder layout (Capistrano-style) ----------------------
log "7/9 · Preparing release layout under $APP_ROOT"
mkdir -p "$APP_ROOT"/{releases,shared/logs}
chown -R "$APP_USER:$APP_USER" "$APP_ROOT"

# Note: .env.production is NOT created here. GitHub Actions writes it on
# every deploy from the APP_* secrets. The shared/ folder exists so scp
# has a destination — that's all.

# Log directory
mkdir -p /var/log/${APP_NAME}
chown -R "$APP_USER:$APP_USER" /var/log/${APP_NAME}

# Persist runtime config so vps-deploy.sh and PM2 use the auto-picked port.
# DATABASE_URL and AUTH_SECRET are included so GitHub Actions can fall back
# to local values when the APP_* secrets are not set — making zero-touch
# installs possible (no GitHub secrets required for the app runtime).
cat > "$APP_ROOT/shared/runtime.env" <<EOF
# Auto-written by vps-bootstrap.sh — DO NOT EDIT MANUALLY (re-run bootstrap)
APP_NAME=${APP_NAME}
APP_PORT=${APP_PORT}
APP_USER=${APP_USER}
APP_DOMAIN=${APP_DOMAIN}
# Fallbacks for APP_* GitHub secrets when those are not set
LOCAL_DATABASE_URL=${DATABASE_URL}
LOCAL_AUTH_SECRET=${AUTH_SECRET}
EOF
chown "$APP_USER:$APP_USER" "$APP_ROOT/shared/runtime.env"
chmod 600 "$APP_ROOT/shared/runtime.env"

# Also append PORT to .env.production so Next.js binds to the right port
if ! grep -q "^PORT=" "$APP_ROOT/shared/.env.production" 2>/dev/null; then
  echo "PORT=${APP_PORT}" >> "$APP_ROOT/shared/.env.production"
else
  sed -i "s/^PORT=.*/PORT=${APP_PORT}/" "$APP_ROOT/shared/.env.production"
fi
ok "Release layout ready (PORT=${APP_PORT} persisted)"

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
  # Note: we intentionally do NOT remove sites-enabled/default — other apps
  # on this box may rely on it. nginx routes by server_name, so leaving it
  # alone is safe; our ${APP_DOMAIN} vhost wins for our domain.
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
echo "  Env file    : $APP_ROOT/shared/.env.production  (auto-synced from GitHub Secrets each deploy)"
echo "  Runtime cfg : $APP_ROOT/shared/runtime.env  (auto-managed)"
echo "  Logs        : /var/log/${APP_NAME}/"
echo "  Domain      : https://${APP_DOMAIN}"
echo "  App port    : ${APP_PORT}  $( [[ "$APP_PORT" != "$ORIGINAL_PORT" ]] && echo "(auto-picked — $ORIGINAL_PORT was in use)" || echo "" )"
echo "  Database    : postgresql://${DB_USER}:***@127.0.0.1:5432/${DB_NAME}  (local, auto-provisioned)"
echo "  DB password : stored at $DB_PASS_FILE (root-only, never rotated)"
echo "  DB backups  : ${BACKUP_DIR}/  (nightly at 02:30 UTC, 7-day retention)"
echo "  AUTH_SECRET : stored at $AUTH_SECRET_FILE (root-only, never rotated)"
if [[ ${#OTHER_APPS[@]} -gt 0 ]]; then
  echo "  Co-tenants  : ${OTHER_APPS[*]}  (untouched)"
fi
echo
echo "==============================================================="
echo "  📋  ADD THESE TO GITHUB → Settings → Secrets and variables → Actions"
echo "==============================================================="
echo
echo "  Required (SSH transport only):"
echo "    VPS_HOST      = $(curl -s ifconfig.me || hostname -I | awk '{print $1}')"
echo "    VPS_USER      = $APP_USER"
echo "    VPS_PASSWORD  = (the password you assigned to ${APP_USER} manually)"
echo
echo "  Optional — leave unset for fully autonomous defaults from this VPS:"
echo "    VPS_PORT             = 22  (default)"
echo "    APP_DATABASE_URL     = (unset → uses local Postgres set up above)"
echo "    APP_AUTH_SECRET      = (unset → uses local secret set up above)"
echo "    APP_ANTHROPIC_API_KEY, APP_BLOB_READ_WRITE_TOKEN, APP_RESEND_API_KEY"
echo
echo "  This script DOES NOT create users, DOES NOT set passwords, and"
echo "  DOES NOT rotate anything. Re-running is fully idempotent."
echo
echo "  Then push to main — the workflow will deploy automatically."
echo "==============================================================="
