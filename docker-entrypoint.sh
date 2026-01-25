#!/bin/sh
set -e

echo "Initializing database..."

# Wait for database to be ready
MAX_RETRIES=30
RETRY_COUNT=0
until PGPASSWORD="${DATABASE_PASSWORD:-postgres}" psql -h "${DATABASE_HOST:-db}" -U "${DATABASE_USER:-postgres}" -d "${DATABASE_NAME:-uptime_kuma}" -c '\q' 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "Database connection failed after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "Waiting for database to be ready... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

echo "Database is ready!"

# Run database initialization script
echo "Running database schema initialization..."
PGPASSWORD="${DATABASE_PASSWORD:-postgres}" psql -h "${DATABASE_HOST:-db}" -U "${DATABASE_USER:-postgres}" -d "${DATABASE_NAME:-uptime_kuma}" -f /workspace/prisma/init.sql 2>&1 || {
  echo "Init SQL completed (some tables may already exist)"
}

echo "Starting application..."
exec node .output/server/index.mjs
