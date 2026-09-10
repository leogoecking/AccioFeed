#!/bin/bash
set -e

echo "Running database migrations..."
MAX_RETRIES=15
RETRY_COUNT=0
until alembic upgrade head || [ $RETRY_COUNT -ge $MAX_RETRIES ]; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "Database not ready yet. Retrying in 2 seconds... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
  echo "Migration failed after $MAX_RETRIES attempts."
  exit 1
fi

echo "Starting application server..."
if [ -n "$PORT" ] && [ "$1" = "uvicorn" ]; then
  exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
fi

exec "$@"
