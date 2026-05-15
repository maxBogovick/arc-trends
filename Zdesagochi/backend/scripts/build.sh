#!/usr/bin/env bash
# build.sh — собрать production Docker образ
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
cd "$ROOT"

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
info() { echo -e "${BLUE}→${NC} $*"; }
die()  { echo -e "${RED}✗${NC} $*" >&2; exit 1; }

IMAGE_NAME="${1:-zdesagochi-backend}"
TAG="${2:-latest}"
FULL_TAG="${IMAGE_NAME}:${TAG}"

command -v docker &>/dev/null || die "Docker не установлен"

echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}   Building: ${FULL_TAG}${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""

info "Сборка Docker образа..."
docker build \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    --tag "$FULL_TAG" \
    --tag "${IMAGE_NAME}:$(git rev-parse --short HEAD 2>/dev/null || echo 'dev')" \
    .

SIZE=$(docker image inspect "$FULL_TAG" --format='{{.Size}}' | awk '{printf "%.1f MB", $1/1024/1024}')
ok "Образ собран: ${FULL_TAG} (${SIZE})"

echo ""
echo "  Запустить локально:"
echo "    docker run --rm -p 8080:8080 --env-file .env ${FULL_TAG}"
echo ""
echo "  Запушить в registry:"
echo "    docker push ${FULL_TAG}"
echo ""
