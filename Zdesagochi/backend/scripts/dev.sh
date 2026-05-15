#!/usr/bin/env bash
# dev.sh — локальный запуск без Docker (нативный Rust)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

cd "$ROOT"

# ── Цвета ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
info() { echo -e "${BLUE}→${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
die()  { echo -e "${RED}✗${NC} $*" >&2; exit 1; }

echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}   Zdesagochi Backend — Dev Server     ${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""

# ── 1. Проверка зависимостей ───────────────────────────────────────────────────
info "Проверяем зависимости..."

command -v cargo &>/dev/null || die "Rust/cargo не найден. Установи: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
ok "Rust $(rustc --version | awk '{print $2}')"

command -v psql &>/dev/null || die "PostgreSQL не найден. Установи: brew install postgresql@16"
ok "PostgreSQL $(psql --version | awk '{print $3}')"

command -v redis-cli &>/dev/null || die "Redis не найден. Установи: brew install redis"
ok "Redis $(redis-cli --version | awk '{print $2}')"

# sqlx-cli опциональный
if ! command -v sqlx &>/dev/null; then
    warn "sqlx-cli не найден — устанавливаем..."
    cargo install sqlx-cli --no-default-features --features postgres --quiet
fi
ok "sqlx-cli $(sqlx --version 2>/dev/null | awk '{print $2}' || echo 'ok')"

# ── 2. Настройка .env ──────────────────────────────────────────────────────────
if [ ! -f .env ]; then
    info "Создаём .env из шаблона..."
    cp .env.example .env

    # Генерируем безопасный JWT_SECRET
    if command -v openssl &>/dev/null; then
        SECRET=$(openssl rand -hex 32)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/change-me-to-a-256-bit-secret-in-production/$SECRET/" .env
        else
            sed -i "s/change-me-to-a-256-bit-secret-in-production/$SECRET/" .env
        fi
        ok "Сгенерирован JWT_SECRET"
    fi
    warn ".env создан — проверь DATABASE_URL если используешь не дефолтные настройки"
fi

source .env 2>/dev/null || true

# ── 3. Проверка PostgreSQL ─────────────────────────────────────────────────────
info "Проверяем PostgreSQL..."
if ! pg_isready -q 2>/dev/null; then
    info "PostgreSQL не запущен — пробуем запустить..."
    if command -v brew &>/dev/null; then
        brew services start postgresql@16 2>/dev/null || brew services start postgresql 2>/dev/null || true
        sleep 2
    elif command -v systemctl &>/dev/null; then
        sudo systemctl start postgresql
        sleep 2
    fi
fi

pg_isready -q || die "PostgreSQL не доступен. Запусти вручную."
ok "PostgreSQL запущен"

# Создать БД и пользователя если не существуют
DB_USER="${DATABASE_URL##*://}"
DB_USER="${DB_USER%%:*}"
DB_NAME="${DATABASE_URL##*/}"
DB_NAME="${DB_NAME%%\?*}"

psql -U postgres -tc "SELECT 1 FROM pg_user WHERE usename='${DB_USER}'" 2>/dev/null | grep -q 1 || \
    psql -U postgres -c "CREATE USER ${DB_USER} WITH PASSWORD 'secret';" 2>/dev/null || true

psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null | grep -q 1 || \
    psql -U postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || true

ok "База данных '${DB_NAME}' готова"

# ── 4. Проверка Redis ──────────────────────────────────────────────────────────
info "Проверяем Redis..."
if ! redis-cli ping &>/dev/null; then
    info "Redis не запущен — пробуем запустить..."
    if command -v brew &>/dev/null; then
        brew services start redis 2>/dev/null || true
        sleep 1
    elif command -v systemctl &>/dev/null; then
        sudo systemctl start redis
        sleep 1
    fi
fi

redis-cli ping | grep -q PONG || die "Redis не доступен. Запусти вручную."
ok "Redis запущен"

# ── 5. Миграции ────────────────────────────────────────────────────────────────
info "Применяем миграции..."
sqlx migrate run 2>/dev/null && ok "Миграции применены" || warn "Миграции уже применены или ошибка (проверь логи)"

# ── 6. Сборка ─────────────────────────────────────────────────────────────────
info "Собираем проект..."
cargo build 2>&1 | tail -3
ok "Сборка успешна"

# ── 7. Запуск ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}  Сервер запускается на http://localhost:${PORT:-8080}${NC}"
echo -e "${GREEN}  Swagger UI: http://localhost:${PORT:-8080}/docs${NC}"
echo -e "${GREEN}  Health:     http://localhost:${PORT:-8080}/health${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""

export RUST_BACKTRACE=1
cargo run
