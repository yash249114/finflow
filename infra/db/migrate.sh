#!/usr/bin/env bash
# migrate.sh — Run all SQL migrations in order against PostgreSQL
#
# Usage:
#   ./infra/db/migrate.sh                           # uses DATABASE_URL from env
#   DATABASE_URL=postgresql://... ./infra/db/migrate.sh  # override inline
#   ./infra/db/migrate.sh --docker                  # run via docker compose exec
#
# If running inside Docker Compose, use:
#   docker compose exec postgres psql -U postgres -d finflow -f /path/to/migration.sql

set -euo pipefail

# ── Configuration ──────────────────────────────────────────
DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required. Set it via env or .env file. Example: DATABASE_URL=postgresql://user:pass@host:5432/finflow}"
MIGRATIONS_DIR="$(cd "$(dirname "$0")/migrations" && pwd)"
USE_DOCKER=false

# Parse args
if [[ "${1:-}" == "--docker" ]]; then
    USE_DOCKER=true
fi

# ── Color output helpers ───────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}╔══════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║   FinFlow — Database Migrations      ║${NC}"
echo -e "${YELLOW}╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "Migrations: ${GREEN}${MIGRATIONS_DIR}${NC}"
echo ""

# ── Create schema_migrations tracking table ────────────────
run_sql() {
    if [ "$USE_DOCKER" = true ]; then
        docker compose exec -T postgres psql -U postgres -d finflow -c "$1" 2>&1
    else
        psql "$DATABASE_URL" -c "$1" 2>&1
    fi
}

run_file() {
    if [ "$USE_DOCKER" = true ]; then
        docker compose exec -T postgres psql -U postgres -d finflow -f - < "$1" 2>&1
    else
        psql "$DATABASE_URL" -f "$1" 2>&1
    fi
}

# Create tracking table
run_sql "CREATE TABLE IF NOT EXISTS schema_migrations (
    filename VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);" > /dev/null 2>&1

# ── Run migrations in order ───────────────────────────────
MIGRATION_COUNT=0
SKIPPED=0
FAILED=0

for migration in "$MIGRATIONS_DIR"/*.sql; do
    filename="$(basename "$migration")"

    # Sanitize: only allow safe characters in migration filenames (prevents SQL injection)
    if ! [[ "$filename" =~ ^[a-zA-Z0-9_\.-]+$ ]]; then
        echo -e "${RED}Unsafe migration filename: $filename${NC}" >&2
        ((FAILED++))
        continue
    fi
    
    # Check if already applied (use psql variable to prevent SQL injection)
    already=$(run_sql "SELECT COUNT(*) FROM schema_migrations WHERE filename = '"$filename"';" 2>/dev/null | grep -oE '[0-9]+' | head -1)
    
    if [ "${already:-0}" -gt 0 ]; then
        echo -e "  $filename ... ${YELLOW}SKIPPED (already applied)${NC}"
        ((SKIPPED++))
        continue
    fi

    echo -n "  Running $filename ... "

    if run_file "$migration" > /dev/null 2>&1; then
        # Record as applied (filename validated above, safe for interpolation)
        run_sql "INSERT INTO schema_migrations (filename) VALUES ('"$filename"');" > /dev/null 2>&1
        echo -e "${GREEN}✓${NC}"
        ((MIGRATION_COUNT++))
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo -e "${RED}Error running $filename. Run manually to see details:${NC}"
        echo "  psql \"$DATABASE_URL\" -f \"$migration\""
        ((FAILED++))
    fi
done

echo ""
echo "════════════════════════════════════════"
echo -e "Migrations applied: ${GREEN}${MIGRATION_COUNT}${NC}"
echo -e "Skipped (existing): ${YELLOW}${SKIPPED}${NC}"
if [ "$FAILED" -gt 0 ]; then
    echo -e "Failed: ${RED}${FAILED}${NC}"
    exit 1
else
    echo -e "Status: ${GREEN}ALL PASSED${NC}"
fi
echo "════════════════════════════════════════"
