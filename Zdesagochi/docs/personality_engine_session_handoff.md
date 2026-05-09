# Personality Engine — handoff для следующей сессии

> Дата фиксации: 2026-05-08  
> Цель документа: быстро продолжить работу над движком характера без чтения всей переписки.

---

## 1. Где читать актуальный план

Основной roadmap:

- `docs/personality_engine_next_steps.md`

Исторический аудит и fix log:

- `docs/personality_engine_audit.md`

Спецификация системы:

- `PERSONALITY_EVOLUTION_SYSTEM.md`

---

## 2. Что уже сделано в этой серии работ

### P0 из аудита закрыт

Закрыты дефекты:

- `enlightenmentActive` выставляется при входе в `enlightenment`.
- `stoicPeakUsed` выставляется при входе в `stoic_peak`.
- `allStatsAbove` учитывается для `perfect_balance`.
- `feast_frenzy` считает 3 кормления за последний час.
- `shadow_form` и `identity_crisis` разведены по priority.
- Сортировка emergent state candidates получила deterministic tie-breaker.

Ключевые файлы:

- `src/personality/PersonalityEngine.ts`
- `src/personality/emergentStates.ts`
- `src/personality/patternRules.ts`
- `src/personality/types.ts`
- `tests/personalityEvolution.test.ts`

### CRIT-1 почти закрыт

`applyPersonalityCommand()` теперь является основным доменным orchestrator для personality logic:

- counters;
- pattern flags;
- mood;
- mood history на `sync`;
- decay/passives на `sync`;
- gameplay emergent state через `stateLayers`;
- trait influence/evolution/sleep/confused logic.

`mockApi` переведен на thin-wrapper подход для основных команд:

- `feed`
- `play`
- `sleep`
- `wake`
- `bathe`
- `heal`
- `bond`
- `sync`
- `use_item`
- `equip_room`
- `accept_evolution`
- `reject_evolution`

Ключевые файлы:

- `src/personality/commandHandlers.ts`
- `src/api/mockApi.ts`
- `tests/personalityEvolution.test.ts`
- `docs/personality_engine_audit.md`

### QuotaExceededError исправлен

Причина:

- offline save писал полный pet snapshot + весь `commandLog` в `localStorage` без ограничения.

Что сделано:

- `offlineCommandLog` ограничен последними 250 командами.
- При `QuotaExceededError` сохраняется компактный вариант с последними 50 командами.
- Добавлен safe storage API `trySaveOfflinePetSave()`.
- Добавлены тесты на compact command log и quota-safe save.

Ключевые файлы:

- `src/api/mockApi.ts`
- `src/personality/offlineStorage.ts`
- `tests/personalityEvolution.test.ts`

---

## 3. Проверки, которые прошли

Последние проверки:

```bash
npm test
npm run build
```

Обе команды проходили успешно.

Известный warning:

- Vite предупреждает о chunk > 500 kB.
- Это не связано с personality engine и не блокирует сборку.

---

## 4. Важное текущее состояние git/worktree

В рабочей копии есть много незакоммиченных изменений, часть из них относится к personality engine, часть — к room/editor UI и могла быть сделана не в рамках personality-задачи.

Перед следующими правками обязательно:

```bash
git status --short
git diff -- src/personality src/api/mockApi.ts tests/personalityEvolution.test.ts docs
```

Не откатывать чужие изменения.

Файлы personality-направления, которые точно важны для продолжения:

- `docs/personality_engine_audit.md`
- `docs/personality_engine_next_steps.md`
- `docs/personality_engine_session_handoff.md`
- `src/api/mockApi.ts`
- `src/personality/PersonalityEngine.ts`
- `src/personality/commandHandlers.ts`
- `src/personality/emergentStates.ts`
- `src/personality/offlineStorage.ts`
- `src/personality/patternRules.ts`
- `src/personality/types.ts`
- `tests/personalityEvolution.test.ts`

---

## 5. Что осталось сделать следующим

Следующая правильная задача:

**Закрыть остаток CRIT-1: item-as-food semantics и убрать `applyPetInfluence()` из `mockApi`.**

Контекст:

- `mockApi` почти полностью переведен на `applyPersonalityCommand`.
- Но в `useInventoryItem()` еще есть fallback:
  - если item не имеет `item:${itemId}` influence;
  - и item является food;
  - `mockApi` вручную вызывает `applyPetInfluence('action:feed')`.

Почему это нужно убрать:

- `mockApi` не должен напрямую вызывать `applyInfluence()`.
- Иначе adapter layer снова содержит часть personality-domain logic.

Минимальный план:

1. Расширить `PetCommand` для `use_item`.
   - Добавить metadata, например `itemKind?: 'food' | 'toy' | 'medicine' | 'decoration'`.
   - Или передавать fallback influence id через command context/options.

2. Обновить `getInfluenceIdForCommand()` в `commandHandlers.ts`.
   - Если есть `item:${itemId}` influence — использовать его.
   - Если item food-like и собственного influence нет — использовать `action:feed`.
   - Не применять оба одновременно без явного правила.

3. Удалить `applyPetInfluence()` из `mockApi`.

4. Добавить regression tests:
   - food item без `item:*` influence применяет `action:feed` один раз;
   - item с `item:*` influence не получает дополнительный `action:feed`;
   - `MockApi.useInventoryItem()` пишет `use_item` в offline command log;
   - `MockApi.getPet()` не мутирует `lastUpdated`, counters, flags, state.

Критерий готовности:

```bash
rg "applyPetInfluence|applyInfluence|canApplyInfluenceAtSync|checkThresholdCrossings" src/api/mockApi.ts
```

В идеале не должно остаться прямых вызовов personality influence internals в `mockApi`.

---

## 6. После CRIT-1

Полный roadmap лежит в `docs/personality_engine_next_steps.md`. Короткая карта оставшихся блоков:

| Приоритет | Блок | Суть |
|---|---|---|
| P1 | Finish CRIT-1 | item-as-food semantics, убрать `applyPetInfluence()` из `mockApi`, добавить regression tests |
| P2 | Data-driven gameplay conditions | убрать hardcoded `personality.id === ...` из `PersonalityEngine`, перенести условия/effects в data registry |
| P3 | Cleanup / dead code | убрать `anxiousMult`, melancholic XP noop, решить `perfect_balance`, `newRoomBonusEnabled`, `random/rng` |
| P4 | State layers source of truth | сделать `stateLayers` публичной моделью active states, оставить `emergentState` только legacy projection |
| P5 | Event history | durable domain/personality events для объяснимости и будущего обучения |
| P6 | CoreMemory features | `sourceEventIds`, `features`, `cause/effect`, hash/grouping для causal learning |
| P7 | State trait effects | emergent states должны оставлять след в trait vector через capped deltas |
| P8 | Legacy economy bonuses | подключить `EVOLUTION_LEGACY` XP/coin/uniqueTrait бонусы к gameplay/economy |
| P9 | Simulation / balance | simulation reports для скорости formation/evolution/shadow/recovery |
| P10 | Backend / LiveOps | backend replay, remote influence registry, GlobalBalancePatch, runtime validation |

Следующий крупный блок после закрытия item fallback:

### Cleanup before data-driven refactor

1. Удалить `anxiousMult` noop.
2. Убрать melancholic `result.xp = result.xp` noop.
3. Решить `perfect_balance` mismatch:
   - либо только XP multiplier;
   - либо реальный passive stat bonus.
4. Реализовать или удалить `newRoomBonusEnabled`.
5. Убрать дублирование `random` / `rng` в `TraitEvolutionContext`.

### Потом CRIT-2

Цель:

- убрать hardcoded `personality.id === ...` из `PersonalityEngine`;
- перенести gameplay conditions/effects в data registry;
- сделать добавление 17-го характера возможным без правки engine.

---

## 7. Последняя известная причина QuotaExceededError

Если ошибка снова появится в браузере:

1. Проверить размер ключа:
   - `zdesagochi:offline-pet-save:v1`

2. Проверить, не раздулись ли другие ключи:
   - `roomPresets`
   - `petPresets`
   - `placedFurniture`
   - `pet_appearance_debug`

3. Если у пользователя уже лежит старый раздутый save, можно один раз очистить:
   - `zdesagochi:offline-pet-save:v1`

После текущего фикса новый offline save не должен бесконечно расти за счет command log.
