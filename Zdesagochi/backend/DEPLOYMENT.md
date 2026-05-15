# Zdesagochi Backend — Deployment Guide

## Содержание

- [Требования](#требования)
- [Локальная разработка (без Docker)](#локальная-разработка-без-docker)
- [Локальная разработка (через Docker Compose)](#локальная-разработка-через-docker-compose)
- [Деплой на удалённый сервер](#деплой-на-удалённый-сервер)
- [Переменные окружения](#переменные-окружения)
- [Nginx конфигурация](#nginx-конфигурация)
- [Мониторинг](#мониторинг)
- [Скрипты автоматизации](#скрипты-автоматизации)
- [FAQ / Troubleshooting](#faq--troubleshooting)

---

## Требования

### Локальная разработка
| Инструмент | Версия | Установка |
|---|---|---|
| Rust | ≥ 1.82 | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| PostgreSQL | ≥ 16 | `brew install postgresql@16` / apt |
| Redis | ≥ 7 | `brew install redis` / apt |
| sqlx-cli | любая | `cargo install sqlx-cli --no-default-features --features postgres` |

### Docker деплой
| Инструмент | Версия |
|---|---|
| Docker | ≥ 26 |
| Docker Compose | ≥ 2.27 |
| SSH доступ к серверу | — |

---

## Локальная разработка (без Docker)

### 1. Клонировать и перейти в директорию

```bash
cd Zdesagochi/backend
```

### 2. Запустить PostgreSQL и Redis

```bash
# macOS (Homebrew)
brew services start postgresql@16
brew services start redis

# Linux (systemd)
sudo systemctl start postgresql redis
```

### 3. Создать базу данных

```bash
createdb zdesagochi
createuser zdesagochi
psql -c "ALTER USER zdesagochi PASSWORD 'secret';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE zdesagochi TO zdesagochi;"
```

### 4. Настроить переменные окружения

```bash
cp .env.example .env
# Отредактируй .env — обязательно смени JWT_SECRET
```

Минимальный `.env` для локальной разработки:
```env
DATABASE_URL=postgres://zdesagochi:secret@localhost:5432/zdesagochi
REDIS_URL=redis://localhost:6379
JWT_SECRET=local-dev-secret-at-least-32-chars!!
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:5173
```

### 5. Применить миграции

```bash
sqlx migrate run
```

### 6. Запустить сервер

```bash
cargo run
# или с логами debug-уровня:
LOG_LEVEL=debug cargo run
```

Сервер будет доступен на `http://localhost:8080`.

### Быстрый старт одной командой

```bash
./scripts/dev.sh
```

---

## Локальная разработка (через Docker Compose)

Полный стек включая PostgreSQL, Redis и Jaeger (трейсинг):

```bash
# Запустить всё
docker compose up -d

# Только инфраструктура (postgres + redis), сервер нативно
docker compose up -d postgres redis

# Посмотреть логи
docker compose logs -f backend

# Остановить
docker compose down

# Остановить и удалить данные
docker compose down -v
```

После старта:
- API: `http://localhost:8080`
- Swagger UI: `http://localhost:8080/docs`
- Health check: `http://localhost:8080/health`
- Jaeger UI: `http://localhost:16686`

---

## Деплой на удалённый сервер

### Вариант A: Автоматический деплой через скрипт

```bash
# Деплой на сервер:
./scripts/deploy.sh user@your-server.com

# С кастомным путём на сервере:
./scripts/deploy.sh user@your-server.com /opt/zdesagochi
```

Скрипт сделает всё сам:
1. Соберёт Docker-образ локально
2. Экспортирует и загрузит на сервер по SSH
3. Скопирует конфиги
4. Перезапустит контейнеры с zero-downtime

### Вариант B: Через Docker Registry (GitHub Container Registry / Docker Hub)

```bash
# 1. Сборка и пуш образа
./scripts/build-and-push.sh ghcr.io/your-org/zdesagochi-backend:latest

# 2. На сервере:
ssh user@your-server.com
cd /opt/zdesagochi
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### Вариант C: Ручной деплой шаг за шагом

#### Шаг 1: Подготовить сервер

```bash
ssh user@your-server.com

# Установить Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Создать директорию проекта
mkdir -p /opt/zdesagochi
```

#### Шаг 2: Загрузить файлы на сервер

```bash
# Локально — копируем нужные файлы
scp docker-compose.prod.yml user@your-server.com:/opt/zdesagochi/
scp -r nginx/ user@your-server.com:/opt/zdesagochi/
scp Dockerfile user@your-server.com:/opt/zdesagochi/
scp -r migrations/ user@your-server.com:/opt/zdesagochi/
```

#### Шаг 3: Создать `.env.prod` на сервере

```bash
ssh user@your-server.com
cat > /opt/zdesagochi/.env.prod << 'EOF'
POSTGRES_PASSWORD=<сгенерируй: openssl rand -hex 32>
REDIS_PASSWORD=<сгенерируй: openssl rand -hex 32>
JWT_SECRET=<сгенерируй: openssl rand -hex 32>
CORS_ORIGINS=https://your-domain.com
EOF
chmod 600 /opt/zdesagochi/.env.prod
```

#### Шаг 4: Собрать и запустить

```bash
ssh user@your-server.com
cd /opt/zdesagochi

# Собрать образ прямо на сервере (если есть исходники)
# или загрузить собранный образ (см. скрипт deploy.sh)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# Проверить статус
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs backend
```

#### Шаг 5: Проверить

```bash
curl http://your-server.com/health
# Ожидаемый ответ: {"status":"ok","database":"ok","redis":"ok"}
```

---

## Переменные окружения

| Переменная | Обязательная | По умолчанию | Описание |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL DSN |
| `REDIS_URL` | — | `redis://localhost:6379` | Redis DSN |
| `JWT_SECRET` | ✅ | — | Секрет для JWT, **минимум 32 символа** |
| `JWT_EXPIRY_SECONDS` | — | `3600` | Время жизни access token (сек) |
| `REFRESH_TOKEN_EXPIRY_SECONDS` | — | `2592000` | Время жизни refresh token (30 дней) |
| `HOST` | — | `0.0.0.0` | Bind адрес |
| `PORT` | — | `8080` | Порт |
| `ENVIRONMENT` | — | `development` | `development` или `production` |
| `CORS_ORIGINS` | — | `http://localhost:5173` | Разрешённые origins через запятую |
| `LOG_LEVEL` | — | `info` | `trace`, `debug`, `info`, `warn`, `error` |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | — | `60` | Лимит запросов на IP |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | — | Jaeger/OTEL endpoint (если нужны трейсы) |

### Генерация безопасных секретов

```bash
# JWT_SECRET (32+ символов)
openssl rand -hex 32

# POSTGRES_PASSWORD
openssl rand -hex 20

# REDIS_PASSWORD
openssl rand -hex 20
```

---

## Nginx конфигурация

Файл `nginx/nginx.conf` уже есть в репозитории. Для HTTPS нужны сертификаты:

### Получить SSL сертификат (Let's Encrypt)

```bash
# На сервере — установить certbot
sudo apt install certbot

# Получить сертификат (до запуска nginx)
sudo certbot certonly --standalone -d your-domain.com

# Скопировать сертификаты
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/zdesagochi/nginx/certs/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/zdesagochi/nginx/certs/
```

### Обновление сертификата (cron)

```bash
# Добавить в crontab на сервере
0 0 1 * * certbot renew --quiet && docker compose -f /opt/zdesagochi/docker-compose.prod.yml restart nginx
```

---

## Мониторинг

### Prometheus метрики

Доступны на `GET /metrics` (без авторизации).

Ключевые метрики:
- `pet_actions_total{action}` — количество действий с питомцем
- `http_requests_total{method,path,status}` — HTTP запросы
- `engine_apply_duration_ms` — время применения команды в engine

### Grafana

Дашборд готов: `grafana/dashboard.json`. Импортируй через Grafana UI → Dashboards → Import → Upload JSON.

### Jaeger (трейсинг)

Включается установкой переменной `OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4317` в `docker-compose.yml`.

### Health check

```bash
curl http://localhost:8080/health
# {"status":"ok","database":"ok","redis":"ok","version":"0.1.0"}
```

---

## Скрипты автоматизации

| Скрипт | Назначение |
|---|---|
| `./scripts/dev.sh` | Запустить локально (проверяет зависимости, мигрирует, запускает) |
| `./scripts/dev-docker.sh` | Запустить через Docker Compose (dev) |
| `./scripts/build.sh` | Собрать production Docker образ |
| `./scripts/deploy.sh user@host` | Собрать и задеплоить на удалённый сервер |
| `./scripts/db-reset.sh` | Сбросить локальную БД и пересоздать |
| `./scripts/gen-secrets.sh` | Сгенерировать безопасные секреты для `.env.prod` |

---

## FAQ / Troubleshooting

### `DATABASE_URL must be set` при старте

Убедись что `.env` файл существует и `DATABASE_URL` прописан.

### `JWT_SECRET must be at least 32 characters`

Секрет слишком короткий. Сгенерируй: `openssl rand -hex 32`.

### `FATAL: password authentication failed for user "zdesagochi"`

Пересоздай пользователя БД:
```bash
sudo -u postgres psql -c "DROP USER IF EXISTS zdesagochi;"
sudo -u postgres psql -c "CREATE USER zdesagochi WITH PASSWORD 'secret';"
sudo -u postgres psql -c "CREATE DATABASE zdesagochi OWNER zdesagochi;"
```

### Миграции не применились

```bash
sqlx migrate run
# или через docker:
docker compose exec backend sqlx migrate run
```

### Backend не стартует в Docker — `depends_on` но база не готова

В `docker-compose.yml` уже есть `condition: service_healthy`. Если всё равно падает — увеличь `retries` в healthcheck.

### Порт 8080 занят

```bash
lsof -i :8080
# изменить PORT в .env
```

### Обновление без даунтайма на сервере

```bash
./scripts/deploy.sh user@your-server.com
# Скрипт сначала поднимет новый контейнер, потом убьёт старый
```
