#!/usr/bin/env bash
# FinFlow — Master Setup Script
# Run this after cloning to get the full stack running locally.

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}╔══════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║   FinFlow — Full Stack Setup                 ║${NC}"
echo -e "${YELLOW}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Step 1: Create .env from example ──────────────────
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env created. Edit it to add your Lemon Squeezy credentials.${NC}"
else
    echo -e "${GREEN}✓ .env already exists${NC}"
fi
echo ""

# ── Step 2: Start infrastructure ─────────────────────
echo -e "${YELLOW}Starting PostgreSQL and Redis...${NC}"
docker compose up -d postgres redis
echo ""

# ── Step 3: Wait for PostgreSQL to be healthy ────────
echo -n "Waiting for PostgreSQL..."
for i in $(seq 1 30); do
    if docker compose exec -T postgres pg_isready -U postgres -d finflow > /dev/null 2>&1; then
        echo -e " ${GREEN}ready${NC}"
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

# ── Step 4: Run migrations ──────────────────────────
echo -e "${YELLOW}Running database migrations...${NC}"
for migration in infra/db/migrations/*.sql; do
    filename=$(basename "$migration")
    echo -n "  $filename ... "
    docker compose exec -T postgres psql -U postgres -d finflow -f - < "$migration" > /dev/null 2>&1
    echo -e "${GREEN}✓${NC}"
done
echo ""

# ── Step 5: Build and start all services ─────────────
echo -e "${YELLOW}Building and starting all services...${NC}"
docker compose up -d --build
echo ""

# ── Step 6: Wait for services to be healthy ──────────
echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
sleep 5

echo -n "  API: "
for i in $(seq 1 30); do
    if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ healthy${NC}"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo -e "${RED}✗ timeout${NC}"
    fi
    sleep 2
done

echo -n "  ML Service: "
for i in $(seq 1 30); do
    if curl -sf http://localhost:8001/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ healthy${NC}"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo -e "${RED}✗ timeout (model training may take a moment)${NC}"
    fi
    sleep 2
done

echo -n "  Frontend: "
for i in $(seq 1 30); do
    if curl -sf http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ healthy${NC}"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo -e "${RED}✗ timeout${NC}"
    fi
    sleep 2
done

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   FinFlow is running!                        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Frontend:   ${GREEN}http://localhost:3000${NC}"
echo -e "  API:        ${GREEN}http://localhost:8080${NC}"
echo -e "  ML Service: ${GREEN}http://localhost:8001${NC}"
echo -e "  PostgreSQL: ${GREEN}localhost:5432${NC}"
echo -e "  Redis:      ${GREEN}localhost:6379${NC}"
echo ""
echo -e "${YELLOW}── Quick Test Commands ─────────────────────────${NC}"
echo ""
echo '# Health check:'
echo 'curl http://localhost:8080/health'
echo ''
echo '# Register:'
echo 'curl -X POST http://localhost:8080/api/v1/auth/register \'
echo '  -H "Content-Type: application/json" \'
echo '  -c cookies.txt \'
echo '  -d '"'"'{"email":"test@test.com","password":"password123","full_name":"Test User"}'"'"''
echo ''
echo '# Upload CSV:'
echo 'curl -X POST http://localhost:8080/api/v1/transactions/upload \'
echo '  -b cookies.txt \'
echo '  -F "file=@docs/sample_transactions.csv"'
echo ''
echo '# List transactions:'
echo 'curl -b cookies.txt http://localhost:8080/api/v1/transactions'
echo ""
