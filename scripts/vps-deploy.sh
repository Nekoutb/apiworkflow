#!/usr/bin/env bash
# =============================================================================
#  cmipaportal.com  —  RELEASE DEPLOY  (runs on the VPS, invoked by GH Actions)
# =============================================================================
#  Strategy: Capistrano-style atomic releases
#
#    /var/www/cmipaportal/
#      ├── releases/
#      │     ├── 20260524-143022/   (each deploy = new folder)
#      │     ├── 20260524-150811/
#      │     └── 20260524-160419/   ← built artifact dropped here
#      ├── current  →  releases/20260524-160419/   (atomic symlink swap)
#      └── shared/
#            ├── .env.production    (never committed)
#            └── logs/
#
#  Steps:
#    1. Receive built artifact (already uploaded via rsync by GH Actions)
#    2. Symlink shared/.env.production into release
#    3. Run prisma db push (idempotent)
#    4. Start app on staging port → health check
#    5. Atomic symlink swap of `current`
#    6. PM2 restart pointing at new release
#    7. Verify via nginx → /_health
#    8. Prune old releases (keep last 5)
#    9. On any failure: rollback symlink + previous PM2 state
# =============================================================================

set -Eeuo pipefail

APP_NAME="${APP_NAME:-cmipaportal}"
APP_ROOT="/var/www/${APP_NAME}"

# Unix domain socket — no TCP port, no collision risk, no number to manage.
# nginx connects via:  proxy_pass http://unix:${SOCKET_PATH}:
SOCKET_PATH="${SOCKET_PATH:-/run/${APP_NAME}.sock}"

# Optional runtime.env (carries APP_DOMAIN set by bootstrap; PORT is gone)
if [[ -f "$APP_ROOT/shared/runtime.env" ]]; then
  # shellcheck disable=SC1091
  source "$APP_ROOT/shared/runtime.env"
fi

RELEASE="${1:?usage: vps-deploy.sh <release-folder-name>}"
RELEASE_DIR="${APP_ROOT}/releases/${RELEASE}"
CURRENT_LINK="${APP_ROOT}/current"
SHARED_ENV="${APP_ROOT}/shared/.env.production"
LOG_DIR="/var/log/${APP_NAME}"
LOG_FILE="${LOG_DIR}/deploy-${RELEASE}.log"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

mkdir -p "$LOG_DIR"

# Mirror stdout+stderr to both terminal and log file
exec > >(tee -a "$LOG_FILE") 2>&1

ts()    { date -u '+%Y-%m-%dT%H:%M:%SZ'; }
log()   { echo "[$(ts)] ▶ $*"; }
ok()    { echo "[$(ts)] ✓ $*"; }
warn()  { echo "[$(ts)] ⚠ $*" >&2; }
err()   { echo "[$(ts)] ✗ $*" >&2; }

# ---------- Pre-flight -------------------------------------------------------
log "Deploy starting · release=${RELEASE}"
log "Host: $(hostname)  ·  User: $(whoami)  ·  PWD: $(pwd)"

if [[ ! -d "$RELEASE_DIR" ]]; then
  err "Release directory not found: $RELEASE_DIR"; exit 1
fi

# ---------- -1. Sudo + infrastructure: bootstrap a bare VPS on first run ----
# The deploy script self-bootstraps a fresh box: installs Node 20, PM2,
# PostgreSQL, nginx, certbot, fail2ban, jq, openssl, curl if any are missing.
# Idempotent — re-runs are fast no-ops once everything is in place.
#
# Requires NOPASSWD sudo for the SSH user. The bootstrap script's sudoers
# rule grants that, but on a totally fresh box (no bootstrap ever) the
# operator must do this manually first:
#     echo '<user> ALL=(ALL) NOPASSWD: ALL' | sudo tee /etc/sudoers.d/<user>
#     sudo chmod 440 /etc/sudoers.d/<user>

# Fail fast if we can't sudo without a password (would otherwise hang)
if ! sudo -n true 2>/dev/null; then
  err "═══════════════════════════════════════════════════════════════════════"
  err " Cannot sudo without a password. The deploy script needs this to"
  err " install apt packages (Node, PostgreSQL, nginx, etc.) on first run."
  err ""
  err " Fix once on the VPS, then re-deploy:"
  err "   echo '$(whoami) ALL=(ALL) NOPASSWD: ALL' | sudo tee /etc/sudoers.d/$(whoami)"
  err "   sudo chmod 440 /etc/sudoers.d/$(whoami)"
  err "═══════════════════════════════════════════════════════════════════════"
  exit 1
fi

# Walk the list of binaries we need; collect what's missing
NEED_INSTALL=()
need() {
  local bin="$1"
  local apt_pkg="$2"
  if ! command -v "$bin" >/dev/null 2>&1; then
    NEED_INSTALL+=("$apt_pkg")
  fi
}

need curl curl
need openssl openssl
need jq jq
need ss iproute2
need psql postgresql
need nginx nginx
need certbot certbot
need ufw ufw
# fail2ban + python3-certbot-nginx don't ship a top-level binary on PATH,
# always include them (apt skips if already installed)
NEED_INSTALL+=("python3-certbot-nginx" "fail2ban")

# Node 20 is special: NodeSource repo, not a stock apt package
NEED_NODE=0
if ! command -v node >/dev/null 2>&1; then
  NEED_NODE=1
elif ! node -v 2>/dev/null | grep -q '^v20\.'; then
  log "  · Node $(node -v) detected, but we want v20 — will upgrade"
  NEED_NODE=1
fi

# PM2 is global npm — install AFTER node
NEED_PM2=0
if ! command -v pm2 >/dev/null 2>&1; then
  NEED_PM2=1
fi

# Anything to do?
if [[ ${#NEED_INSTALL[@]} -gt 0 || $NEED_NODE -eq 1 || $NEED_PM2 -eq 1 ]]; then
  log "Bootstrapping infrastructure (first deploy on this VPS)"
  export DEBIAN_FRONTEND=noninteractive
  sudo apt-get update -qq

  if [[ $NEED_NODE -eq 1 ]]; then
    log "  · Installing Node.js 20 (via NodeSource)"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null
    NEED_INSTALL+=("nodejs")
  fi

  if [[ ${#NEED_INSTALL[@]} -gt 0 ]]; then
    # Dedupe
    mapfile -t NEED_INSTALL < <(printf '%s\n' "${NEED_INSTALL[@]}" | sort -u)
    log "  · apt-get install ${NEED_INSTALL[*]}"
    sudo apt-get install -y -qq "${NEED_INSTALL[@]}"
  fi

  if [[ $NEED_PM2 -eq 1 ]]; then
    log "  · npm install -g pm2"
    sudo npm install -g pm2 >/dev/null
  fi

  # Ensure key services are enabled + running
  for svc in postgresql nginx fail2ban; do
    if ! systemctl is-active --quiet "$svc"; then
      log "  · enabling + starting $svc"
      sudo systemctl enable --now "$svc" >/dev/null 2>&1 || warn "could not start $svc"
    fi
  done

  ok "Infrastructure ready"
else
  log "Infrastructure already in place — skipping apt install"
fi

# ---------- -1b. Firewall: open 22, 80, 443 (additive, idempotent) ----------
# Critical for Let's Encrypt — port 80 must be reachable from the internet
# for HTTP-01 challenge. This handles UFW (the OS-level firewall). Cloud
# provider firewalls (Vultr, AWS Security Groups, etc.) are a separate
# layer and must be opened in their dashboard.
if command -v ufw >/dev/null 2>&1; then
  UFW_STATUS_LINE=$(sudo ufw status 2>/dev/null | head -1)
  if echo "$UFW_STATUS_LINE" | grep -qi "active"; then
    # UFW is active — just add our rules (existing rules untouched)
    sudo ufw allow OpenSSH       >/dev/null 2>&1 || sudo ufw allow 22/tcp >/dev/null 2>&1
    sudo ufw allow 'Nginx Full'  >/dev/null 2>&1 || { sudo ufw allow 80/tcp >/dev/null 2>&1; sudo ufw allow 443/tcp >/dev/null 2>&1; }
    log "UFW active — ensured SSH/HTTP/HTTPS rules present"
  else
    # UFW inactive — set rules first (so we don't lock ourselves out), then enable
    log "UFW inactive — enabling with SSH/HTTP/HTTPS allowed"
    sudo ufw allow OpenSSH       >/dev/null 2>&1 || sudo ufw allow 22/tcp >/dev/null 2>&1
    sudo ufw allow 80/tcp        >/dev/null 2>&1
    sudo ufw allow 443/tcp       >/dev/null 2>&1
    yes | sudo ufw enable        >/dev/null 2>&1 || warn "ufw enable failed"
  fi
fi
# Also flush any DROP rules iptables may have for 80/443 (some VPS images
# pre-configure iptables instead of/in addition to UFW)
if command -v iptables >/dev/null 2>&1; then
  for port in 80 443; do
    if ! sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null; then
      sudo iptables -I INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null || true
    fi
  done
fi
ok "Firewall: ports 22, 80, 443 open"

# ---------- -1c. Confirm port 80 is reachable from the INTERNET -------------
# Hard gate. We test through an external HTTP-fetch proxy so the result
# reflects what Let's Encrypt and real users will see. If the OS firewall is
# open but the cloud provider firewall (Vultr / DigitalOcean / AWS SG / etc.)
# is still blocking, this fails the deploy with clear remediation steps.
#
# Returns:
#   0  = reachable
#   1  = definitively unreachable (proxy responded with failure)
#   2  = inconclusive (proxies themselves down) — treated as a warning
verify_external_port() {
  local target_url="$1"
  # URL-encode the target (only the special chars we expect)
  local enc="$target_url"
  enc="${enc//:/%3A}"
  enc="${enc//\//%2F}"
  local got_any_response=0

  for proxy_name in allorigins corsproxy; do
    local probe
    case "$proxy_name" in
      allorigins) probe="https://api.allorigins.win/raw?url=${enc}" ;;
      corsproxy)  probe="https://corsproxy.io/?url=${enc}" ;;
    esac
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" -m 15 "$probe" 2>/dev/null || echo "000")
    log "  · ${proxy_name} → HTTP ${code}"
    if [[ "$code" =~ ^[0-9]{3}$ && "$code" != "000" && "$code" != "502" && "$code" != "503" ]]; then
      got_any_response=1
      [[ "$code" =~ ^2 ]] && return 0
    fi
  done

  [[ $got_any_response -eq 0 ]] && return 2
  return 1
}

# Make sure nginx is responding on :80 (default page is fine for the probe)
if ! systemctl is-active --quiet nginx; then
  sudo systemctl start nginx
  sleep 2
fi

# Pick the probe target: domain if DNS points here, else our public IP
PUBLIC_IP=$(curl -fsS -m 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
PROBE_DOMAIN="${APP_DOMAIN:-cmipaportal.com}"
RESOLVED_IP=$(getent hosts "$PROBE_DOMAIN" 2>/dev/null | awk '{print $1; exit}')
if [[ "$RESOLVED_IP" == "$PUBLIC_IP" ]]; then
  PROBE_TARGET="$PROBE_DOMAIN"
else
  PROBE_TARGET="$PUBLIC_IP"
  warn "DNS for $PROBE_DOMAIN doesn't resolve to ${PUBLIC_IP} yet (got: ${RESOLVED_IP:-none})"
  warn "  Falling back to direct IP probe — SSL will be skipped until DNS is fixed."
fi

log "Verifying port 80 is reachable from the internet (target: http://${PROBE_TARGET}/)"
verify_external_port "http://${PROBE_TARGET}/"
case $? in
  0)
    ok "Port 80 confirmed reachable from the public internet"
    ;;
  1)
    err "═══════════════════════════════════════════════════════════════════════"
    err " Port 80 is NOT reachable from the internet"
    err "═══════════════════════════════════════════════════════════════════════"
    err " OS firewall (UFW + iptables) was just opened by this script. So the"
    err " block is at the CLOUD PROVIDER layer. Fix in your dashboard:"
    err ""
    err "   Vultr        → Firewall → your firewall group → add inbound rule:"
    err "                    Action=Accept  Protocol=TCP  Port=80    Source=0.0.0.0/0"
    err "                    Action=Accept  Protocol=TCP  Port=443   Source=0.0.0.0/0"
    err "   DigitalOcean → Networking → Firewalls → Inbound rules"
    err "   AWS          → EC2 → Security Groups → Inbound rules"
    err "   Hetzner      → Cloud Console → Firewalls → Inbound rules"
    err ""
    err " Verify from your laptop (NOT from the VPS):"
    err "   curl -v -m 5 http://${PUBLIC_IP}/"
    err ""
    err " Then re-trigger this workflow."
    err "═══════════════════════════════════════════════════════════════════════"
    exit 1
    ;;
  2)
    warn "Could not verify port 80 externally (both reachability proxies are down)."
    warn "Continuing optimistically — certbot will be the real test."
    ;;
esac

# Now safe to print versions
log "Node: $(node -v)  ·  npm: $(npm -v)  ·  PM2: $(pm2 -v)  ·  psql: $(psql --version | awk '{print $3}')  ·  nginx: $(nginx -v 2>&1 | awk -F/ '{print $2}')"

# Ensure /var/www/$APP_NAME exists and is owned by the SSH user
# (bootstrap normally does this; we do it here too in case bootstrap was never run)
if [[ ! -d "$APP_ROOT" ]]; then
  sudo install -d -m 755 -o "$(whoami)" -g "$(whoami)" "$APP_ROOT"
  sudo install -d -m 755 -o "$(whoami)" -g "$(whoami)" "$APP_ROOT/releases" "$APP_ROOT/shared" "$APP_ROOT/shared/logs"
  ok "Created $APP_ROOT layout (owned by $(whoami))"
fi
if [[ ! -d "$LOG_DIR" ]]; then
  sudo install -d -m 755 -o "$(whoami)" -g "$(whoami)" "$LOG_DIR"
fi

# ---------- 0. Pre-flight: inspect server for co-tenants -------------------
# Mirrors the inspection step in vps-bootstrap.sh but runs on EVERY deploy.
# Adapts to whatever else is running on this shared box:
#   - Refuses to overwrite an nginx vhost that already claims our domain
#   - Lists other /var/www apps so the operator knows we're co-tenants
#   - Warns if our port is held by something OTHER than our own PM2 process
#   - Lists other PM2 processes + SSL certs (informational)
#
# Hard failures: another vhost serving cmipaportal.com (would clobber it)
# Soft warnings: everything else
log "Pre-flight: inspecting server for co-tenants"

APP_DOMAIN_PEEK="${APP_DOMAIN:-cmipaportal.com}"

# 0a. Other apps under /var/www (informational)
OTHER_APPS=()
if [[ -d /var/www ]]; then
  while IFS= read -r dir; do
    name="$(basename "$dir")"
    [[ "$name" == "$APP_NAME" || "$name" == "html" ]] && continue
    OTHER_APPS+=("$name")
  done < <(find /var/www -mindepth 1 -maxdepth 1 -type d 2>/dev/null)
fi
if [[ ${#OTHER_APPS[@]} -gt 0 ]]; then
  log "  · Other apps under /var/www (untouched): ${OTHER_APPS[*]}"
fi

# 0b. nginx vhost conflict — HARD FAIL if someone else claims our domain
if [[ -d /etc/nginx/sites-enabled ]]; then
  CONFLICTING_VHOST=$(grep -rlE "server_name[^;]*[[:space:]]${APP_DOMAIN_PEEK}([[:space:];]|$)" \
    /etc/nginx/sites-enabled/ 2>/dev/null \
    | grep -v "/${APP_NAME}\$" \
    | head -1 || true)
  if [[ -n "$CONFLICTING_VHOST" ]]; then
    err "════════════════════════════════════════════════════════════════════"
    err " nginx vhost CONFLICT — another vhost already claims ${APP_DOMAIN_PEEK}"
    err "════════════════════════════════════════════════════════════════════"
    err "  Conflicting file: $CONFLICTING_VHOST"
    err ""
    err "  Refusing to overwrite. To proceed, on the VPS:"
    err "    sudo nano $CONFLICTING_VHOST   # remove or rename"
    err "    sudo nginx -t && sudo systemctl reload nginx"
    err "    # then re-trigger this deploy"
    err "════════════════════════════════════════════════════════════════════"
    exit 1
  fi
fi

# 0c. Stale socket check — remove leftover socket from a crashed previous run
#     (the new server.js does this too, but doing it here makes pre-flight clean)
if [[ -S "$SOCKET_PATH" ]]; then
  # Check if anything is actually listening on it
  if ! ss -lx "src = $SOCKET_PATH" 2>/dev/null | grep -q "$SOCKET_PATH"; then
    log "  · Removing stale socket: $SOCKET_PATH (no listener)"
    sudo rm -f "$SOCKET_PATH"
  else
    log "  · Existing socket has a live listener (our own PM2 process — fine)"
  fi
fi

# 0d. Other PM2 processes (informational)
if command -v pm2 >/dev/null; then
  PM2_OTHERS=$(pm2 jlist 2>/dev/null | jq -r '.[].name' 2>/dev/null | grep -v "^${APP_NAME}\$" || true)
  if [[ -n "$PM2_OTHERS" ]]; then
    log "  · Other PM2 processes (untouched): $(echo $PM2_OTHERS | tr '\n' ' ')"
  fi
fi

# 0e. Other Let's Encrypt certs (informational — confirms we won't trample)
if [[ -d /etc/letsencrypt/live ]]; then
  OTHER_CERTS=$(ls /etc/letsencrypt/live/ 2>/dev/null \
    | grep -vE "^(README|${APP_DOMAIN_PEEK})\$" || true)
  if [[ -n "$OTHER_CERTS" ]]; then
    log "  · Other SSL certs (untouched): $(echo $OTHER_CERTS | tr '\n' ' ')"
  fi
fi

ok "Pre-flight clear — proceeding with deploy"

# ---------- 1. Self-heal: ensure AUTH_SECRET + DATABASE_URL exist -----------
# All app secrets live on the VPS only — no GitHub APP_* secrets used.
# This block makes the deploy idempotent and self-bootstrapping: it generates
# what's missing once, persists it under shared/, and reuses it on every
# subsequent deploy. Never rotates anything that already exists.
mkdir -p "$APP_ROOT/shared"

log "Resolving runtime configuration (no GitHub APP_* secrets used)"

# 1a. AUTH_SECRET — generate once, persist forever, never rotate
AUTH_FILE="$APP_ROOT/shared/.auth-secret"
if [[ ! -s "$AUTH_FILE" ]]; then
  log "  · Generating AUTH_SECRET (first deploy)"
  openssl rand -base64 32 > "$AUTH_FILE"
  chmod 600 "$AUTH_FILE"
fi
AUTH_SECRET="$(cat "$AUTH_FILE")"

# 1b. DB password — prefer existing .db-password, then runtime.env, then create
DB_NAME="$APP_NAME"
DB_USER="$APP_NAME"
DB_PASS_FILE="$APP_ROOT/shared/.db-password"

if [[ ! -s "$DB_PASS_FILE" && -f "$APP_ROOT/shared/runtime.env" ]]; then
  # Recover password from bootstrap-written runtime.env LOCAL_DATABASE_URL
  RUNTIME_URL=$(grep -E '^LOCAL_DATABASE_URL=' "$APP_ROOT/shared/runtime.env" | cut -d= -f2-)
  if [[ -n "$RUNTIME_URL" ]]; then
    EXTRACTED_PASS=$(echo "$RUNTIME_URL" | sed -nE 's|^postgres(ql)?://[^:]+:([^@]+)@.*|\2|p')
    if [[ -n "$EXTRACTED_PASS" ]]; then
      echo -n "$EXTRACTED_PASS" > "$DB_PASS_FILE"
      chmod 600 "$DB_PASS_FILE"
      log "  · Recovered DB password from runtime.env"
    fi
  fi
fi

# True first-run path: PostgreSQL exists, but the DB/user/password don't
if [[ ! -s "$DB_PASS_FILE" ]]; then
  if ! command -v psql >/dev/null; then
    err "PostgreSQL is not installed. Run vps-bootstrap.sh on the VPS first"
    err "(it installs PostgreSQL 16 with apt — needs root)."
    exit 1
  fi
  log "  · Provisioning PostgreSQL role + database (first ever deploy)"
  DB_PASSWORD="$(openssl rand -base64 30 | tr -d '/+=' | cut -c1-28)"
  echo -n "$DB_PASSWORD" > "$DB_PASS_FILE"
  chmod 600 "$DB_PASS_FILE"

  # Idempotent: CREATE if missing, ALTER otherwise (always sync the password)
  if sudo -n -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" 2>/dev/null | grep -q 1; then
    sudo -n -u postgres psql -c "ALTER USER \"${DB_USER}\" WITH ENCRYPTED PASSWORD '${DB_PASSWORD}';" >/dev/null
  else
    sudo -n -u postgres psql -c "CREATE USER \"${DB_USER}\" WITH ENCRYPTED PASSWORD '${DB_PASSWORD}';" >/dev/null
  fi
  if ! sudo -n -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null | grep -q 1; then
    sudo -n -u postgres psql -c "CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_USER}\" ENCODING 'UTF8';" >/dev/null
  fi
  sudo -n -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO \"${DB_USER}\";" >/dev/null
  ok "  · PostgreSQL role + database ready"
fi

DB_PASSWORD="$(cat "$DB_PASS_FILE")"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}"

# Read domain from runtime.env (set by bootstrap) — default to cmipaportal.com
APP_DOMAIN_VAL="${APP_DOMAIN:-cmipaportal.com}"
if [[ -f "$APP_ROOT/shared/runtime.env" ]]; then
  RT_DOMAIN=$(grep -E '^APP_DOMAIN=' "$APP_ROOT/shared/runtime.env" | cut -d= -f2-)
  [[ -n "$RT_DOMAIN" ]] && APP_DOMAIN_VAL="$RT_DOMAIN"
fi

# 1c. Compose .env.production (always overwritten — single source of truth)
cat > "$SHARED_ENV" <<EOF
# Auto-written by vps-deploy.sh on $(date -u '+%Y-%m-%dT%H:%M:%SZ')
# DO NOT EDIT MANUALLY — values are regenerated from shared/.auth-secret,
# shared/.db-password, and shared/runtime.env on every deploy.
DATABASE_URL="${DATABASE_URL}"
AUTH_SECRET="${AUTH_SECRET}"
AUTH_URL="https://${APP_DOMAIN_VAL}"
NEXTAUTH_URL="https://${APP_DOMAIN_VAL}"
NODE_ENV="production"
SOCKET_PATH="${SOCKET_PATH}"
AUTH_TRUST_HOST="true"

# Optional integrations — edit this file directly if/when you obtain keys
ANTHROPIC_API_KEY=""
BLOB_READ_WRITE_TOKEN=""
RESEND_API_KEY=""
EOF
chmod 600 "$SHARED_ENV"
ok ".env.production composed locally (SOCKET=$SOCKET_PATH)"

PREVIOUS_RELEASE=""
if [[ -L "$CURRENT_LINK" ]]; then
  PREVIOUS_RELEASE="$(readlink -f "$CURRENT_LINK")"
  log "Previous release: $PREVIOUS_RELEASE"
fi

# ---------- Rollback handler -------------------------------------------------
rollback() {
  err "FAILURE detected — rolling back"
  if [[ -n "$PREVIOUS_RELEASE" && -d "$PREVIOUS_RELEASE" ]]; then
    ln -sfn "$PREVIOUS_RELEASE" "$CURRENT_LINK"
    cd "$CURRENT_LINK/app"
    pm2 restart "$APP_NAME" --update-env || pm2 start npm --name "$APP_NAME" -- start
    err "Rolled back to $PREVIOUS_RELEASE"
  else
    err "No previous release to roll back to"
  fi
  exit 1
}
trap rollback ERR

# ---------- 1. Wire env file -------------------------------------------------
log "Linking shared env file into release"
ln -sf "$SHARED_ENV" "$RELEASE_DIR/app/.env.production"
ok   "Env linked"

# ---------- 2. Install + build (already done by CI — but re-link node_modules)
# We copy node_modules from previous release if compatible (faster), else fresh install.
cd "$RELEASE_DIR/app"

if [[ -d "${PREVIOUS_RELEASE}/app/node_modules" ]] && \
   cmp -s package-lock.json "${PREVIOUS_RELEASE}/app/package-lock.json"; then
  log "Reusing node_modules from previous release (lockfile identical)"
  cp -al "${PREVIOUS_RELEASE}/app/node_modules" "$RELEASE_DIR/app/node_modules" 2>/dev/null \
    || cp -a "${PREVIOUS_RELEASE}/app/node_modules" "$RELEASE_DIR/app/node_modules"
else
  log "Installing dependencies (npm ci, production)"
  npm ci --no-audit --no-fund --omit=dev
  # Prisma needs to be available as a dep for db push
  npm install --no-save --no-audit --no-fund prisma
fi
ok "Dependencies ready"

# ---------- 3. Database: seed-if-empty, then prisma sync --------------------
log "Loading runtime env for DB connection"
set -a; . "$SHARED_ENV"; set +a

# 3a. Detect whether the public schema is already populated. We count user
#     tables — if zero, this is a fresh DB and we import the initial seed
#     (which includes schema + reference data + admin users). On subsequent
#     deploys, this check returns >0 and the seed is skipped.
log "Checking database state (DATABASE_URL=postgresql://***@$(echo "$DATABASE_URL" | sed -E 's|.*@([^/]+)/.*|\1|'))"

TABLE_COUNT="$(psql "$DATABASE_URL" -tAc \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'" \
  2>/dev/null | tr -d '[:space:]')"

if [[ -z "$TABLE_COUNT" ]]; then
  err "Cannot connect to database — check DATABASE_URL in $SHARED_ENV"
  exit 1
fi

SEED_FILE="$RELEASE_DIR/scripts/initial-seed.sql"
if [[ "$TABLE_COUNT" -eq 0 ]]; then
  if [[ -f "$SEED_FILE" ]]; then
    log "Database is empty — importing initial seed from scripts/initial-seed.sql"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SEED_FILE" >/dev/null
    SEEDED_COUNT="$(psql "$DATABASE_URL" -tAc \
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'" \
      | tr -d '[:space:]')"
    ok "Initial seed imported · $SEEDED_COUNT tables created"
  else
    log "Database is empty and no seed file shipped — prisma db push will create the schema"
  fi
else
  log "Database already has $TABLE_COUNT tables — skipping initial seed"
fi

# 3b. Run prisma generate + db push.
#     - On a fresh seed import, db push is a no-op (schema already matches).
#     - On schema migrations, db push applies the diff (no data loss).
log "Running prisma generate + db push"
npx prisma generate
npx prisma db push --skip-generate --accept-data-loss=false
ok "Database schema in sync"

# ---------- 4. Atomic symlink swap ------------------------------------------
log "Swapping 'current' symlink → $RELEASE_DIR"
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
ok "Symlink swapped"

# ---------- 5. PM2 restart (zero-downtime reload) ---------------------------
log "Restarting PM2 process (socket: ${SOCKET_PATH})"
cd "$CURRENT_LINK/app"

# Ensure the directory for the socket exists and is writable by us.
# /run is tmpfs on most distros — recreated on reboot.
SOCKET_DIR="$(dirname "$SOCKET_PATH")"
if [[ ! -d "$SOCKET_DIR" ]]; then
  sudo install -d -m 755 -o "$(whoami)" -g "$(whoami)" "$SOCKET_DIR"
fi

# Export SOCKET_PATH so `npm start` → `node server.js` knows where to listen
export SOCKET_PATH

# ecosystem on the fly so PM2 always points at $CURRENT_LINK/app
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$APP_NAME" --update-env
else
  pm2 start npm --name "$APP_NAME" \
    --cwd "$CURRENT_LINK/app" \
    --log "$LOG_DIR/pm2.log" \
    --time \
    -- start
  pm2 save
fi
ok "PM2 restarted (listening on unix:${SOCKET_PATH})"

# ---------- 6. Health check -------------------------------------------------
log "Waiting for app to respond on unix:${SOCKET_PATH}"
HEALTHY=0
for i in {1..30}; do
  if curl -sf -o /dev/null -m 3 --unix-socket "$SOCKET_PATH" "http://localhost/_health" 2>/dev/null \
     || curl -sf -o /dev/null -m 3 --unix-socket "$SOCKET_PATH" "http://localhost/" 2>/dev/null; then
    HEALTHY=1
    log "Health OK after ${i} attempt(s)"
    break
  fi
  sleep 2
done

if [[ $HEALTHY -ne 1 ]]; then
  err "App did not become healthy within 60s"
  pm2 logs "$APP_NAME" --lines 80 --nostream || true
  rollback
fi
# ---------- 6b. Ensure nginx vhost + SSL are in place (self-healing) --------
# The app is already healthy locally at this point. Everything below is about
# making it reachable over the public domain. Any failure here is a WARNING,
# not a deploy failure — we disarm the rollback trap so partial public-facing
# setup (e.g. DNS not pointing yet) doesn't trash a successful release.
trap - ERR
set +e

ensure_nginx_running() {
  if ! systemctl is-active --quiet nginx; then
    log "nginx is not active — enabling and starting"
    sudo systemctl enable --now nginx || warn "failed to start nginx"
  fi
}

reload_or_start_nginx() {
  sudo nginx -t >/dev/null 2>&1 || { warn "nginx config invalid — skipping reload"; return 1; }
  if systemctl is-active --quiet nginx; then
    sudo systemctl reload nginx || sudo systemctl restart nginx
  else
    sudo systemctl enable --now nginx
  fi
}

NGINX_AVAIL="/etc/nginx/sites-available/${APP_NAME}"
NGINX_LINK="/etc/nginx/sites-enabled/${APP_NAME}"

ensure_nginx_running

# Define an upstream block once — keeps the vhost clean and makes future
# socket-path changes a one-line edit.
NGINX_UPSTREAM="/etc/nginx/conf.d/${APP_NAME}-upstream.conf"
TMP_UPSTREAM="$(mktemp)"
cat > "$TMP_UPSTREAM" <<UPSTREAMEOF
# ${APP_NAME} — managed by vps-deploy.sh
upstream ${APP_NAME}_upstream {
    server unix:${SOCKET_PATH};
    keepalive 32;
}
UPSTREAMEOF
sudo install -m 644 -o root -g root "$TMP_UPSTREAM" "$NGINX_UPSTREAM"
rm -f "$TMP_UPSTREAM"

if [[ ! -f "$NGINX_AVAIL" ]]; then
  log "Installing nginx vhost for ${APP_DOMAIN_VAL} (unix socket)"
  TMP_VHOST="$(mktemp)"
  cat > "$TMP_VHOST" <<NGINXEOF
# ${APP_NAME} — managed by vps-deploy.sh
server {
    listen 80;
    listen [::]:80;
    server_name ${APP_DOMAIN_VAL} www.${APP_DOMAIN_VAL};
    client_max_body_size 50M;

    location = /_health {
        access_log off;
        proxy_pass http://${APP_NAME}_upstream/_health;
    }

    location / {
        proxy_pass http://${APP_NAME}_upstream;
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

    location /_next/static/ {
        proxy_pass http://${APP_NAME}_upstream;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
NGINXEOF
  sudo install -m 644 -o root -g root "$TMP_VHOST" "$NGINX_AVAIL"
  rm -f "$TMP_VHOST"
  sudo ln -sf "$NGINX_AVAIL" "$NGINX_LINK"
  if reload_or_start_nginx; then
    ok "nginx vhost installed (upstream: unix:${SOCKET_PATH})"
  else
    warn "nginx vhost written but service couldn't be started — investigate manually"
  fi
else
  # Reload anyway in case the upstream socket path changed
  reload_or_start_nginx >/dev/null 2>&1 || true
  log "nginx vhost already present at $NGINX_AVAIL (upstream conf refreshed)"
fi

# Let's Encrypt — issue cert if not present (requires DNS to point here)
SSL_LIVE="/etc/letsencrypt/live/${APP_DOMAIN_VAL}"
if [[ ! -d "$SSL_LIVE" ]]; then
  log "No SSL cert for ${APP_DOMAIN_VAL} yet — attempting Let's Encrypt"

  # DNS sanity: compare resolved IP vs this server's public IP
  EXPECTED_IP="$(curl -fsS -m 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
  RESOLVED_IP="$(getent hosts "$APP_DOMAIN_VAL" | awk '{print $1; exit}')"
  if [[ -z "$RESOLVED_IP" ]]; then
    warn "DNS for ${APP_DOMAIN_VAL} doesn't resolve to anything yet."
    warn "→ At your registrar, add an A record: ${APP_DOMAIN_VAL} → ${EXPECTED_IP}"
    warn "→ Also: www.${APP_DOMAIN_VAL} → ${EXPECTED_IP}"
    warn "→ Wait for propagation (often <5 min), then re-trigger the deploy."
  elif [[ "$RESOLVED_IP" != "$EXPECTED_IP" ]]; then
    warn "DNS for ${APP_DOMAIN_VAL} resolves to ${RESOLVED_IP}, but this server is ${EXPECTED_IP}."
    warn "→ Update the A record at your registrar, then re-trigger the deploy."
  else
    log "DNS OK (${APP_DOMAIN_VAL} → ${EXPECTED_IP}). Port 80 was already verified"
    log "reachable from the internet (step -1c). Running certbot."
    CERTBOT_EMAIL="admin@${APP_DOMAIN_VAL}"
    if sudo certbot --nginx \
         -d "${APP_DOMAIN_VAL}" -d "www.${APP_DOMAIN_VAL}" \
         --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect; then
      ok "Let's Encrypt SSL issued · auto-renew via certbot.timer"
    else
      warn "certbot failed despite reachability check passing"
      warn "Check /var/log/letsencrypt/letsencrypt.log on the VPS"
    fi
  fi
else
  log "SSL cert present at $SSL_LIVE"
fi

# ---------- 6c. Confirm port 443 is reachable from the INTERNET -------------
# Hard gate (matching the port-80 gate). Only runs if a cert exists for our
# domain. Without one, port 443 isn't expected to be reachable yet.
if [[ -d "$SSL_LIVE" ]]; then
  log "Verifying port 443 is reachable from the internet (target: https://${APP_DOMAIN_VAL}/)"
  verify_external_port "https://${APP_DOMAIN_VAL}/"
  case $? in
    0)
      ok "Port 443 confirmed reachable with valid SSL"
      ;;
    1)
      err "═══════════════════════════════════════════════════════════════════════"
      err " Port 443 is NOT reachable from the internet"
      err "═══════════════════════════════════════════════════════════════════════"
      err " SSL cert was issued successfully but external clients can't reach HTTPS."
      err " Open inbound TCP 443 in your cloud provider's firewall:"
      err "   Vultr → Firewall → add: Accept TCP 443 from 0.0.0.0/0"
      err ""
      err " Verify from your laptop:  curl -v -m 5 https://${APP_DOMAIN_VAL}/"
      err " Then re-trigger this workflow."
      err "═══════════════════════════════════════════════════════════════════════"
      exit 1
      ;;
    2)
      warn "Could not verify port 443 externally (proxy services unavailable)."
      warn "Workflow smoke test (next step) will probe it directly."
      ;;
  esac
fi

# Re-arm strict error handling for the rest of the script
set -e

# ---------- 7. Prune old releases -------------------------------------------
log "Pruning old releases (keeping last ${KEEP_RELEASES})"
cd "${APP_ROOT}/releases"
# shellcheck disable=SC2012
ls -1tr | head -n -"${KEEP_RELEASES}" | while read -r old; do
  if [[ "$(readlink -f "$CURRENT_LINK")" != "${APP_ROOT}/releases/${old}" ]]; then
    log "  removing old release: $old"
    rm -rf "${APP_ROOT}/releases/${old}"
  fi
done
ok "Prune done"

# ---------- 8. Done ----------------------------------------------------------
trap - ERR
echo
echo "==============================================================="
echo "  ✅  DEPLOY SUCCESSFUL"
echo "==============================================================="
echo "  Release  : $RELEASE"
echo "  Active   : $(readlink -f "$CURRENT_LINK")"
echo "  Log      : $LOG_FILE"
echo "==============================================================="
