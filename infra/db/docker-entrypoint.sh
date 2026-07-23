#!/bin/sh
# docker-entrypoint.sh — Run database migrations, then start the API.
# Designed for the api Docker image (alpine-based).

set -e

# Only run migrations if DATABASE_URL is set and psql is available.
if [ -n "${DATABASE_URL:-}" ] && command -v psql > /dev/null 2>&1; then
    echo "→ Running database migrations..."
    MIGRATIONS_DIR="/app/migrations"
    if [ -d "$MIGRATIONS_DIR" ]; then
        for migration in "$MIGRATIONS_DIR"/*.sql; do
            [ -f "$migration" ] || continue
            filename="$(basename "$migration")"
            echo "  Applying $filename ..."
            psql "$DATABASE_URL" -f "$migration" > /dev/null 2>&1 || echo "  Warning: $filename may have already been applied (continuing)"
        done
        echo "→ Migrations complete."
    else
        echo "→ No migrations directory found at $MIGRATIONS_DIR — skipping."
    fi
else
    echo "→ Skipping migrations (DATABASE_URL unset or psql unavailable)."
fi

# Start the API.
echo "→ Starting FinFlow API..."
exec ./finflow-api
