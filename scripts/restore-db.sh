#!/usr/bin/env bash
# =============================================================================
#  cmipaportal.com — DATABASE RESTORE  (A2)
# =============================================================================
#  Restores a pg_dump custom-format backup produced by backup-db.sh.
#
#  DESTRUCTIVE: replaces the contents of the target database. Guarded behind
#  an explicit --yes flag so it can never run by accident (e.g. from a stray
#  cron or fat-fingered command).
#
#  Usage:
#      bash restore-db.sh --list                 # show available backups
#      bash restore-db.sh --yes [<dumpfile>]     # restore (defaults to latest)
#
#  Tested-restore procedure (do this periodically — an untested backup is not
#  a backup):
#      1. On the VPS, create a scratch DB:
#           sudo -u postgres createdb cmipaportal_restore_test
#      2. Restore the latest dump into it (NOT the live DB):
#           TARGET_DB=cmipaportal_restore_test bash restore-db.sh --yes
#      3. Spot-check row counts:
#           psql cmipaportal_restore_test -c 'SELECT count(*) FROM "Document";'
#      4. Drop the scratch DB:
#           sudo -u postgres dropdb cmipaportal_restore_test
#  A successful restore into the scratch DB proves the backup is good without
#  ever touching production.
# =============================================================================

set -Eeuo pipefail

APP_NAME="${APP_NAME:-cmipaportal}"
APP_ROOT="/var/www/${APP_NAME}"
DB_NAME="${DB_NAME:-$APP_NAME}"
DB_USER="${DB_USER:-$APP_NAME}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
# Override TARGET_DB to restore into a scratch DB instead of the live one.
TARGET_DB="${TARGET_DB:-$DB_NAME}"

BACKUP_DIR="${BACKUP_DIR:-$APP_ROOT/backups}"
DB_PASS_FILE="$APP_ROOT/shared/.db-password"

usage() { sed -n '2,40p' "$0"; exit 1; }

LIST=0
CONFIRM=0
DUMP=""
for arg in "$@"; do
  case "$arg" in
    --list) LIST=1 ;;
    --yes)  CONFIRM=1 ;;
    -h|--help) usage ;;
    *) DUMP="$arg" ;;
  esac
done

if [[ $LIST -eq 1 || $# -eq 0 ]]; then
  echo "Available backups in ${BACKUP_DIR}:"
  ls -lh "$BACKUP_DIR"/${DB_NAME}-*.dump 2>/dev/null || echo "  (none)"
  [[ -L "${BACKUP_DIR}/latest.dump" ]] && echo "latest → $(readlink -f "${BACKUP_DIR}/latest.dump")"
  [[ $LIST -eq 1 ]] && exit 0
fi

[[ -s "$DB_PASS_FILE" ]] || { echo "ERROR: ${DB_PASS_FILE} not found."; exit 1; }
command -v pg_restore >/dev/null 2>&1 || { echo "ERROR: pg_restore not on PATH."; exit 1; }

DUMP="${DUMP:-${BACKUP_DIR}/latest.dump}"
[[ -e "$DUMP" ]] || { echo "ERROR: dump not found: ${DUMP}"; exit 1; }
DUMP="$(readlink -f "$DUMP")"

if [[ $CONFIRM -ne 1 ]]; then
  echo "REFUSING to restore without --yes."
  echo "  Would restore: ${DUMP}"
  echo "  Into database: ${TARGET_DB}  (host ${DB_HOST}:${DB_PORT})"
  echo "Re-run with --yes to proceed. (See the tested-restore procedure at the top of this file.)"
  exit 2
fi

export PGPASSWORD
PGPASSWORD="$(cat "$DB_PASS_FILE")"

echo "Restoring ${DUMP}"
echo "       → ${TARGET_DB} on ${DB_HOST}:${DB_PORT}"
# --clean --if-exists drops existing objects first; --no-owner avoids role
# mismatches; single transaction so a failed restore leaves the DB unchanged.
pg_restore --clean --if-exists --no-owner --single-transaction \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TARGET_DB" "$DUMP"

echo "Restore complete into ${TARGET_DB}."
