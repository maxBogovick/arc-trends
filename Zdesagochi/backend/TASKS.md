# Zdesagochi Backend — Tasks

> Файл прогресса. Перед любой работой по бэкенду читать этот файл + `docs/backend_rust_plan.md`.
> Статусы: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocker

---

## Phase 0 — Foundation

- [ ] `P0-1` Создать `backend/` директорию, `Cargo.toml` с workspace
- [ ] `P0-2` Добавить все зависимости (axum, sqlx, redis, tower-http, tracing, utoipa, ...)
- [ ] `P0-3` Написать `docker-compose.yml` (postgres 16, redis 7, jaeger)
- [ ] `P0-4` Написать `.env.example` со всеми переменными
- [ ] `P0-5` Реализовать `src/config.rs` — загрузка config из env через `config` crate
- [ ] `P0-6` Реализовать `src/state.rs` — `AppState` (PgPool, Redis pool, config)
- [ ] `P0-7` Реализовать `src/error.rs` — `AppError` через `thiserror`, JSON error response
- [ ] `P0-8` Реализовать `src/main.rs` — Tokio runtime, router, graceful shutdown
- [ ] `P0-9` Написать migration `001_init.sql` — users, pets, pet_events, pet_commands
- [ ] `P0-10` Написать migration `002_economy.sql` — inventory, transactions
- [ ] `P0-11` Написать migration `003_progress.sql` — achievements, quests
- [ ] `P0-12` Написать migration `004_rooms.sql` — user_rooms
- [ ] `P0-13` Написать migration `005_leaderboard.sql` — leaderboard view
- [ ] `P0-14` `GET /health` — health check endpoint (db ping + redis ping)
- [ ] `P0-15` Подключить `tracing-subscriber` + structured JSON logs
- [ ] `P0-16` Проверить: `cargo build`, `docker-compose up`, `/health` отвечает

---

## Phase 1 — Auth

- [ ] `P1-1` Реализовать `domain/user.rs` — `User`, `Claims` (JWT payload)
- [ ] `P1-2` Реализовать `db/user_repo.rs` — create_user, find_by_email
- [ ] `P1-3` Реализовать `middleware/auth.rs` — Axum extractor `AuthUser` из Bearer token
- [ ] `P1-4` `POST /api/auth/register` — body: `{ username, email, password }` → `{ token, refresh_token, user }`
- [ ] `P1-5` `POST /api/auth/login` — body: `{ email, password }` → `{ token, refresh_token, user }`
- [ ] `P1-6` `POST /api/auth/refresh` — body: `{ refresh_token }` → `{ token }`
- [ ] `P1-7` `POST /api/auth/logout` — инвалидировать refresh token в Redis
- [ ] `P1-8` Написать интеграционный тест: register → login → защищённый эндпоинт
- [ ] `P1-9` Middleware `rate_limit.rs` — через Redis INCR/EXPIRE: 60 req/min per IP

---

## Phase 2 — Pet State

- [ ] `P2-0` **Multi-user isolation audit**: убедиться что каждый SQL-запрос в `db/` фильтрует по `user_id` из JWT. Написать тест: user A не видит питомца user B.
- [ ] `P2-1` Реализовать `domain/pet.rs` — все Rust-типы из `src/api/types.ts` (Pet, PetStats, PetMood, ...)
- [ ] `P2-2` Реализовать `domain/personality.rs` — TraitVector, BehavioralCounters, CoreMemory, EvolutionProposal, ...
- [ ] `P2-3` Реализовать `db/pet_repo.rs` — get_pet, create_pet, upsert_pet (state как JSONB)
- [ ] `P2-4` `GET /api/pet` — возврат текущего Pet
- [ ] `P2-5` `PATCH /api/pet/name` — body: `{ name }` → Pet
- [ ] `P2-6` `GET /api/pet/events` — последние 50 событий из pet_events
- [ ] `P2-7` `POST /api/pet/new-life` → NewLifeResult (reset pet + copy legacy)
- [ ] `P2-8` `POST /api/pet/import` — body: `OfflinePetSave` (из localStorage) → Pet; импорт прогресса при первом входе; если питомец уже есть — вернуть 409
- [ ] `P2-9` Написать тест: GET /api/pet возвращает корректную структуру
- [ ] `P2-10` Написать тест: import → get_pet возвращает импортированный state

---

## Phase 3 — Personality Engine (Rust Port)

- [ ] `P3-1` Реализовать `engine/types.rs` — BehavioralCounters, TraitVector, StateLayers, PersonalitySpecialRules
- [ ] `P3-2` Реализовать `engine/personalities.rs` — PERSONALITIES массив (16 характеров) как Rust конст
- [ ] `P3-3` Реализовать `engine/personality_engine.rs` — updateCounters, calcMoodWithBias, computeEmergentState, applyDecay, computeNaturalPassives
- [ ] `P3-4` Реализовать `engine/trait_evolution.rs` — checkEvolution, acceptEvolution, checkShadowForm, addCatharsisProgress, detectSingularity, recordLegacy
- [ ] `P3-5` Реализовать `engine/command_handlers.rs` — applyPersonalityCommand → PetCommandResult
- [ ] `P3-6` Написать unit-тесты для engine (порт тестов из `tests/personalityEvolution.test.ts`)
- [ ] `P3-7` Сверить результаты Rust-движка с TS через snapshot-тесты (одинаковый input → одинаковый output)

---

## Phase 4 — Pet Commands

- [ ] `P4-1` Реализовать `handlers/pet.rs` — общий execute_command helper (apply engine → save state → emit events)
- [ ] `P4-2` `POST /api/pet/feed` — body: `{ foodId }` → Pet
- [ ] `P4-3` `POST /api/pet/play` → PlayResult
- [ ] `P4-4` `POST /api/pet/sleep` → Pet
- [ ] `P4-5` `POST /api/pet/wake` → Pet
- [ ] `P4-6` `POST /api/pet/bathe` → Pet
- [ ] `P4-7` `POST /api/pet/heal` → Pet
- [ ] `P4-8` `POST /api/pet/bond` → Pet
- [ ] `P4-9` `POST /api/pet/sync` → Pet (decay + passives tick)
- [ ] `P4-10` `POST /api/pet/evolution/accept` → Pet
- [ ] `P4-11` `POST /api/pet/evolution/reject` → Pet
- [ ] `P4-12` Сохранять каждую команду в `pet_commands` таблицу (event log)
- [ ] `P4-13` Написать интеграционные тесты для каждого action endpoint

---

## Phase 5 — Offline Sync Protocol

- [ ] `P5-1` Реализовать `handlers/sync.rs`
- [ ] `P5-2` `POST /api/pet/sync/commands` — body: `ServerCommandBatch` → `ServerCommandAck`
  - принять массив команд, дедупликация по commandId
  - replay в порядке timestamp через engine
  - вернуть `{ acceptedCommandIds, rejectedCommandIds, rejectedCommands, lastAcceptedCommandId }`
- [ ] `P5-3` `GET /api/pet/sync/results?since=<commandId>` → `PetCommandResult[]`
- [ ] `P5-4` Написать тест: offline batch с 5 командами corectly применяется

---

## Phase 6 — Economy

- [ ] `P6-1` Реализовать `domain/economy.rs` — ShopItem, InventoryItem, BuyResult
- [ ] `P6-2` Реализовать `db/economy_repo.rs` — get_coins, add_coins, get_inventory, upsert_inventory
- [ ] `P6-3` Реализовать seed-данные SHOP_ITEMS в `engine/catalog.rs`
- [ ] `P6-4` `GET /api/coins` → `{ coins: number }`
- [ ] `P6-5` `GET /api/shop` → ShopItem[]
- [ ] `P6-6` `POST /api/shop/buy` — body: `{ itemId }` → BuyResult (транзакция: -coins + +inventory)
- [ ] `P6-7` `GET /api/inventory` → InventoryItem[]
- [ ] `P6-8` `POST /api/inventory/use` — body: `{ itemId }` → Pet (use_item command через engine)
- [ ] `P6-9` `GET /api/foods` → FoodItem[]

---

## Phase 7 — Progress

- [ ] `P7-1` Реализовать `domain/progress.rs` — Achievement, DailyQuest, ...
- [ ] `P7-2` Реализовать `db/progress_repo.rs` — get_achievements, unlock_achievement, get_quests, tick_quest
- [ ] `P7-3` Реализовать `engine/achievements.rs` — checkAchievement logic (mirrored from mockApi)
- [ ] `P7-4` `GET /api/achievements` → Achievement[]
- [ ] `P7-5` `POST /api/achievements/claim` — body: `{ achievementId }` → ClaimResult
- [ ] `P7-6` `GET /api/quests` → DailyQuest[]
- [ ] `P7-7` `POST /api/quests/claim` — body: `{ questId }` → QuestClaimResult

---

## Phase 8 — Rooms & Leaderboard

- [ ] `P8-1` Реализовать `domain/rooms.rs` + seed ROOMS_CATALOG
- [ ] `P8-2` `GET /api/rooms` → Room[] (unlocked = true если куплена)
- [ ] `P8-3` `POST /api/rooms/buy` — body: `{ roomId }` → Room[]
- [ ] `P8-4` `POST /api/rooms/equip` — body: `{ roomId }` → `{ roomId }`
- [ ] `P8-5` Реализовать leaderboard scoring (level * 100 + xp + bond)
- [ ] `P8-6` `GET /api/leaderboard` → LeaderboardEntry[] (кэш в Redis 60s)

---

## Phase 9 — Background Jobs

- [ ] `P9-1` Реализовать `jobs/auto_decay.rs` — Tokio task, каждые 5 мин выбирает всех активных питомцев, запускает sync-тик через engine, сохраняет
- [ ] `P9-2` Реализовать `jobs/quest_reset.rs` — Tokio task, сброс квестов в midnight UTC
- [ ] `P9-3` Реализовать `jobs/leaderboard_refresh.rs` — пересчёт leaderboard каждые 5 мин
- [ ] `P9-4` Написать тест: питомец без действий через 24ч имеет упавшие статы

---

## Phase 10 — Real-time (SSE)

- [ ] `P10-1` Реализовать `handlers/sse.rs` — SSE stream на Axum
- [ ] `P10-2` `GET /api/sse/pet` — Server-Sent Events: отправлять Pet при каждом изменении
- [ ] `P10-3` При каждом save_pet — публиковать событие в Redis pub/sub
- [ ] `P10-4` SSE handler подписывается на Redis channel для конкретного userId
- [ ] `P10-5` Добавить SSE-клиент во фронтенд (subscribe при старте, обновлять petStore)
- [ ] `P10-6` Написать тест: auto-decay job → SSE клиент получает обновлённый Pet

---

## Phase 11 — Observability

- [ ] `P11-1` Подключить `tracing-opentelemetry` + `opentelemetry-otlp` (Jaeger)
- [ ] `P11-2` Добавить `tower_http::trace::TraceLayer` на все маршруты
- [ ] `P11-3` `GET /metrics` — Prometheus endpoint через `metrics-exporter-prometheus`
- [ ] `P11-4` Добавить ключевые метрики: requests_total, pet_actions_total, engine_apply_duration_ms
- [ ] `P11-5` Написать `grafana/dashboard.json` — базовый дашборд

---

## Phase 12 — OpenAPI / Docs

- [ ] `P12-1` Добавить `utoipa` аннотации на все handlers
- [ ] `P12-2` `GET /docs` — Swagger UI через `utoipa-swagger-ui`
- [ ] `P12-3` `GET /api/openapi.json` — OpenAPI 3.1 spec
- [ ] `P12-4` Проверить spec совпадает с `src/api/types.ts` контрактом

---

## Phase 13 — Hardening

- [ ] `P13-1` Написать `Dockerfile` (multi-stage: builder + distroless/slim runtime)
- [ ] `P13-2` Добавить `docker-compose.prod.yml` (без jaeger, с nginx)
- [ ] `P13-3` Настроить CORS — origins из config
- [ ] `P13-4` Добавить request body size limit (1MB)
- [ ] `P13-5` Добавить `tower_http::compression::CompressionLayer`
- [ ] `P13-6` `cargo clippy -- -D warnings` чисто
- [ ] `P13-7` `cargo nextest run` — все тесты green
- [ ] `P13-8` Загрузочный тест: 100 concurrent users, все actions < 50ms p99

---

## Done

_(сюда переносить завершённые задачи с датой)_
