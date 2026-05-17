#!/usr/bin/env bash
# Runs every time the codespace starts (including resume from stop).
# Makes sure Postgres is running and starts the Next.js dev server in the
# background. Output goes to /tmp/dev-server.log so you can tail it.

set -euo pipefail

# Ensure Postgres is up (it may be stopped if codespace was paused)
if ! docker ps --format '{{.Names}}' | grep -q '^apicm-pg$'; then
  if docker ps -a --format '{{.Names}}' | grep -q '^apicm-pg$'; then
    echo "==> Restarting existing apicm-pg container..."
    docker start apicm-pg
  else
    echo "==> Postgres container missing — re-running oncreate..."
    bash .devcontainer/oncreate.sh
    exit 0
  fi
fi

# Wait for Postgres
until docker exec apicm-pg pg_isready -U postgres > /dev/null 2>&1; do
  sleep 1
done

# Start the Next.js dev server in the background
cd "$(dirname "$0")/../app"
nohup npm run dev > /tmp/dev-server.log 2>&1 &
echo $! > /tmp/dev-server.pid
echo "==> Next.js dev server starting (pid $(cat /tmp/dev-server.pid))."
echo "    Logs: tail -f /tmp/dev-server.log"
echo "    Once ready, open the forwarded URL for port 3000."
