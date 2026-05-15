# Zdesagochi Backend — Rust Implementation Plan

> Дата: 2026-05-14
> Файл задач: `backend/TASKS.md`
> API контракт: `src/api/types.ts`, `src/api/serverApi.ts`
> Перед работой читать этот файл + TASKS.md.

---

## 1. Technology Stack

| Слой | Технология | Почему |
|---|---|---|
| Web framework | **Axum 0.8** | Самый современный Rust HTTP фреймворк, tower-совместимый, отличная экосистема |
| Async runtime | **Tokio 1.x** | Стандарт де-факто |
| Database | **PostgreSQL 16** | JSONB для pet-state, полноценные транзакции |
| DB driver | **SQLx 0.8** | Async, compile-time query verification, zero-cost |
| Cache / PubSub | **Redis 7** | Сессии, rate limiting, SSE pub/sub, leaderboard cache |
| Redis client | **deadpool-redis** | Connection pooling + async |
| Serialization | **serde + serde_json** | Стандарт |
| Auth | **jsonwebtoken** | JWT HS256 + refresh token в Redis |
| Passwords | **argon2** | Современный password hashing (bcrypt устарел) |
| Validation | **validator** + **garde** | Declarative field validation |
| Error handling | **thiserror** (library) + **anyhow** (app) | Идиоматично |
| IDs | **ulid** | Lexicographically sortable, trendier than UUID |
| Middleware | **tower-http** | CORS, compression, tracing, request-id |
| Logging | **tracing** + **tracing-subscriber** | Structured JSON logs |
| Tracing | **tracing-opentelemetry** + **opentelemetry-otlp** | Jaeger-compatible |
| Metrics | **metrics** + **metrics-exporter-prometheus** | Prometheus-compatible |
| OpenAPI | **utoipa** + **utoipa-swagger-ui** | Auto-generated docs |
| Background jobs | **Tokio tasks** + **tokio-cron-scheduler** | Lightweight, no external queue |
| Real-time | **axum SSE** (Server-Sent Events) | Проще WebSocket, достаточно для push-обновлений |
| Testing | **cargo-nextest** + **testcontainers** | Быстрее `cargo test`, реальный postgres/redis в тестах |
| Dev reload | **cargo-watch** | `cargo watch -x run` |
| Migrations | **sqlx-cli** | `sqlx migrate run` |
| Containerization | **Docker** + **docker-compose** | dev + prod |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  RealApiService → REST + SSE                                 │
└────────────────────┬─────────────────────────────────────────┘
                     │ HTTP/SSE
┌────────────────────▼─────────────────────────────────────────┐
│                    Axum Router                               │
│  tower middleware: auth · rate_limit · trace · compress      │
├──────────────────────────────────────────────────────────────┤
│   Handlers (axum extractors → domain logic → JSON response)  │
│   pet · auth · economy · progress · rooms · sync · sse       │
├──────────────────────────────────────────────────────────────┤
│   Personality Engine (Rust port)                             │
│   applyPersonalityCommand → PetCommandResult                 │
│   (mirrors packages/personality-core/src/commandHandlers.ts) │
├──────────────────────────────────────────────────────────────┤
│   Repository layer (SQLx queries)                            │
│   pet_repo · economy_repo · progress_repo · user_repo        │
├────────────────┬──────────────────────────────────────────────┤
│   PostgreSQL   │   Redis                                      │
│   (pet JSONB,  │   (sessions, rate limits,                    │
│    commands,   │    SSE pub/sub, leaderboard cache)           │
│    economy)    │                                              │
└────────────────┴──────────────────────────────────────────────┘
```

---

## 3. Database Schema

### `users`
```sql
id          TEXT PRIMARY KEY,          -- ULID
username    TEXT UNIQUE NOT NULL,
email       TEXT UNIQUE NOT NULL,
password_hash TEXT NOT NULL,
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```

### `pets`
```sql
id          TEXT PRIMARY KEY,          -- ULID
user_id     TEXT NOT NULL REFERENCES users(id),
state       JSONB NOT NULL,            -- полный Pet объект
created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```
Pet хранится как единый JSONB документ. Это избегает миграций при каждом добавлении поля в движке.

### `pet_commands`
```sql
id              TEXT PRIMARY KEY,      -- commandId от клиента
pet_id          TEXT NOT NULL REFERENCES pets(id),
user_id         TEXT NOT NULL,
command_type    TEXT NOT NULL,         -- 'feed', 'play', etc.
command_json    JSONB NOT NULL,        -- полный PetCommand
result_json     JSONB,                 -- PetCommandResult (null если rejected)
status          TEXT NOT NULL,         -- 'accepted' | 'rejected'
reject_reason   TEXT,
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```

### `pet_events`
```sql
id          TEXT PRIMARY KEY,
pet_id      TEXT NOT NULL REFERENCES pets(id),
event_type  TEXT NOT NULL,
description TEXT NOT NULL,
emoji       TEXT NOT NULL,
xp_gained   INTEGER,
coins_gained INTEGER,
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```

### `user_coins`
```sql
user_id     TEXT PRIMARY KEY REFERENCES users(id),
balance     INTEGER NOT NULL DEFAULT 100
```

### `user_inventory`
```sql
user_id     TEXT NOT NULL,
item_id     TEXT NOT NULL,
quantity    INTEGER NOT NULL DEFAULT 0,
PRIMARY KEY (user_id, item_id)
```

### `user_achievements`
```sql
user_id         TEXT NOT NULL,
achievement_id  TEXT NOT NULL,
progress        INTEGER NOT NULL DEFAULT 0,
unlocked        BOOLEAN NOT NULL DEFAULT false,
unlocked_at     TIMESTAMPTZ,
claimed         BOOLEAN NOT NULL DEFAULT false,
PRIMARY KEY (user_id, achievement_id)
```

### `user_quests`
```sql
user_id     TEXT NOT NULL,
quest_id    TEXT NOT NULL,
progress    INTEGER NOT NULL DEFAULT 0,
completed   BOOLEAN NOT NULL DEFAULT false,
claimed     BOOLEAN NOT NULL DEFAULT false,
expires_at  TIMESTAMPTZ NOT NULL,
PRIMARY KEY (user_id, quest_id, expires_at)
```

### `user_rooms`
```sql
user_id     TEXT NOT NULL,
room_id     TEXT NOT NULL,
unlocked    BOOLEAN NOT NULL DEFAULT false,
equipped    BOOLEAN NOT NULL DEFAULT false,
PRIMARY KEY (user_id, room_id)
```

---

## 4. Directory Structure

```
backend/
├── Cargo.toml                 workspace + bin
├── Cargo.lock
├── TASKS.md                   ← файл прогресса
├── .env.example
├── docker-compose.yml         postgres + redis + jaeger
├── docker-compose.prod.yml    postgres + redis + nginx
├── Dockerfile                 multi-stage
├── migrations/
│   ├── 001_init.sql
│   ├── 002_economy.sql
│   ├── 003_progress.sql
│   ├── 004_rooms.sql
│   └── 005_leaderboard.sql
└── src/
    ├── main.rs                Tokio entry, router, graceful shutdown
    ├── config.rs              Config struct, from_env()
    ├── state.rs               AppState { db, redis, config }
    ├── error.rs               AppError → (StatusCode, JSON)
    ├── router.rs              route registration
    │
    ├── middleware/
    │   ├── mod.rs
    │   ├── auth.rs            AuthUser extractor (JWT → user_id)
    │   └── rate_limit.rs      Redis INCR/EXPIRE per IP
    │
    ├── handlers/
    │   ├── mod.rs
    │   ├── auth.rs            register, login, refresh, logout
    │   ├── pet.rs             get, name, events, actions (feed/play/...)
    │   ├── sync.rs            POST /sync/commands, GET /sync/results
    │   ├── economy.rs         coins, shop, inventory
    │   ├── progress.rs        achievements, quests
    │   ├── rooms.rs           rooms list, buy, equip
    │   ├── leaderboard.rs     leaderboard
    │   └── sse.rs             GET /sse/pet
    │
    ├── domain/
    │   ├── mod.rs
    │   ├── user.rs            User, Claims
    │   ├── pet.rs             Pet, PetStats, PetMood, ... (mirrors types.ts)
    │   ├── economy.rs         ShopItem, InventoryItem, BuyResult
    │   └── progress.rs        Achievement, DailyQuest
    │
    ├── engine/                Rust port of personality engine
    │   ├── mod.rs
    │   ├── types.rs           TraitVector, BehavioralCounters, ...
    │   ├── personalities.rs   PERSONALITIES array (16 items)
    │   ├── catalog.rs         SHOP_ITEMS, FOODS, ROOMS, ACHIEVEMENTS, QUESTS
    │   ├── personality_engine.rs  updateCounters, calcMoodWithBias, computeEmergentState, applyDecay
    │   ├── trait_evolution.rs     checkEvolution, shadow form, catharsis, singularity, legacy
    │   ├── command_handlers.rs    applyPersonalityCommand → PetCommandResult
    │   ├── action_rules.rs        FLAG_RESTORE_EFFECTS
    │   ├── passive_rules.rs       PASSIVE_RULES
    │   ├── decay_rules.rs         BASE_DECAY_PER_MINUTE
    │   ├── pattern_rules.rs       PATTERN_RULES
    │   └── gameplay_state_rules.rs GAMEPLAY_STATE_RULES
    │
    ├── db/
    │   ├── mod.rs
    │   ├── pet_repo.rs        get_pet, upsert_pet, create_pet
    │   ├── command_repo.rs    insert_command, get_results_since
    │   ├── economy_repo.rs    get_coins, add_coins, buy_item, use_item
    │   ├── progress_repo.rs   achievements, quests
    │   ├── room_repo.rs       user rooms
    │   └── user_repo.rs       create_user, find_by_email
    │
    └── jobs/
        ├── mod.rs
        ├── auto_decay.rs      каждые 5 мин → sync tick для всех активных питомцев
        ├── quest_reset.rs     каждый день в 00:00 UTC → reset daily quests
        └── leaderboard.rs     каждые 5 мин → пересчёт leaderboard
```

---

## 5. All API Endpoints

### Auth (новые эндпоинты — забытые тобой)
```
POST  /api/auth/register   { username, email, password }      → { token, refresh_token, user }
POST  /api/auth/login      { email, password }                → { token, refresh_token, user }
POST  /api/auth/refresh    { refresh_token }                  → { token }
POST  /api/auth/logout     Bearer token                       → 204
```

### Pet
```
GET   /api/pet                    → Pet
POST  /api/pet/import             OfflinePetSave              → Pet   (409 если питомец уже есть)
POST  /api/pet/feed               { foodId }                  → Pet
POST  /api/pet/play                                           → PlayResult
POST  /api/pet/sleep                                          → Pet
POST  /api/pet/wake                                           → Pet
POST  /api/pet/bathe                                          → Pet
POST  /api/pet/heal                                           → Pet
POST  /api/pet/bond                                           → Pet
POST  /api/pet/sync                                           → Pet
POST  /api/pet/evolution/accept                               → Pet
POST  /api/pet/evolution/reject                               → Pet
POST  /api/pet/new-life                                       → NewLifeResult
PATCH /api/pet/name               { name }                    → Pet
GET   /api/pet/events                                         → PetEvent[]
```

### Offline Sync Protocol (новые — из serverApi.ts)
```
POST  /api/pet/sync/commands      ServerCommandBatch          → ServerCommandAck
GET   /api/pet/sync/results       ?since=<commandId>          → PetCommandResult[]
```

### Economy
```
GET   /api/coins                                              → { coins }
GET   /api/shop                                               → ShopItem[]
POST  /api/shop/buy               { itemId }                  → BuyResult
GET   /api/inventory                                          → InventoryItem[]
POST  /api/inventory/use          { itemId }                  → Pet
GET   /api/foods                                              → FoodItem[]
```

### Progress
```
GET   /api/achievements                                       → Achievement[]
POST  /api/achievements/claim     { achievementId }           → ClaimResult
GET   /api/quests                                             → DailyQuest[]
POST  /api/quests/claim           { questId }                 → QuestClaimResult
```

### Rooms
```
GET   /api/rooms                                              → Room[]
POST  /api/rooms/buy              { roomId }                  → Room[]
POST  /api/rooms/equip            { roomId }                  → { roomId }
```

### Leaderboard
```
GET   /api/leaderboard                                        → LeaderboardEntry[]
```

### Real-time (новые — забытые тобой)
```
GET   /api/sse/pet                Bearer token                → SSE stream<Pet>
```

### Observability (новые)
```
GET   /health                                                 → { status, db, redis }
GET   /metrics                                                → Prometheus text format
GET   /docs                                                   → Swagger UI
GET   /api/openapi.json                                       → OpenAPI 3.1 spec
```

Итого: **38 эндпоинтов** (22 из контракта + 16 новых).

---

## 6. Personality Engine Port Strategy

TypeScript-движок переносится в Rust 1-в-1, файл-за-файлом:

| TypeScript файл | Rust эквивалент |
|---|---|
| `types.ts` | `engine/types.rs` |
| `PersonalityEngine.ts` | `engine/personality_engine.rs` |
| `TraitEvolutionEngine.ts` | `engine/trait_evolution.rs` |
| `commandHandlers.ts` | `engine/command_handlers.rs` |
| `actionRules.ts` | `engine/action_rules.rs` |
| `passiveRules.ts` | `engine/passive_rules.rs` |
| `decayRules.ts` | `engine/decay_rules.rs` |
| `patternRules.ts` | `engine/pattern_rules.rs` |
| `gameplayStateRules.ts` | `engine/gameplay_state_rules.rs` |
| `personalities.ts` | `engine/personalities.rs` |
| `influenceRegistry.ts` | `engine/catalog.rs` |

**Стратегия верификации**: запустить один и тот же input через TS-движок (npm test) и Rust-движок, сравнить JSON output. Расхождение = баг в порте.

---

## 7. Authentication Flow

```
Register:
  POST /api/auth/register
  → argon2::hash(password)
  → INSERT users
  → INSERT pets (начальный питомец)
  → INSERT user_coins (100 монет)
  → generate JWT (exp: 1h) + refresh_token (exp: 30d, stored in Redis)
  → return { token, refresh_token, user }

Login:
  POST /api/auth/login
  → argon2::verify(password, hash)
  → generate JWT + refresh_token
  → return { token, refresh_token }

Protected request:
  Bearer <JWT> → AuthUser extractor → user_id в AppState
```

---

## 8. Offline Sync Protocol

Фронтенд накапливает команды в `SyncQueue` (localStorage) и периодически сбрасывает их батчем:

```
POST /api/pet/sync/commands
Body: {
  clientId: string,
  commands: PetCommand[],     // массив из SyncQueue.listPending()
  baseCommandId: string | null
}

Server:
  1. Загрузить текущий pet state из postgres
  2. Дедупликация по commandId (уже принятые — skip)
  3. Replay команд по порядку через engine
  4. Если команда blocked — reject с причиной
  5. Сохранить итоговый state
  6. Сохранить результаты в pet_commands
  7. Return ServerCommandAck

Response: {
  acceptedCommandIds: string[],
  rejectedCommandIds: string[],
  rejectedCommands: [{ commandId, reason, message }],
  lastAcceptedCommandId: string | null
}
```

---

## 9. SSE Real-time Flow

```
Client: GET /api/sse/pet (long-lived connection)
Server:
  1. Валидировать JWT
  2. Подписаться на Redis channel "pet_updates:{user_id}"
  3. Каждое сообщение в канале → отправить SSE event: { data: Pet }
  4. При разрыве — отписаться от Redis

Auto-decay job:
  1. Каждые 5 мин → SELECT активных питомцев
  2. Для каждого: applyPersonalityCommand(sync) → save
  3. PUBLISH "pet_updates:{user_id}" {pet_json}
```

---

## 10. Environment Variables

```bash
# Database
DATABASE_URL=postgres://zdesagochi:secret@localhost:5432/zdesagochi

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-256-bit-secret-here
JWT_EXPIRY_SECONDS=3600
REFRESH_TOKEN_EXPIRY_SECONDS=2592000

# Server
HOST=0.0.0.0
PORT=8080
ENVIRONMENT=development  # development | production

# CORS
CORS_ORIGINS=http://localhost:5173,https://yourdomain.com

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
LOG_LEVEL=info

# Rate limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=60
```

---

## 11. What You Forgot to Mention

Это важные вещи которые нужны но ты не упомянул:

### 1. Authentication
Без auth весь бэкенд — один глобальный питомец. Нужны: register/login, JWT, refresh tokens. Каждый пользователь = свой питомец.

### 2. Offline Sync Protocol
Фронтенд уже имеет `SyncQueue` и `ServerApi` интерфейс (`src/api/serverApi.ts`). Сервер должен принимать батч команд и возвращать `ServerCommandAck`. Без этого оффлайн-игра невозможна.

### 3. Real-time (SSE)
Pet статы меняются без участия пользователя (auto-decay job). Нужен push-механизм чтобы фронтенд видел изменения без polling. SSE — самое простое решение.

### 4. Background Jobs
Питомец деградирует со временем. Без серверного auto-decay job питомец замирает пока открыт браузер. Нужны: decay job (каждые 5 мин), quest reset job (полночь).

### 5. Rate Limiting
Без rate limit пользователь может спамить `/api/pet/feed` 1000 раз в секунду и бесконечно фармить монеты.

### 6. Multi-user Support
Один бэкенд обслуживает всех студентов. Каждый пользователь = отдельный аккаунт и питомец.

### 6. Multi-user Data Isolation
Каждый SQL-запрос в `db/` слое **обязан** фильтровать по `user_id` из JWT. Без явной проверки user A может прочитать или перезаписать питомца user B. Нужен audit-тест: создать двух пользователей, проверить что их данные не пересекаются ни по одному эндпоинту.

### 7. Data Migration (localStorage → backend)
У студентов уже есть прогресс в localStorage. Нужен endpoint `POST /api/pet/import` который принимает `OfflinePetSave` и загружает его на сервер при первом логине. Возвращает `409 Conflict` если питомец уже создан (защита от двойного импорта).

### 8. OpenAPI / Swagger
Автогенерация документации через `utoipa`. Студентам нужна чёткая документация API чтобы тестировать через Postman/Swagger UI без чтения кода.

### 9. Leaderboard Scoring Algorithm
`GET /api/leaderboard` уже есть в контракте, но нет логики как считается `score`. Нужно определить: `level * 100 + xp + bond * 10 + catharsisAchieved * 500` (или другое).

### 10. Daily Quest Reset
Квесты сбрасываются ежедневно — нужен cron job. Без него квесты либо вечные либо никогда не сбрасываются.

---

## 12. Implementation Order (рекомендуемый)

```
Phase 0: Foundation          (2-3 дня)  → docker-compose, db, AppState, health
Phase 1: Auth                (1-2 дня)  → register, login, JWT middleware
Phase 2: Pet State           (1-2 дня)  → get_pet, JSONB storage
Phase 3: Personality Engine  (4-6 дней) → Rust port + unit tests
Phase 4: Pet Commands        (2-3 дня)  → все action endpoints
Phase 5: Offline Sync        (2 дня)    → batch command sync
Phase 6: Economy             (1-2 дня)  → shop, inventory
Phase 7: Progress            (1-2 дня)  → achievements, quests
Phase 8: Rooms + Leaderboard (1 день)
Phase 9: Background Jobs     (1 день)
Phase 10: SSE                (1-2 дня)
Phase 11: Observability      (1 день)
Phase 12: OpenAPI            (0.5 дня)
Phase 13: Hardening          (1 день)
─────────────────────────────────────────
Total:                     ~20-28 дней
```

---

## 13. Key Design Decisions

| Решение | Альтернатива | Почему это |
|---|---|---|
| Pet state как JSONB | Отдельные колонки | Engine добавляет поля часто; JSONB не требует миграций |
| SSE вместо WebSocket | WebSocket | Проще, достаточно для одностороннего push; WebSocket добавляет сложность без явной пользы |
| Rust port engine | WASM из TS | WASM добавляет сложность wasmtime/wasm-bindgen; Rust port тестируем и fast |
| ULID вместо UUID | UUID v4 | Лексикографически сортируемый, читаемый, URL-safe |
| argon2 вместо bcrypt | bcrypt | bcrypt устарел, argon2id — современный стандарт |
| Redis pub/sub для SSE | Polling | Polling не работает при нескольких инстансах сервера |
| Append-only pet_commands | Update in place | Event sourcing: можно replay историю, debug, аудит |
