#!/usr/bin/env bash
# gen-secrets.sh — сгенерировать безопасные секреты для production .env
set -euo pipefail

command -v openssl &>/dev/null || { echo "openssl не найден"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

OUTPUT_FILE="${1:-${ROOT}/.env.prod}"

if [ -f "$OUTPUT_FILE" ]; then
    echo "⚠  Файл ${OUTPUT_FILE} уже существует."
    read -p "   Перезаписать? (yes/no): " CONFIRM
    [ "$CONFIRM" = "yes" ] || { echo "Отменено."; exit 0; }
fi

POSTGRES_PASSWORD=$(openssl rand -hex 32)
REDIS_PASSWORD=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)

cat > "$OUTPUT_FILE" << EOF
# Zdesagochi Backend — Production Environment
# Сгенерировано: $(date)
# ВНИМАНИЕ: Никогда не коммить этот файл в git!

POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD}
JWT_SECRET=${JWT_SECRET}

# Настрой под своё окружение:
CORS_ORIGINS=https://your-domain.com
LOG_LEVEL=info
ENVIRONMENT=production

JWT_EXPIRY_SECONDS=3600
REFRESH_TOKEN_EXPIRY_SECONDS=2592000
RATE_LIMIT_REQUESTS_PER_MINUTE=60

# Опционально — трейсинг в Jaeger:
# OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4317
EOF

chmod 600 "$OUTPUT_FILE"

echo "✓ Секреты сгенерированы: ${OUTPUT_FILE}"
echo ""
echo "  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:0:8}...  (${#POSTGRES_PASSWORD} символов)"
echo "  REDIS_PASSWORD:    ${REDIS_PASSWORD:0:8}...  (${#REDIS_PASSWORD} символов)"
echo "  JWT_SECRET:        ${JWT_SECRET:0:8}...  (${#JWT_SECRET} символов)"
echo ""
echo "  Отредактируй CORS_ORIGINS перед деплоем!"
