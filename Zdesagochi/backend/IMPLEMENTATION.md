# Zdesagochi Backend — Что реализовано

## Стек технологий

| Компонент | Технология | Версия |
|---|---|---|
| Web framework | Axum | 0.7 |
| Async runtime | Tokio | 1 |
| База данных | PostgreSQL | 16 |
| ORM / Query builder | SQLx | 0.8 |
| Кэш / Pub-Sub | Redis | 7 (deadpool-redis 0.14) |
| Аутентификация | JWT (jsonwebtoken 9) + Argon2 |
| Real-time | Server-Sent Events (SSE) |
| Сериализация | Serde / serde_json |
| ID генерация | ULID |
| Трейсинг | tracing + OpenTelemetry OTLP |
| Метрики | Prometheus (metrics-exporter-prometheus) |
| API документация | utoipa 4 + Swagger UI |
| Контейнеризация | Docker (multi-stage build) |

---

## Архитектура

```
┌─────────────────────────────────────────────┐
│                  Клиент (React)              │
└──────────────┬──────────────────────────────┘
               │ HTTP / SSE
┌──────────────▼──────────────────────────────┐
│               Nginx (reverse proxy)          │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│            Axum Backend (Rust)               │
│                                              │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │  Middleware  │  │  Background Jobs     │  │
│  │  - Auth      │  │  - auto_decay (5min) │  │
│  │  - Rate limit│  │  - quest_reset (UTC) │  │
│  │  - Timeout   │  └──────────────────────┘  │
│  │  - CORS      │                             │
│  │  - Compress  │  ┌──────────────────────┐  │
│  └─────────────┘  │  Personality Engine  │  │
│                   │  (Rust port of TS)   │  │
│  ┌─────────────┐  └──────────────────────┘  │
│  │  Handlers   │                             │
│  │  auth/pet/  │  ┌──────────────────────┐  │
│  │  economy/   │  │  DB Layer (sqlx)     │  │
│  │  progress/  │  │  pet_repo            │  │
│  │  rooms/sync │  │  economy_repo        │  │
│  │  sse        │  │  progress_repo       │  │
│  └─────────────┘  │  room_repo           │  │
│                   │  command_repo        │  │
└───────────────────└──────────────────────┘──┘
               │                    │
┌──────────────▼──────┐  ┌──────────▼──────────┐
│    PostgreSQL 16     │  │      Redis 7          │
│    - users           │  │  - refresh tokens    │
│    - pets (JSONB)    │  │  - rate limiting     │
│    - pet_events      │  │  - SSE pub/sub       │
│    - pet_commands    │  │  - health checks     │
│    - user_coins      │  └─────────────────────┘
│    - inventory       │
│    - achievements    │
│    - quests          │
│    - user_rooms      │
└─────────────────────┘
```

---

## API Эндпоинты (38 штук)

### Auth (`/api/auth/`)
| Метод | Путь | Описание |
|---|---|---|
| POST | `/register` | Регистрация: `{username, email, password}` → `{token, refresh_token, user}` |
| POST | `/login` | Вход: `{email, password}` → `{token, refresh_token, user}` |
| POST | `/refresh` | Обновить access token: `{refresh_token}` → `{token, refresh_token}` (ротация) |
| POST | `/logout` | Инвалидировать refresh token |

### Pet (`/api/pet/`)
| Метод | Путь | Описание |
|---|---|---|
| GET | `/` | Получить текущего питомца |
| PATCH | `/name` | Переименовать питомца |
| GET | `/events` | Последние 50 событий |
| POST | `/import` | Импорт сохранения из localStorage |
| POST | `/new-life` | Новая жизнь (сброс + сохранение легаси) |
| POST | `/feed` | Покормить: `{foodId}` |
| POST | `/play` | Поиграть |
| POST | `/sleep` | Уложить спать |
| POST | `/wake` | Разбудить |
| POST | `/bathe` | Искупать |
| POST | `/heal` | Вылечить |
| POST | `/bond` | Общение/связь |
| POST | `/sync` | Тик пассивных состояний |
| POST | `/evolution/accept` | Принять эволюцию |
| POST | `/evolution/reject` | Отклонить эволюцию |

### Offline Sync (`/api/pet/sync/`)
| Метод | Путь | Описание |
|---|---|---|
| POST | `/commands` | Батч команд с дедупликацией → `ServerCommandAck` |
| GET | `/results?since=` | Результаты команд начиная с cursor |

### Economy (`/api/`)
| Метод | Путь | Описание |
|---|---|---|
| GET | `/coins` | Баланс монет |
| GET | `/shop` | Список товаров магазина |
| POST | `/shop/buy` | Купить товар |
| GET | `/inventory` | Инвентарь |
| POST | `/inventory/use` | Использовать предмет |
| GET | `/foods` | Список еды |

### Progress (`/api/`)
| Метод | Путь | Описание |
|---|---|---|
| GET | `/achievements` | Список ачивок |
| POST | `/achievements/claim` | Получить награду за ачивку |
| GET | `/quests` | Дневные квесты |
| POST | `/quests/claim` | Получить награду за квест |

### Rooms & Leaderboard (`/api/`)
| Метод | Путь | Описание |
|---|---|---|
| GET | `/rooms` | Список комнат (с флагом unlocked) |
| POST | `/rooms/buy` | Купить комнату |
| POST | `/rooms/equip` | Надеть комнату |
| GET | `/leaderboard` | Таблица лидеров (кэш Redis) |

### Real-time
| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/sse/pet` | SSE стрим обновлений питомца |

### Утилиты
| Метод | Путь | Описание |
|---|---|---|
| GET | `/health` | Health check (DB + Redis) |
| GET | `/metrics` | Prometheus метрики |
| GET | `/docs` | Swagger UI |
| GET | `/api/openapi.json` | OpenAPI 3.0 spec |

---

## Слои приложения

### `src/domain/` — Типы данных

- **`pet.rs`** — `Pet`, `PetStats`, `PetMood`, `PetStage`, `PetEvent`
- **`economy.rs`** — `ShopItem`, `FoodItem`, `ItemEffect`, `InventoryItem`, `BuyResult`
- **`progress.rs`** — `Achievement`, `DailyQuest`, `QuestDef`, `ClaimResult`
- **`rooms.rs`** — `Room`, `RoomDef`, `LeaderboardEntry`
- **`user.rs`** — `User`, `Claims` (JWT payload)

### `src/db/` — Слой базы данных

Все функции принимают `&PgPool` (или `&mut Transaction` для атомарных операций):

- **`pet_repo`** — get_pet, create_pet, upsert_pet, get_all_pets, get_events, insert_event; `_tx` варианты для транзакций
- **`user_repo`** — create_user, find_by_email; `_tx` вариант
- **`economy_repo`** — get_coins, add_coins, spend_coins, get_inventory, add_inventory, use_inventory_item; все с `_tx` вариантами
- **`progress_repo`** — get/seed/tick/claim ачивок и квестов; batch seed через UNNEST; `_tx` варианты
- **`room_repo`** — get_rooms, buy_room, equip_room (обновляет `equipped` флаг), get_leaderboard
- **`command_repo`** — is_command_processed, insert_command, get_results_since

### `src/engine/` — Движок характеров

Полный порт TypeScript personality engine:

- **`types.rs`** — `StatKey`, `TraitKey`, `BehavioralCounters`, `TraitVector`, `CoreMemory`, `EvolutionProposal`, `EmergentStateType`, `PetCommandResult`, `BlockedAction`
- **`personalities.rs`** — 16 личностей: bold, calm, playful, anxious, stoic, chaotic, paranoid, feral, mystic, nostalgic, void, celestial, ember, wanderer, sentinel, mirage
- **`personality_engine.rs`** — `updateCounters`, `calcMoodWithBias`, `computeEmergentState`, `applyDecay`, `computeNaturalPassives`, `seeded_rng`
- **`trait_evolution.rs`** — `checkEvolution`, `acceptEvolution`, `checkShadowForm`, `addCatharsisProgress`, `detectSingularity`, `recordLegacy`, `addCoreMemory`
- **`command_handlers.rs`** — `apply_personality_command` (главная функция), `EngineState::from_pet`, `EngineState::apply_to_pet`
- **`influence_registry.rs`** — маппинг влияний трейтов
- **`memory_generator.rs`** — генерация текстов воспоминаний
- **`catalog.rs`** — статические данные игры (OnceLock-кэш): 8 видов еды, 17 предметов магазина, 8 комнат, 17 ачивок, 6 квестов

### `src/handlers/` — HTTP-хендлеры

Каждый хендлер: загрузить данные → применить engine → сохранить в транзакции → тикнуть прогресс → вернуть JSON.

- **`auth.rs`** — register (транзакция), login (с dummy verify), refresh (ротация токена), logout (проверка владельца)
- **`pet.rs`** — 15 эндпоинтов, каждый загружает реальный `coin_balance` для engine
- **`economy.rs`** — buy_item и use_item в транзакциях
- **`progress.rs`** — claim в транзакциях с `UPDATE … RETURNING`
- **`rooms.rs`** — buy_room в транзакции; equip_room обновляет `user_rooms.equipped`
- **`sync.rs`** — offline sync с дедупликацией по `commandId`, timestamp-сортировка батча
- **`sse.rs`** — SSE стрим через dedicated Redis pub/sub соединение
- **`health.rs`** — ping PostgreSQL + Redis

### `src/middleware/`

- **`auth.rs`** — Axum extractor `AuthUser`, проверяет Bearer token, явный `Algorithm::HS256`, требует `exp` + `sub`
- **`rate_limit.rs`** — Redis INCR/EXPIRE, 60 req/min per IP; fail-closed при недоступности Redis

### `src/jobs/`

- **`auto_decay.rs`** — каждые 5 минут: загружает всех питомцев, применяет временной декай пропорционально `elapsed_hours`, сохраняет, пуш в SSE
- **`quest_reset.rs`** — ждёт до midnight UTC, удаляет все истёкшие квесты

---

## База данных

### Схема (6 таблиц)

```sql
users          — id, username, email, password_hash, created_at
pets           — id, user_id, state (JSONB), updated_at
pet_events     — id, pet_id, event_type, description, emoji, xp_gained, coins_gained
pet_commands   — id, pet_id, user_id, command_type, payload, result, status, error, created_at
user_coins     — user_id, balance, updated_at
user_inventory — user_id, item_id, quantity
user_achievements — user_id, achievement_id, progress, unlocked, unlocked_at, claimed
user_quests    — user_id, quest_id, progress, completed, claimed, expires_at
user_rooms     — user_id, room_id, equipped
```

### Leaderboard view

```sql
CREATE VIEW leaderboard_view AS
  SELECT u.username, p.state->>'level' as level, ...
  ROW_NUMBER() OVER (ORDER BY score DESC)
```

---

## Безопасность

| Механизм | Реализация |
|---|---|
| Пароли | Argon2id (отраслевой стандарт) |
| Access tokens | JWT HS256, TTL 1 час |
| Refresh tokens | 32 байта random, хранятся как SHA-256 хэш в Redis |
| Ротация токенов | При каждом `/refresh` — старый удаляется, выдаётся новый |
| Rate limiting | Redis INCR/EXPIRE, 60 req/min per IP на auth endpoints |
| JWT валидация | Явный алгоритм HS256, required claims `exp`+`sub` |
| Timing attack | Dummy argon2 verify для несуществующего email |
| JWT secret | Fail-fast при запуске если < 32 символов |
| Username | Валидация: 3-30 символов, `[a-zA-Z0-9_]` |
| Body limit | 1 MB максимум через `RequestBodyLimitLayer` |
| CORS | Configurable origins, warning при пустом списке |
| Изоляция данных | Все DB-запросы фильтрованы по `user_id` из JWT |

---

## Особенности реализации

### Offline-first синхронизация

Клиент может работать офлайн и накапливать команды. При восстановлении соединения отправляет батч в `POST /api/pet/sync/commands`:
1. Дедупликация по `commandId` — повторная отправка безопасна
2. Сортировка по timestamp — команды применяются в правильном порядке
3. Каждая команда прогоняется через engine
4. Возвращает `ServerCommandAck` с accepted/rejected списками

### SSE Real-time обновления

Каждое изменение питомца публикуется в Redis channel `pet_updates:{user_id}`. SSE handler'ы подписаны на этот канал и пушат обновления подключённым клиентам без polling.

### Personality Engine

Полный порт TypeScript-движка в Rust:
- 16 личностей с уникальными правилами поведения
- Система эмержентных состояний (coin_obsession, void_walker, solar_pet и др.)
- Trait Evolution v5.0 — питомец эволюционирует на основе истории взаимодействий
- Core Memories — питомец "запоминает" значимые события
- Catharsis и Singularity механики
- Параноидные фазы (untrusted → trusted → collapsed)

### Транзакционная целостность

Все составные операции обёрнуты в `sqlx::Transaction`:
- Регистрация: user + coins + pet атомарно
- Покупка: списание монет + добавление в инвентарь
- Использование предмета: убрать из инвентаря + обновить питомца
- Claim ачивки/квеста: отметка + начисление монет

---

## Observability

### Логи
Структурированный JSON через `tracing` + `tracing-subscriber`. Каждый запрос содержит `request_id` для трассировки.

### Трейсы
Опциональный OTLP экспорт в Jaeger. Включается переменной `OTEL_EXPORTER_OTLP_ENDPOINT`.

### Метрики (Prometheus)
Доступны на `/metrics`:
- `pet_actions_total{action}` — счётчик действий
- `http_requests_total{method,path,status}` — HTTP статистика
- `engine_apply_duration_ms` — время движка

### Grafana
Готовый дашборд в `grafana/dashboard.json`.
