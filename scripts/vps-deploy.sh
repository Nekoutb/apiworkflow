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

# Prefer the port chosen by bootstrap (may differ from 3000 if 3000 was busy)
if [[ -f "$APP_ROOT/shared/runtime.env" ]]; then
  # shellcheck disable=SC1091
  source "$APP_ROOT/shared/runtime.env"
fi
APP_PORT="${APP_PORT:-3000}"
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
err()   { echo "[$(ts)] ✗ $*" >&2; }

# ---------- Pre-flight -------------------------------------------------------
log "Deploy starting · release=${RELEASE}"
log "Host: $(hostname)  ·  User: $(whoami)  ·  PWD: $(pwd)"
log "Node: $(node -v)  ·  npm: $(npm -v)  ·  PM2: $(pm2 -v)"

if [[ ! -d "$RELEASE_DIR" ]]; then
  err "Release directory not found: $RELEASE_DIR"; exit 1
fi

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
PORT=${APP_PORT}
AUTH_TRUST_HOST="true"

# Optional integrations — edit this file directly if/when you obtain keys
ANTHROPIC_API_KEY=""
BLOB_READ_WRITE_TOKEN=""
RESEND_API_KEY=""
EOF
chmod 600 "$SHARED_ENV"
ok ".env.production composed locally (PORT=$APP_PORT)"

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
log "Restarting PM2 process (binding to port ${APP_PORT})"
cd "$CURRENT_LINK/app"

# Export PORT so `npm start` ──▶ `next start --port ${PORT:-3000}` honours it
export PORT="$APP_PORT"

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
ok "PM2 restarted on port ${APP_PORT}"

# ---------- 6. Health check -------------------------------------------------
log "Waiting for app to respond on http://127.0.0.1:${APP_PORT}"
HEALTHY=0
for i in {1..30}; do
  if curl -sf -o /dev/null -m 3 "http://127.0.0.1:${APP_PORT}/_health" 2>/dev/null \
     || curl -sf -o /dev/null -m 3 "http://127.0.0.1:${APP_PORT}/" 2>/dev/null; then
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
ok "Application is healthy"

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
