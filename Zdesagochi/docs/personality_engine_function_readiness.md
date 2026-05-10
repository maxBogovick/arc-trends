# Personality Engine Function Readiness

> Дата: 2026-05-10  
> Назначение: честная контрольная таблица по функциям движка характера.  
> Этот документ отвечает на вопросы: что уже есть, что реально доказано, чего нет, сколько осталось и какие вопросы нужно было задать раньше.

---

## 1. Как читать статусы

| Статус | Что значит |
|---|---|
| Ready | Функция реализована, есть тесты или явное доказательство в коде, сейчас можно считать рабочей |
| Partial | Часть работает, но есть важный незакрытый кусок |
| Risk | Работает или частично работает, но архитектурно находится не там или может сломать цель |
| Missing | Функции по сути еще нет |
| Unknown | Нужна отдельная проверка, сейчас нельзя честно оценить |

Текущая честная оценка всего движка: **45-50% готовности**.

Главная причина: ядро эволюции уже есть, но gameplay/outcome/data-driven часть еще не доведена до целевой архитектуры.

---

## 1.1. Что делать сначала и что кого блокирует

| Приоритет | Что делать | Что это разблокирует | Что будет заблокировано, если не сделать |
|---|---|---|---|
| 1 | Command outcome: команда должна возвращать stats/XP/coins/blocked/events | Удаление gameplay logic из `mockApi`, нормальный offline replay, будущий backend sync | `mockApi` останется псевдо-сервером, backend придется копировать клиентскую логику |
| 2 | Разрезать `mockApi` на LocalSave + SyncQueue + ServerApi + PetService | Offline-first игра с синхронизацией при появлении интернета | Игра останется завязана на временный mock слой |
| 3 | Data-driven emergent states | Добавление новых характеров/состояний через data | `PersonalityEngine` продолжит знать конкретные personality IDs |
| 4 | System influences + events | Полная объяснимость и registry-driven lifecycle | Часть изменений характера останется не объясненной событиями |
| 5 | Simulation reports + final audit | Доказанный баланс и совпадение docs/code | Нельзя честно сказать, что движок готов |

Решение: **сначала Command outcome**.

Причина простая: если сейчас заняться только data-driven states, `mockApi` все равно останется местом, где считаются stats/XP/coins. Это не приблизит offline/sync к финальной архитектуре.  
Data-driven states важны, но они не заменяют `mockApi`. Их нужно делать после command outcome или как следующий крупный milestone.

---

## 2. Общая картина

| Блок | Готовность | Честное состояние |
|---|---:|---|
| Trait evolution core | 70% | Движение по 6D trait vector, formation, proposal, accept/reject, regression работают и покрыты тестами |
| Gameplay emergent states | 55% | Состояния есть и часть хорошо протестирована, но условия активации еще hardcoded в `PersonalityEngine` |
| Data-driven rules | 30% | Influence registry и pattern rules есть, но gameplay conditions/passives/actions еще не вынесены в registry |
| Command pipeline | 45% | `applyPersonalityCommand()` уже запускает personality-side pipeline, но не владеет полным stats/XP/coins outcome |
| Mock/backend parity | 35% | `mockApi` тоньше, чем раньше, но все еще считает экономику и часть gameplay результата |
| Events/explainability | 45% | Core Memories есть, domain events есть частично, но важные gameplay changes еще не полностью объяснимы через события |
| Balance/simulation proof | 10% | Тесты есть, но simulation reports по скорости и балансу почти отсутствуют |
| Documentation/code alignment | 55% | Главные расхождения описаны, часть закрыта, но `PERSONALITY_EVOLUTION_SYSTEM.md` еще не полностью совпадает с кодом |

---

## 3. Таблица функций

| Функция | Статус готовности | Доказательства | Что не готово / честный риск |
|---|---|---|---|
| 6D trait vector | Ready | `TraitVector`, `TRAIT_KEYS`, `createInitialTraitVector()`; тесты `dynamic radius follows age brackets`, `depth of immersion is 1 at personality center` | Нет крупного риска; нужно только финально сверить баланс чисел |
| Registered influences | Ready | `influenceRegistry.ts`, `applyInfluence()`; тесты `applyInfluence clamps daily budget and smooths vector`, `applyInfluence applies intensity rules only when conditions match` | System/environment influences еще не запускаются generic sync pass |
| Daily trait budget | Ready | `DAILY_BUDGET`, `applyInfluence()`; тест `applyInfluence clamps daily budget and smooths vector` | Нужна simulation-проверка, не слишком ли медленно/быстро двигает характер |
| Formation period | Ready | `FORMATION_THRESHOLD`, `updateFormationProgress()`, `completeFormation()`; тест `formation completes at threshold and selects nearest personality` | Нужен product-level UX: как игрок видит формирование |
| Regression to home personality | Ready | `applyRegression()`; тест `applyRegression moves exactly 2 percent toward personality home` | Баланс 2% не доказан симуляциями |
| Evolution proposal | Ready | `checkEvolution()`; тесты `checkEvolution creates proposal after stable target zone`, `respects hysteresis`, `clears target` | Нужно проверить UX и narrative selection в реальном UI |
| Accept/reject evolution | Ready | `acceptEvolution()`, `rejectEvolution()`; тесты `acceptEvolution records stable evolution and rare memory`, `rejectEvolution clears proposal without changing personality` | Нет полного product flow audit |
| Void / identity crisis | Partial | `handleVoidState()`; тест `void state enters identity_crisis after threshold` | Нужно проверить interaction с stateLayers и UI |
| Singularity | Ready/Partial | `detectSingularity()`, `checkSingularity()`, `collapseSingularity()`; тест `singularity intercepts checkEvolution and collapses into one active zone` | Механика есть, но rarity/balance не доказаны simulation reports |
| Shadow form | Ready/Partial | `checkShadowForm()`, `addCatharsisProgress()`; тест `shadow form enters from trauma and exits through catharsis cooldown` | Нужно проверить полный catharsis UX и события |
| Core Memories | Partial | `addCoreMemory()`, threshold crossing tests, memory generator | Есть память, но explainability не покрывает все gameplay changes |
| Memory text generation | Partial | `memoryTextGenerator.ts`, templates, sanitizer | AI/device mode не проверен как product feature |
| Weekly drift | Partial | `checkWeeklyDrift()`; тест `weekly drift requires seven snapshots and uses directional cooldown` | Не ясно, насколько это видно игроку и правильно сбалансировано |
| Sleep lifecycle | Ready/Partial | `onStartSleep()`, `onWakeFromSleep()`, `checkVarianceHardReset()`; тесты `sleep lifecycle resets confused only after natural 4h sleep`, `variance hard reset requires last full sleep timestamp` | Sleep gameplay outcome все еще не полностью command-owned |
| Offline save | Ready | `createOfflinePetSave()`, `save/load/deleteOfflinePetSave()`; тесты offline storage | Это storage layer, не полный gameplay replay |
| Offline command log | Ready/Partial | `appendOfflineCommand()`, `getUnsyncedCommands()`, `markCommandsSynced()`; тесты idempotency/sync window/compaction | Журнал команд работает, но replay пока не восстанавливает полный stats/XP/coins outcome |
| Personality command replay | Partial | `replayPersonalityCommands()`; тест `personality replay advances sync buckets and preserves cooldown math` | Replay personality-side работает, полный gameplay/economy replay еще нет |
| `applyPersonalityCommand()` entrypoint | Partial | `commandHandlers.ts`; тесты feed/use_item/sync/replay | Главный недочет: result не содержит полный stat/xp/coin/blocked/appliedModifiers outcome |
| Influence cooldowns in commands | Ready | `canApplyInfluenceAtSync()`, command handler cooldown tests | Нет крупного риска |
| Food item fallback | Ready | `use_item` command with `itemKind`; тесты food fallback и item precedence | Нет крупного риска |
| `mockApi` as adapter | Risk | Прямые influence internals убраны; `MockApi.getPet does not mutate...` | `mockApi` все еще считает base stats/XP/coins и часть special cases |
| Base stat deltas for actions | Risk | Сейчас в `mockApi` action methods | Должно перейти в command/gameplay layer |
| XP/coins outcome | Risk | `mockApi` и `applyActionModifiers()` вместе считают результат | Должно стать частью `PetCommandResult` |
| Action modifiers | Partial | `applyActionModifiers()`; тесты active layers, `perfect_balance` XP-only | Часть personality-specific logic hardcoded; часть economy остается в `mockApi` |
| Decay | Partial | `applyDecay()`; command sync вызывает decay | Есть hardcoded personality branches; нужно вынести в decay rules registry |
| Natural passives | Partial | `computeNaturalPassives()`; foodie/pristine/empath/natural regen | Passive effects hardcoded; нужен registry |
| Mood calculation | Partial | `calcMoodWithBias()`; command sync updates mood | Работает, но mood rules не data-driven |
| Behavioral counters | Ready/Partial | `updateCounters()`; rolling window tests | Много hardcoded special cases; часть thresholds не data-driven |
| Pattern rules | Ready/Partial | `PATTERN_RULES`, `validatePatternRules()`; tests for conditions | Только flags; gameplay emergent conditions еще не в этом registry |
| Behavioral flags | Ready/Partial | `runPatternEngine()`; tests for `perfect_balance`, rolling windows | Flag healing/deactivation частично есть, но balance не доказан |
| Emergent state definitions | Ready | `emergentStates.ts`, `EMERGENT_STATE_DEFS`, `EMERGENT_STATE_MAP` | Definitions есть; activation logic не полностью data-driven |
| Emergent state activation | Partial | `computeEmergentState()`; tests for stoic/enlightenment/feast/chaos | Главный долг: много `personality.id === ...` branches |
| `chaos_surge` | Ready | deterministic activation implemented; test `chaos_surge activates...` | Balance/UX не проверены симуляцией |
| `perfect_balance` | Ready | XP-only semantic fixed; test `perfect_balance is XP-only...` | Нет stat passive, и это теперь осознанно |
| State layers | Ready | `stateLayers.ts`; tests `state layers keep cognitive and evolution states...`, `legacy emergentState...` | UI должен дальше читать active states consistently |
| Action blockers | Partial | `isActionBlocked()`; test `action blockers scan all active state layers by priority` | Full command outcome должен возвращать blocked result |
| Special rules validator | Ready | `validatePersonalitySpecialRules()`; tests expose deferred/adapter-owned and reject unknown keys | Validator не реализует сами deferred rules; он только делает их видимыми |
| Data-driven gameplay conditions | Missing | Есть только план в docs | Следующий главный этап: `emergentConditions` schema + migration |
| Data-driven action rules | Missing | Нет action rule registry | Нужно после emergent conditions или вместе с command outcome |
| Data-driven passive rules | Missing | Нет passive effect registry | Нужно вынести `computeNaturalPassives()` |
| System/environment influences | Missing/Partial | Registry содержит system/env influences | Generic sync pass не подключен |
| Global balance patch | Partial | `validateBalancePatch()`, `getIntensityMultiplier()`; tests | Нет полноценной telemetry/update pipeline |
| Domain events | Partial | `DomainEvent`, command result events | Events не покрывают все important gameplay changes |
| Backend parity | Missing/Partial | Команды serializable, replay частичный | Backend еще должен использовать тот же full command outcome |
| Simulation reports | Missing | Нет report artifacts | Нужны formation/evolution/shadow/singularity/memory distribution reports |
| Final doc/code audit | Missing | Есть gap analysis | Нужен финальный проход по `PERSONALITY_EVOLUTION_SYSTEM.md` после крупных refactors |

---

## 4. Что точно осталось сделать

| Milestone | Что значит Done | Почему это важно |
|---|---|---|
| M1. Command outcome | `applyPersonalityCommand()` возвращает stats/xp/coins/blocked/appliedModifiers; `mockApi` использует этот результат | Replay/backend/mock считают одно и то же; это главный blocker для замены `mockApi` |
| M2. Split mockApi | Вместо `mockApi` есть LocalSave, SyncQueue, ServerApi и PetService; gameplay logic там не живет | Offline остается, online sync становится нормальным |
| M3. Data-driven emergent states | `computeEmergentState()` больше не содержит personality-specific activation branches для обычных gameplay states | Новый характер/состояние можно добавить через data |
| M4. System influences | `system:*` и `env:*` influences применяются generic sync pass | Registry реально управляет долгосрочным поведением |
| M5. Events/explainability | Важные state/trait/outcome changes создают domain events или memories | Игрок и разработчик понимают, почему характер изменился |
| M6. Simulation reports | Есть отчеты по скорости formation/evolution/shadow/singularity/memories | Баланс доказан, а не угадан |
| M7. Final audit | `PERSONALITY_EVOLUTION_SYSTEM.md` совпадает с кодом или явно помечает deferred | Нет ложных обещаний |

---

## 5. Вопросы, которые нужно было задать раньше

### Вопрос 1. Что считается готовым движком?

Лучший ответ:

> Готовый движок — это не когда все идеи из документа написаны в коде. Готовый движок — когда история действий воспроизводимо меняет характер, backend/mock/replay дают один outcome, новые правила добавляются как data, а важные изменения объяснимы через events/memories.

### Вопрос 2. Что сейчас самый большой блокер?

Лучший ответ:

> Не отдельные баги. Главный блокер — разделение ownership: `PersonalityEngine`, `commandHandlers` и `mockApi` все еще делят gameplay result. Пока stats/XP/coins не принадлежат command outcome, движок не является единым source of truth.

### Вопрос 3. Что можно не делать сейчас?

Лучший ответ:

> Не надо сейчас полировать UI, добавлять новые характеры, новые визуальные эффекты или новые specialRules. Это увеличит поверхность хаоса. Сначала нужно закончить data-driven states и command outcome.

### Вопрос 4. Почему тестов много, а реализации кажется мало?

Лучший ответ:

> Потому что сейчас много работы было cleanup/control. Это не должно продолжаться бесконечно. Дальше тесты должны сопровождать крупные архитектурные переносы: целая пачка условий в registry, целый command outcome, целый sync pass.

### Вопрос 5. Как понять, что следующий этап реально приблизил конец?

Лучший ответ:

> После этапа должно уменьшиться количество hardcoded branches или кода в `mockApi`, а не только добавиться новый helper. Например, после M1 targeted `rg "personality\\.id ==="` в `computeEmergentState()` должен показать резкое снижение или ноль для migrated states.

### Вопрос 6. Какой самый короткий путь к полезному готовому MVP?

Лучший ответ:

> M1 + M2 + minimal events. То есть data-driven states, full command outcome, и события для главных изменений. System influences и simulation можно делать после этого как hardening.

### Вопрос 7. Что надо удалить, если цель — быстрее закончить?

Лучший ответ:

> Deferred `specialRules`, которые не влияют на core loop: `playThirstEnabled`, `newRoomBonusEnabled`, возможно `stoicPeakOnceOnly` как data field, если hardcoded one-shot останется до registry migration. Но удалять надо осознанно: либо убрать из data, либо оставить warning с milestone.

### Вопрос 8. Где конец ближайшего этапа?

Лучший ответ:

> Ближайший конец — M1: command outcome. Done означает: `applyPersonalityCommand()` возвращает stats/XP/coins/blocked/appliedModifiers, а `mockApi` для основных действий использует этот результат вместо собственных расчетов.

### Вопрос 9. Нужно сначала дорабатывать движок или разбирать `mockApi`?

Лучший ответ:

> Сначала дорабатывать движок, но не весь сразу: именно command outcome. Разбирать `mockApi` раньше нельзя, потому что пока нечем заменить расчет результата действия. После command outcome `mockApi` можно безопасно разрезать на LocalSave, SyncQueue, ServerApi и PetService.

---

## 6. Рекомендуемый контроль для владельца проекта

После каждого этапа спрашивать не “что ты сделал?”, а:

1. Какой процент readiness изменился?
2. Какая строка в таблице поменяла статус?
3. Какое доказательство появилось?
4. Какой hardcoded/adapter-owned долг уменьшился?
5. Что теперь можно делать, чего раньше нельзя было?

Если ответ не меняет статус ни одной строки таблицы, значит работа не приблизила движок к готовности.
