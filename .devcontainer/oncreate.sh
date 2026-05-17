#!/usr/bin/env bash
# Runs ONCE when the codespace is first created.
# - Spins up a PostgreSQL container via Docker-in-Docker
# - Installs app dependencies
# - Pushes the Prisma schema and seeds the database

set -euo pipefail

echo "==> Starting PostgreSQL 16 container..."
docker run -d --name apicm-pg \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=apicameroun \
  -p 5432:5432 \
  postgres:16-alpine

echo "==> Waiting for PostgreSQL to accept connections..."
until docker exec apicm-pg pg_isready -U postgres > /dev/null 2>&1; do
  sleep 1
done
echo "    Postgres is up."

echo "==> Installing app dependencies..."
cd app
npm ci --no-audit --no-fund

echo "==> Generating Prisma client..."
npx prisma generate

echo "==> Pushing schema to database..."
npx prisma db push --skip-generate

echo "==> Seeding demo data..."
npx prisma db seed || echo "    (seed failed — non-fatal; continue)"

echo "==> Done. Run 'cd app && npm run dev' to start the server."
