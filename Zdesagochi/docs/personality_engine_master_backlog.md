# Personality Engine MVP Backlog

> Дата: 2026-05-10  
> Назначение: короткий рабочий backlog, который ведет к минимально готовому движку, а не к бесконечной разработке.  
> Правило: если задача не двигает MVP ниже, ее не делать сейчас.

---

## 1. MVP цель

Минимально готовый движок характера готов, когда:

1. Игрок нажимает `feed/play/bathe/heal/bond/sleep/wake/use_item`.
2. Один движок считает весь результат действия:
   - stats;
   - XP;
   - coins;
   - blocked action;
   - personality/flag/state modifiers;
   - trait/personality changes;
   - active states;
   - events.
3. Игра работает offline.
4. Offline действия сохраняются в очередь.
5. Когда интернет появляется, эти команды можно отправить на сервер.
6. `mockApi` больше не является местом игровой логики.
7. `npm test` и `npm run build` проходят.

Все остальное до этого момента — вторично.

---

## 2. Что делать прямо сейчас

### MVP-1. Full Command Outcome

**Цель:** `applyPersonalityCommand()` должен возвращать полный результат действия.

Сейчас проблема:

```text
часть результата считает command layer
часть результата считает PersonalityEngine
часть результата считает mockApi
```

Должно стать:

```text
UI action -> applyPersonalityCommand() -> полный результат
```

Задачи:

| ID | Задача | Статус | Done when |
|---|---|---|---|
| MVP-1.1 | Расширить `PetCommandResult` | Done | Есть `statDeltas`, `xpDelta`, `coinDelta`, `blockedAction`, `appliedModifiers`, `events`, `pet` |
| MVP-1.2 | Перенести `play` outcome из `mockApi` | Done | `playWithPet()` не считает stats/XP/coins сам |
| MVP-1.3 | Перенести `feed` outcome из `mockApi` | Done | `feedPet()` не считает stats/XP/coins сам |
| MVP-1.4 | Перенести `bathe/heal/bond` outcome | Done | Эти методы используют command result |
| MVP-1.5 | Перенести `sleep/wake` outcome | Done | blocked sleep и wake effects считаются command layer |
| MVP-1.6 | Перенести `use_item` outcome | Done | item result проходит через command result |
| MVP-1.7 | Replay full outcome | Done | replay команды дает тот же core result, что обычный command path |

Что не делать в MVP-1:

- не проектировать большой registry;
- не переписывать UI;
- не добавлять новые состояния;
- не делать server API;
- не делать simulation reports.

Проверка MVP-1:

```bash
npm test
npm run build
rg "baseResult|modified = applyActionModifiers|xpEveryOtherAction|rejectSleepWhenEnergized|getPeakPerformanceMult" src/api/mockApi.ts
```

Ожидание:

- в `mockApi` больше нет расчетов gameplay outcome для основных pet actions;
- `mockApi` только вызывает command result и сохраняет состояние.

### MVP-1 Development Plan For Approval

Этот план нужно утвердить перед реализацией.

#### Главный принцип

Не переписывать всё сразу. Сначала сделать один рабочий эталон на `play`, доказать тестом, потом повторить тот же шаблон для остальных действий.

#### Что будет считаться результатом команды

`applyPersonalityCommand()` должен вернуть:

| Поле | Зачем |
|---|---|
| `pet` | готовый новый snapshot питомца |
| `statDeltas` | что изменилось в stats именно этой командой |
| `xpDelta` | сколько XP дала команда |
| `coinDelta` | сколько coins дала команда |
| `blockedAction` | почему команда не выполнена, если ее заблокировало состояние/правило |
| `appliedModifiers` | какие modifiers повлияли на результат |
| `events` | объяснение результата |

#### Этап 1. Контракт без переноса логики

Files:

- `src/personality/commands.ts`
- `src/personality/commandHandlers.ts`
- `tests/personalityEvolution.test.ts`

Tasks:

1. Добавить поля в `PetCommandResult`.
2. Для команд, которые еще не перенесены, возвращать neutral outcome:
   - `statDeltas: {}`
   - `xpDelta: 0`
   - `coinDelta: 0`
   - `blockedAction: null`
   - `appliedModifiers: []`
3. Добавить тест на shape результата.

Done when:

- TypeScript компилируется.
- Все существующие тесты проходят.
- Есть тест, что command result всегда имеет full outcome fields.

#### Этап 2. Перенести `play` как эталон

Почему `play` первым:

- оно самое показательное;
- там есть stats, XP, coins, score, modifiers;
- там сейчас сидят `xpEveryOtherAction` и `peakPerformanceThreshold`;
- если `play` перенесен правильно, остальные действия проще.

Files:

- `src/personality/commandHandlers.ts`
- `src/personality/PersonalityEngine.ts` if helper needed
- `src/api/mockApi.ts`
- `tests/personalityEvolution.test.ts`

Current `mockApi.playWithPet()` делает:

1. Проверяет sleep/energy.
2. Проверяет blocked state.
3. Генерирует score.
4. Считает base XP/coins.
5. Создает base stats.
6. Вызывает `applyActionModifiers()`.
7. Применяет `peakPerformanceThreshold`.
8. Применяет `xpEveryOtherAction`.
9. Меняет stats.
10. Начисляет XP/coins.
11. Потом вызывает `applyMockPersonalityCommand()`.

Должно стать:

1. `mockApi.playWithPet()` делает только UI/application checks that are not gameplay outcome, score generation and achievements/events shell.
2. Создает command `play`.
3. Вызывает `applyPersonalityCommand()`.
4. Берет из result:
   - updated pet;
   - `xpDelta`;
   - `coinDelta`;
   - `statDeltas`;
   - `blockedAction`.
5. `mockApi` больше не считает `baseResult`, `modified`, `peak`, `xpEveryOtherAction`.

Tests:

- command `play` returns stat/xp/coin outcome;
- blocked play returns `blockedAction` or throws through adapter consistently;
- melancholic `xpEveryOtherAction` handled in command outcome;
- anxious `peakPerformanceThreshold` handled in command outcome;
- `mockApi.playWithPet()` uses command result and still returns `PlayResult`.

Done when:

- `rg "xpEveryOtherAction|getPeakPerformanceMult|baseResult|modified = applyActionModifiers" src/api/mockApi.ts` no longer finds `play` outcome logic.
- `npm test` passes.
- `npm run build` passes.

#### Этап 3. Перенести `feed`

Why second:

- feed uses food data;
- feed has item/food semantics;
- feed has paranoid restore multiplier.

Tasks:

1. Move base feed stat/xp outcome into command layer.
2. Move blocked feed handling into command result.
3. Move paranoid restore multiplier out of `mockApi`.
4. Keep inventory/food lookup in adapter until item repository exists.

Tests:

- feed command returns hunger/happiness/health deltas;
- food preferences still work;
- paranoid restore multiplier still works;
- `mockApi.feedPet()` no longer computes modified result.

#### Этап 4. Перенести `bathe/heal/bond`

Why grouped:

- all are direct stat restore actions;
- no score;
- no coins currently;
- good batch after play/feed pattern is proven.

Tasks:

1. Move base outcomes.
2. Move blocked action checks.
3. Move feral bath penalty.
4. Move paranoid heal refusal into blocked action.
5. Keep achievements/quests/events shell in `mockApi`.

Tests:

- bathe outcome;
- heal outcome and paranoid block/refusal;
- bond outcome;
- catharsis side effects still happen or are explicitly handled.

#### Этап 5. Перенести `sleep/wake`

Why later:

- sleep/wake has lifecycle interactions;
- early wake trauma already touches evolution engine;
- sleep blocked rules must be represented cleanly.

Tasks:

1. Move `rejectSleepWhenEnergized` to command blocked result.
2. Move sleep start/wake result ownership into command layer.
3. Keep adapter event display only.
4. Ensure `sleep_started` and `sleep_finished` events remain.

Tests:

- bold cannot sleep when energized through command result;
- natural wake vs early wake still works;
- confused reset still requires 4 hours.

#### Этап 6. Перенести `use_item`

Why last:

- item effects depend on inventory/shop adapter data;
- command layer already has influence semantics;
- gameplay outcome must integrate with item kind.

Tasks:

1. Define how item result enters command outcome.
2. Keep inventory decrement in adapter/service.
3. Command returns stat/xp/coin effects from item use.
4. Preserve existing food fallback/item precedence behavior.

Tests:

- food item fallback still works;
- item influence precedence still works;
- inventory item use returns command outcome.

#### Этап 7. Replay full outcome

Tasks:

1. Ensure replay stores `commandResults` with full outcome fields.
2. Add test: normal command path and replay path produce same core result.
3. Confirm offline command log can rebuild core gameplay result.

Done when:

- replay is no longer only personality-side for MVP actions.

#### MVP-1 Stop Conditions

MVP-1 is done only when:

1. `feed/play/bathe/heal/bond/sleep/wake/use_item` return full command outcome.
2. `mockApi` does not calculate gameplay outcome for those actions.
3. Adapter-owned specialRules are moved to engine or explicitly removed from MVP scope.
4. Replay can reproduce core outcome.
5. `npm test` passes.
6. `npm run build` passes.

#### What I will not do during MVP-1

- no new personalities;
- no UI polish;
- no large data-driven registry;
- no backend implementation;
- no simulation reports;
- no new shop/quest mechanics.

---

### MVP-2. Offline Shell Without Gameplay Logic

**Цель:** заменить роль `mockApi` как псевдо-сервера на простые offline слои.

MVP-1 закрыт. Теперь можно делать:

```text
PetService
LocalSave
SyncQueue
ServerApi interface
```

Задачи:

| ID | Задача | Done when |
|---|---|---|
| MVP-2.1 | Создать `PetService` | UI action идет через service, service вызывает command engine |
| MVP-2.2 | Создать `LocalSave` | pet/account/inventory сохраняются локально без gameplay logic |
| MVP-2.3 | Создать `SyncQueue` | pending commands переживают reload и не применяются дважды |
| MVP-2.4 | Создать `ServerApi` contract | описано, что клиент отправляет commands, не snapshot |
| MVP-2.5 | Свести `mockApi` к compatibility wrapper | `mockApi` можно заменить или удалить без потери правил игры |

Что не делать в MVP-2:

- не строить настоящий backend, если его еще нет;
- не делать conflict UI;
- не делать сложный multi-device merge;
- не переносить shop/quests, если это блокирует pet core.

Проверка MVP-2:

```text
offline:
  action -> command result -> local save -> pending command

online later:
  pending command -> ServerApi contract
```

---

### MVP-3. Minimum Explainability

**Цель:** игрок и разработчик понимают, почему действие изменило питомца.

Минимально нужно не полное event-history, а события для результата команды.

Задачи:

| ID | Задача | Done when |
|---|---|---|
| MVP-3.1 | Events for command outcome | У команды есть events про stats/XP/coins/state/trait changes |
| MVP-3.2 | Events saved with offline command/result | Offline история объяснима |
| MVP-3.3 | Basic selector for UI/debug | Можно показать “почему это произошло” |

Что не делать в MVP-3:

- не строить сложную аналитику;
- не делать AI memory generation;
- не делать красивый UI объяснений.

---

## 3. Что отложить до после MVP

Эти задачи важны, но сейчас растягивают разработку.

| Задача | Почему отложить |
|---|---|
| Data-driven emergent states | Не блокирует offline/sync и удаление `mockApi`; делать после command outcome |
| Data-driven action/passive/decay/mood rules | Большой refactor; сначала нужен единый command result |
| System/environment influences | Нужны, но не мешают базовому игровому циклу |
| Full simulation reports | Нужны перед баланс-релизом, но не перед первым usable MVP |
| Full UI polish | Без working engine UI будет красить незавершенную механику |
| New personalities/states | Увеличивают объем, пока core loop не готов |
| Real backend implementation | Сначала нужен client/server command contract |
| Complex conflict resolution | Делать после простого sync queue |

---

## 4. Что удалить или не трогать до MVP

Не тратить время сейчас:

| Вещь | Решение до MVP |
|---|---|
| `playThirstEnabled` | Не реализовывать сейчас; оставить warning или удалить позже |
| `newRoomBonusEnabled` | Не реализовывать сейчас |
| `stoicPeakOnceOnly` как data field | Не трогать до data-driven pass |
| `untrustedPhaseDays` | Не трогать до paranoid data-driven pass |
| `trustThresholdBonds` | Не трогать до paranoid data-driven pass |
| New visual effects | Не делать |
| New shop/quest mechanics | Не делать |
| Big docs rewrites | Не делать, кроме короткого progress/readiness update |

---

## 5. Конец MVP

MVP считается готовым, когда выполнено:

| Проверка | Ожидаемый результат |
|---|---|
| `feed/play/bathe/heal/bond/sleep/wake/use_item` | Все проходят через `applyPersonalityCommand()` и получают full command result |
| `mockApi` | Не считает gameplay result, только сохраняет/вызывает service |
| Offline | Можно играть без интернета, snapshot и pending commands сохраняются |
| Sync contract | Есть понятный contract: клиент отправляет commands, сервер подтверждает snapshot |
| Replay | Command replay восстанавливает core gameplay outcome |
| Events | Команда объясняет основные изменения |
| Tests | `npm test` проходит |
| Build | `npm run build` проходит |

После этого можно честно сказать:

> Движок минимально готов к использованию offline-first. Остальные работы — улучшение архитектуры, расширение правил и баланс.

---

## 6. Как контролировать работу

После каждого крупного шага отвечать только на эти вопросы:

1. Какая MVP-задача закрыта?
2. Какой метод `mockApi` стал тоньше или перестал считать gameplay?
3. Что теперь считает `applyPersonalityCommand()`, чего раньше не считал?
4. Какой тест доказывает это?
5. Что осталось до конца MVP?

Если ответ не закрывает MVP-строку, значит задача не должна была выполняться сейчас.

---

## 7. Immediate Next Work

Делать именно это:

1. `MVP-2.1` — создать `PetService`, который вызывает `applyPersonalityCommand()` и возвращает command result.
2. `MVP-2.2` — выделить `LocalSave` для pet/account/inventory без gameplay logic.
3. `MVP-2.3` — выделить `SyncQueue` для pending commands.
4. `MVP-2.4` — описать `ServerApi` contract: клиент отправляет commands, не вручную измененный snapshot.
5. `MVP-2.5` — свести `mockApi` к compatibility wrapper или заменить его service calls.

Не начинать `data-driven states`, пока UI/action flow не переведен на offline-first service layers.
