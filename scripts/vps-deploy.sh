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
if [[ ! -f "$SHARED_ENV" ]]; then
  err "Missing $SHARED_ENV — edit it on the server then re-deploy"; exit 1
fi

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

# ---------- 3. Prisma db push (idempotent, no data loss) --------------------
log "Running prisma generate + db push"
set -a; . "$SHARED_ENV"; set +a
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
