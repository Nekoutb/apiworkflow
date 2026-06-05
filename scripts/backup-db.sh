#!/usr/bin/env bash
# =============================================================================
#  cmipaportal.com — DATABASE BACKUP  (A2)
# =============================================================================
#  Nightly logical backup of the local PostgreSQL database.
#
#  - pg_dump custom format (-Fc): compressed, supports selective + parallel
#    restore via pg_restore. Single self-contained file per run.
#  - Written to $APP_ROOT/backups, mode 600, owned by the deploy user.
#  - Retention: keeps the last $KEEP_DAYS daily dumps, prunes older ones.
#  - A `latest.dump` symlink always points at the most recent good backup.
#  - Reads the DB password from shared/.db-password (never hard-coded).
#  - Verifies the dump is non-empty and listable (pg_restore -l) before it is
#    considered good — a corrupt/aborted dump never silently replaces a good
#    history.
#
#  Installed as a daily cron by vps-deploy.sh. Safe to run by hand:
#      bash backup-db.sh
#
#  OFF-BOX COPY (recommended, manual/ops step): these dumps live on the same
#  VPS as the database, so they survive an accidental `prisma db push` or a
#  bad migration, but NOT a full disk loss. Pull them to separate storage,
#  e.g. from an admin workstation:
#      scp <user>@<vps>:/var/www/cmipaportal/backups/latest.dump ./
#  or schedule an rsync from a backup host. See scripts/restore-db.sh to
#  restore.
# =============================================================================

set -Eeuo pipefail

APP_NAME="${APP_NAME:-cmipaportal}"
APP_ROOT="/var/www/${APP_NAME}"
DB_NAME="${DB_NAME:-$APP_NAME}"
DB_USER="${DB_USER:-$APP_NAME}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"

BACKUP_DIR="${BACKUP_DIR:-$APP_ROOT/backups}"
DB_PASS_FILE="$APP_ROOT/shared/.db-password"
KEEP_DAYS="${KEEP_DAYS:-14}"

LOG_DIR="/var/log/${APP_NAME}"
LOG_FILE="${LOG_DIR}/backup.log"

ts()   { date -u '+%Y-%m-%dT%H:%M:%SZ'; }
log()  { echo "[$(ts)] $*"; }

mkdir -p "$LOG_DIR" 2>/dev/null || sudo mkdir -p "$LOG_DIR"
exec >>"$LOG_FILE" 2>&1

log "──────── backup start (db=${DB_NAME}) ────────"

if [[ ! -s "$DB_PASS_FILE" ]]; then
  log "ERROR: DB password file not found at ${DB_PASS_FILE}. Has the app been deployed?"
  exit 1
fi
if ! command -v pg_dump >/dev/null 2>&1; then
  log "ERROR: pg_dump not on PATH. Install postgresql-client."
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date -u '+%Y%m%d-%H%M%S')"
OUT="${BACKUP_DIR}/${DB_NAME}-${STAMP}.dump"
TMP="${OUT}.partial"

export PGPASSWORD
PGPASSWORD="$(cat "$DB_PASS_FILE")"

# --- dump to a .partial file first, promote only on success ---
if pg_dump -Fc -Z6 \
      -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
      -f "$TMP"; then
  :
else
  log "ERROR: pg_dump failed. Leaving previous backups untouched."
  rm -f "$TMP"
  exit 1
fi

# --- verify the dump is non-empty and structurally listable ---
if [[ ! -s "$TMP" ]]; then
  log "ERROR: dump is empty. Discarding."
  rm -f "$TMP"
  exit 1
fi
if ! pg_restore -l "$TMP" >/dev/null 2>&1; then
  log "ERROR: dump failed pg_restore -l integrity listing. Discarding."
  rm -f "$TMP"
  exit 1
fi

chmod 600 "$TMP"
mv "$TMP" "$OUT"
ln -sfn "$OUT" "${BACKUP_DIR}/latest.dump"

SIZE="$(du -h "$OUT" | cut -f1)"
log "OK: wrote ${OUT} (${SIZE})  → latest.dump"

# --- retention: prune dumps older than KEEP_DAYS (never touches the symlink) ---
PRUNED=0
while IFS= read -r old; do
  rm -f "$old" && PRUNED=$((PRUNED + 1))
done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name "${DB_NAME}-*.dump" -mtime "+${KEEP_DAYS}" 2>/dev/null)
log "Retention: kept last ${KEEP_DAYS} day(s); pruned ${PRUNED} old dump(s)."

REMAINING="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "${DB_NAME}-*.dump" | wc -l | tr -d ' ')"
log "──────── backup done · ${REMAINING} dump(s) on disk ────────"
