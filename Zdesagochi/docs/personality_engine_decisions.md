# Personality Engine Decision Log

> Дата создания: 2026-05-09  
> Назначение: фиксировать не только что было сделано, но и почему было принято именно такое инженерное решение.  
> Перед важными изменениями читать вместе с `docs/personality_engine_progress.md`.

---

## 1. Как пользоваться

Добавлять запись, когда решение:

- меняет архитектуру;
- переносит logic между слоями;
- закрывает gap из `docs/personality_engine_v5_gap_analysis.md`;
- выбирает один вариант из нескольких;
- меняет public contract/types;
- удаляет обещание из docs или реализует его иначе;
- влияет на replay/backend/UI assumptions.

Не добавлять запись для чисто механических правок:

- форматирование;
- переименование без изменения смысла;
- простая правка комментария.

---

## 2. Шаблон решения

```md
## DEC-000N: Short decision title

Status: proposed | accepted | superseded  
Date: YYYY-MM-DD  
Related files: `path`, `path`  
Related roadmap item: P?/Sprint?

### Context

Какая проблема была.

### Decision

Что решили сделать.

### Why

Почему это правильный выбор относительно конечной цели.

### Alternatives

- Option A: accepted/rejected, причина.
- Option B: accepted/rejected, причина.

### Consequences

Что станет лучше, какие tradeoffs остаются.

### Verification

Какие тесты/команды/поисковые проверки должны подтвердить решение.

### Next

Какой следующий шаг вытекает из решения.
```

---

## 3. Accepted Decisions

## DEC-0001: Use progress log as mandatory control entrypoint

Status: accepted  
Date: 2026-05-09  
Related files: `docs/personality_engine_progress.md`, `docs/personality_engine_coding_rules.md`, `docs/personality_engine_next_steps.md`  
Related roadmap item: Process control

### Context

Кода стало много, а контроль был размазан между roadmap, audit и handoff. Было трудно быстро понять:

- что уже сделано;
- почему это было нужно;
- чем это помогло конечной цели;
- что проверено;
- почему следующий шаг именно такой.

### Decision

Сделать `docs/personality_engine_progress.md` обязательным первым файлом для любой задачи по personality engine.

### Why

Это создает единый контрольный контур:

> goal -> current step -> why -> implementation -> verification -> impact -> next step.

Без такого контура refactor легко превращается в добавление кода без доказанного движения к цели.

### Alternatives

- Только `next_steps.md`: rejected, потому что roadmap показывает план, но не фиксирует фактический прогресс и вектор после каждого шага.
- Только финальные сообщения в чате: rejected, потому что история теряется между сессиями.
- Только git diff: rejected, потому что diff показывает что изменилось, но не объясняет почему.

### Consequences

Плюсы:

- каждый шаг должен иметь причину, impact и next step;
- проще продолжать работу между сессиями;
- проще заметить отклонение от вектора.

Tradeoff:

- каждый meaningful step требует обновлять progress file.

### Verification

- `docs/personality_engine_progress.md` существует;
- `docs/personality_engine_coding_rules.md` требует читать progress file первым;
- `docs/personality_engine_next_steps.md` ссылается на progress file.

### Next

Усилить progress file обязательными блоками Last Completed Step, Control Dashboard, Required Closeout.

---

## DEC-0002: Add decision log for architectural choices

Status: accepted  
Date: 2026-05-09  
Related files: `docs/personality_engine_decisions.md`, `docs/personality_engine_progress.md`  
Related roadmap item: Process control

### Context

Progress log отвечает "где мы сейчас", но не должен становиться длинной историей всех архитектурных компромиссов.

Для профессионального контроля нужен отдельный файл, который отвечает:

- почему выбран конкретный путь;
- какие альтернативы отклонены;
- какие последствия приняты;
- какие проверки доказывают решение.

### Decision

Создать `docs/personality_engine_decisions.md` как ADR-lite decision log.

### Why

Это предотвращает повторные споры и возвраты к уже отклоненным подходам. Также помогает понять, почему код устроен именно так, когда контекст переписки потерян.

### Alternatives

- Хранить решения в `progress.md`: rejected, progress должен оставаться оперативным и коротким.
- Хранить решения только в comments: rejected, comments не показывают alternatives/consequences.
- Хранить решения только в commit messages: rejected, они неудобны как рабочий документ между задачами.

### Consequences

Плюсы:

- каждое важное решение получает контекст;
- проще проводить review;
- легче видеть, когда новое изменение противоречит старому решению.

Tradeoff:

- architectural tasks требуют обновлять еще один файл.

### Verification

- decision log создан;
- progress/coding rules ссылаются на decision log;
- future architecture changes добавляют DEC entries.

### Next

Начать Sprint 1 cleanup и фиксировать решения, если cleanup выбирает между несколькими вариантами поведения.

---

## DEC-0003: Command outcome blocks mockApi replacement and offline sync

Status: accepted  
Date: 2026-05-10  
Related files: `src/personality/commandHandlers.ts`, `src/personality/commands.ts`, `src/api/mockApi.ts`, `docs/personality_engine_function_readiness.md`, `docs/personality_engine_progress.md`  
Related roadmap item: M2 / P3 Command outcome

### Context

`mockApi` сейчас одновременно:

- хранит локальное состояние;
- считает stats/XP/coins;
- применяет часть gameplay/special cases;
- вызывает personality command layer;
- имитирует будущий backend.

Пока `applyPersonalityCommand()` не возвращает полный результат действия, `mockApi` нельзя честно убрать: иначе offline, replay и будущий backend будут считать результат действия разными способами.

### Decision

Следующий главный этап после Sprint 1 cleanup — **Command outcome first**.

До замены `mockApi` нужно расширить `PetCommandResult`, чтобы каждая команда возвращала:

- `statDeltas`;
- `xpDelta`;
- `coinDelta`;
- `blockedAction`;
- `appliedModifiers`;
- domain events;
- новый pet snapshot.

Только после этого `mockApi` можно разрезать на `PetService`, `LocalSave`, `SyncQueue` и `ServerApi`.

### Why

Offline-first игра требует одного источника правды:

```text
player action -> command engine -> local save -> sync queue -> backend
```

Если gameplay outcome останется в `mockApi`, backend придется копировать клиентскую логику, а replay не сможет доказуемо восстановить то же состояние.

### Alternatives

- Сначала делать data-driven emergent states: partially rejected as immediate priority. Это важно для добавления новых характеров, но не разблокирует удаление `mockApi`.
- Сразу удалять `mockApi`: rejected. Нечем заменить расчет stats/XP/coins, offline behavior сломается или разойдется с backend.
- Оставить `mockApi` навсегда: rejected. Тогда не будет единого backend/mock/replay outcome.

### Consequences

Плюсы:

- появляется понятный путь к offline + sync;
- `mockApi` перестает быть местом игровой логики;
- backend сможет принимать команды и проверять тот же результат;
- replay станет ближе к полному восстановлению gameplay.

Tradeoff:

- data-driven states временно отодвигаются после command outcome или идут только как второй крупный этап.

### Verification

- `PetCommandResult` содержит full gameplay outcome;
- `mockApi` для основных действий использует command result, а не считает stats/XP/coins сам;
- tests доказывают одинаковый outcome для command/replay/mock path;
- targeted check показывает уменьшение gameplay calculators в `src/api/mockApi.ts`.

### Next

Начать M2/P3: расширить `PetCommandResult` и перенести base action result calculation из `mockApi` в command/gameplay layer.
