#!/usr/bin/env bash
# db-reset.sh — сбросить локальную БД и применить миграции заново
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
cd "$ROOT"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
info() { echo -e "${BLUE}→${NC} $*"; }
die()  { echo -e "${RED}✗${NC} $*" >&2; exit 1; }

source .env 2>/dev/null || true
DB_NAME="${DATABASE_URL##*/}"
DB_NAME="${DB_NAME%%\?*}"
DB_USER="${DATABASE_URL##*://}"
DB_USER="${DB_USER%%:*}"

echo -e "${YELLOW}⚠  ВНИМАНИЕ: Это удалит все данные в базе '${DB_NAME}'!${NC}"
read -p "   Продолжить? (yes/no): " CONFIRM
[ "$CONFIRM" = "yes" ] || { echo "Отменено."; exit 0; }

info "Удаляем базу '${DB_NAME}'..."
psql -U postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>/dev/null || \
    psql -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>/dev/null || \
    die "Не удалось удалить базу (проверь права)"

info "Создаём базу '${DB_NAME}'..."
psql -U postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || \
    psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null

ok "База пересоздана"

info "Применяем миграции..."
sqlx migrate run
ok "Миграции применены"

echo ""
ok "База данных сброшена и готова к использованию"
