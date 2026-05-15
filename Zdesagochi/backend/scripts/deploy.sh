#!/usr/bin/env bash
# deploy.sh — собрать образ и задеплоить на удалённый сервер по SSH
#
# Использование:
#   ./scripts/deploy.sh user@server.com
#   ./scripts/deploy.sh user@server.com /opt/zdesagochi
#   ./scripts/deploy.sh user@server.com /opt/zdesagochi my-registry/image:tag
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
cd "$ROOT"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()    { echo -e "${GREEN}✓${NC} $*"; }
info()  { echo -e "${BLUE}→${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠${NC} $*"; }
die()   { echo -e "${RED}✗${NC} $*" >&2; exit 1; }
step()  { echo ""; echo -e "${BLUE}══ $* ══${NC}"; }

# ── Аргументы ─────────────────────────────────────────────────────────────────
SSH_TARGET="${1:-}"
REMOTE_DIR="${2:-/opt/zdesagochi}"
IMAGE_TAG="${3:-zdesagochi-backend:latest}"

[ -z "$SSH_TARGET" ] && die "Использование: $0 user@server.com [/opt/zdesagochi] [image:tag]"

GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "dev")
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Zdesagochi Backend — Deploy              ║${NC}"
echo -e "${BLUE}║  Target: ${SSH_TARGET}${NC}"
echo -e "${BLUE}║  Dir:    ${REMOTE_DIR}${NC}"
echo -e "${BLUE}║  Commit: ${GIT_SHA}${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

# ── Проверки ──────────────────────────────────────────────────────────────────
command -v docker &>/dev/null || die "Docker не установлен"
command -v ssh &>/dev/null || die "SSH не установлен"
command -v scp &>/dev/null || die "SCP не установлен"

# Проверяем SSH соединение
step "Проверка SSH соединения"
ssh -o ConnectTimeout=10 -o BatchMode=yes "$SSH_TARGET" "echo ok" &>/dev/null || \
    die "Не удаётся подключиться к ${SSH_TARGET}. Проверь SSH ключ и доступность сервера."
ok "SSH соединение установлено"

# ── Шаг 1: Собрать образ ─────────────────────────────────────────────────────
step "Сборка Docker образа"
info "Сборка ${IMAGE_TAG}..."
docker build \
    --tag "$IMAGE_TAG" \
    --tag "zdesagochi-backend:${GIT_SHA}" \
    . 2>&1 | tail -5
ok "Образ собран"

# ── Шаг 2: Экспорт образа ────────────────────────────────────────────────────
step "Передача образа на сервер"
TMPFILE=$(mktemp /tmp/zdesagochi-image-XXXXXX.tar.gz)
trap "rm -f $TMPFILE" EXIT

info "Экспорт образа в архив..."
docker save "$IMAGE_TAG" | gzip > "$TMPFILE"
SIZE=$(du -sh "$TMPFILE" | cut -f1)
ok "Образ экспортирован (${SIZE})"

info "Загрузка на ${SSH_TARGET}..."
scp -q "$TMPFILE" "${SSH_TARGET}:/tmp/zdesagochi-image.tar.gz"
ok "Образ загружен на сервер"

# ── Шаг 3: Подготовить директорию на сервере ─────────────────────────────────
step "Подготовка сервера"
ssh "$SSH_TARGET" "mkdir -p ${REMOTE_DIR}/nginx/certs ${REMOTE_DIR}/grafana"
ok "Директория ${REMOTE_DIR} готова"

# ── Шаг 4: Скопировать конфиги ───────────────────────────────────────────────
step "Копирование конфигов"
scp -q docker-compose.prod.yml "${SSH_TARGET}:${REMOTE_DIR}/docker-compose.prod.yml"

# Nginx конфиг (если есть)
if [ -f "nginx/nginx.conf" ]; then
    scp -q nginx/nginx.conf "${SSH_TARGET}:${REMOTE_DIR}/nginx/nginx.conf"
    ok "nginx.conf скопирован"
fi

# Grafana дашборд
if [ -f "grafana/dashboard.json" ]; then
    scp -q grafana/dashboard.json "${SSH_TARGET}:${REMOTE_DIR}/grafana/dashboard.json"
fi

ok "Конфиги скопированы"

# ── Шаг 5: Проверить .env.prod ────────────────────────────────────────────────
step "Проверка конфигурации"
ENV_EXISTS=$(ssh "$SSH_TARGET" "[ -f ${REMOTE_DIR}/.env.prod ] && echo yes || echo no")

if [ "$ENV_EXISTS" = "no" ]; then
    warn ".env.prod не найден на сервере!"
    echo ""
    echo "  Создай файл на сервере:"
    echo "    ssh ${SSH_TARGET}"
    echo "    cat > ${REMOTE_DIR}/.env.prod << 'EOF'"
    echo "    POSTGRES_PASSWORD=\$(openssl rand -hex 32)"
    echo "    REDIS_PASSWORD=\$(openssl rand -hex 32)"
    echo "    JWT_SECRET=\$(openssl rand -hex 32)"
    echo "    CORS_ORIGINS=https://your-domain.com"
    echo "    EOF"
    echo ""
    read -p "  Нажми Enter после создания .env.prod или Ctrl+C для отмены..." || exit 1
fi

ok ".env.prod существует"

# ── Шаг 6: Загрузить образ и перезапустить ────────────────────────────────────
step "Деплой на сервер"
ssh "$SSH_TARGET" bash << REMOTE
set -euo pipefail

echo "Загружаем Docker образ..."
docker load < /tmp/zdesagochi-image.tar.gz
rm -f /tmp/zdesagochi-image.tar.gz

cd ${REMOTE_DIR}

# Backup текущего state (опционально)
docker compose -f docker-compose.prod.yml --env-file .env.prod ps --format json > /tmp/deploy-backup-${TIMESTAMP}.json 2>/dev/null || true

echo "Применяем новый образ..."
# Обновить тег в compose если используется конкретный тег
docker compose -f docker-compose.prod.yml --env-file .env.prod pull --ignore-pull-failures 2>/dev/null || true

echo "Перезапускаем сервисы..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --remove-orphans

echo "Ждём готовности backend..."
for i in \$(seq 1 30); do
    if docker compose -f docker-compose.prod.yml exec -T backend \
        wget -qO- http://localhost:8080/health 2>/dev/null | grep -q '"status":"ok"'; then
        echo "Backend готов!"
        break
    fi
    sleep 2
    echo -n "."
done
echo ""

# Показать статус
docker compose -f docker-compose.prod.yml ps

# Удалить старые образы
docker image prune -f --filter "label=app=zdesagochi" 2>/dev/null || true

echo "Деплой завершён!"
REMOTE

# ── Шаг 7: Финальная проверка ─────────────────────────────────────────────────
step "Финальная проверка"
sleep 3

HEALTH=$(ssh "$SSH_TARGET" "curl -sf http://localhost:8080/health || echo 'error'" 2>/dev/null || echo "error")

if echo "$HEALTH" | grep -q '"status":"ok"'; then
    ok "Health check пройден: $HEALTH"
else
    warn "Health check не ответил (возможно ещё поднимается): $HEALTH"
    echo "  Проверь логи: ssh ${SSH_TARGET} 'cd ${REMOTE_DIR} && docker compose -f docker-compose.prod.yml logs -f backend'"
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Деплой завершён!                         ║${NC}"
echo -e "${GREEN}║  Commit: ${GIT_SHA} @ ${TIMESTAMP}   ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo "  Логи:   ssh ${SSH_TARGET} 'cd ${REMOTE_DIR} && docker compose -f docker-compose.prod.yml logs -f'"
echo "  Статус: ssh ${SSH_TARGET} 'cd ${REMOTE_DIR} && docker compose -f docker-compose.prod.yml ps'"
echo ""
