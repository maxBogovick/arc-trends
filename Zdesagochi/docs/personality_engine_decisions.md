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

