#!/usr/bin/env bash
# dev-docker.sh — запустить весь стек через Docker Compose (dev режим)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
cd "$ROOT"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
info() { echo -e "${BLUE}→${NC} $*"; }
die()  { echo -e "${RED}✗${NC} $*" >&2; exit 1; }

command -v docker &>/dev/null || die "Docker не установлен"
docker info &>/dev/null || die "Docker не запущен"

MODE="${1:-full}"  # full | infra

echo ""
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}   Zdesagochi — Docker Compose Dev Stack   ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""

case "$MODE" in
  infra)
    info "Запускаем только инфраструктуру (postgres + redis)..."
    docker compose up -d postgres redis
    ok "Инфраструктура запущена"
    echo ""
    echo "  PostgreSQL: localhost:5432"
    echo "  Redis:      localhost:6379"
    echo ""
    echo "  Запусти backend нативно: ./scripts/dev.sh"
    ;;
  full)
    info "Запускаем полный стек..."
    docker compose up -d --build

    # Ждём пока backend ответит
    info "Ждём когда backend поднимется..."
    for i in $(seq 1 30); do
        if curl -sf http://localhost:8080/health &>/dev/null; then
            break
        fi
        sleep 2
        echo -n "."
    done
    echo ""

    if curl -sf http://localhost:8080/health &>/dev/null; then
        ok "Стек запущен!"
    else
        echo "Backend ещё поднимается. Проверь: docker compose logs -f backend"
    fi

    echo ""
    echo -e "${GREEN}  API:        http://localhost:8080${NC}"
    echo -e "${GREEN}  Swagger UI: http://localhost:8080/docs${NC}"
    echo -e "${GREEN}  Health:     http://localhost:8080/health${NC}"
    echo -e "${GREEN}  Jaeger:     http://localhost:16686${NC}"
    echo ""
    echo "  Логи:   docker compose logs -f backend"
    echo "  Стоп:   docker compose down"
    echo "  Сброс:  docker compose down -v"
    ;;
  logs)
    docker compose logs -f backend
    ;;
  stop)
    info "Останавливаем стек..."
    docker compose down
    ok "Стек остановлен"
    ;;
  reset)
    info "Сбрасываем стек (включая данные)..."
    docker compose down -v
    ok "Стек и данные удалены"
    ;;
  *)
    echo "Использование: $0 [full|infra|logs|stop|reset]"
    exit 1
    ;;
esac
