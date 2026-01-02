#!/bin/sh
set -e

echo "Initializing database..."

# Wait for database to be ready
until PGPASSWORD="${DATABASE_PASSWORD:-postgres}" psql -h "${DATABASE_HOST:-db}" -U "${DATABASE_USER:-postgres}" -d "${DATABASE_NAME:-uptime_kuma}" -c '\q' 2>/dev/null; do
  echo "Waiting for database to be ready..."
  sleep 1
done

# Run database initialization script
echo "Running database migrations..."
PGPASSWORD="${DATABASE_PASSWORD:-postgres}" psql -h "${DATABASE_HOST:-db}" -U "${DATABASE_USER:-postgres}" -d "${DATABASE_NAME:-uptime_kuma}" -f /workspace/prisma/init.sql

echo "Starting application..."
exec node .output/server/index.mjs
