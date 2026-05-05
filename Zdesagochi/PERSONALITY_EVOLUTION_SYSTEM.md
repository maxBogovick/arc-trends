# ZDESAGOCHI — Система эволюции характера
## Технический дизайн-документ v5.0

> **Изменения v5.0 относительно v4.0:**
> Sleeping Beauty Exploit fix — сброс variance только после ≥4ч непрерывного сна;
> Ghost Memories fix — visitedZones: rare Threshold Crossing строго раз за жизнь питомца;
> Tiny AI Integration — MemoryTextGenerator интерфейс с template/AI реализациями;
> Singularity State — emergent state priority=0 при пересечении 3+ зон одновременно;
> Global Balance Telemetry — GlobalBalancePatch вместо прямого патча traitDeltas.

---

## 0. Философия и принципы

### Проблема которую решаем

Текущий характер питомца — статичная метка. `pet.personality = 'playful'` не меняется сколько бы ты ни занимался питомцем. Поведенческие флаги модифицируют числа, но не личность. Это нереалистично: в реальной жизни характер формируется опытом.

### Что строим

**Пространство черт** (Trait Space) — шестимерное числовое пространство 0–100. Каждый из 16 характеров занимает определённую область. Все действия, предметы, события, социальные контакты — векторы, толкающие питомца по этому пространству. Когда питомец достаточно долго и устойчиво находится в зоне другого характера — происходит эволюция.

### Семь принципов

**1. Data-driven до конца.**
Новая функция = добавить запись в реестр. Движок не трогать.

**2. Gradual, не instant.**
Характер меняется за дни, не за минуты. Только устойчивый паттерн. Единственное исключение — Singularity.

**3. Прозрачный через нарратив, не через числа.**
Игрок видит Core Memories — нарративные карточки. Числа спрятаны, смысл открыт. Нарратив генерируется шаблонами или on-device AI.

**4. Reversible и irreversible по редкости.**
Common/Rare — обратимо. Epic/Legendary — оставляют след в `evolutionLegacy` и `account.legacyVector`.

**5. Возраст = устойчивость.**
Чем дольше питомец живёт с одним характером, тем сложнее его изменить.

**6. Жёсткость создаёт напряжение, не безнадёжность.**
Трудные состояния имеют выход, который ощущается как победа. Catharsis — квест, не цикл фарма.

**7. Живой мир реагирует на время и на сообщество.**
Сезонные события меняют мир без апдейта приложения. Глобальная статистика игроков тихо балансирует мету.

---

## 1. Шесть измерений пространства черт

### `vitality` — 0 = летаргичный / 100 = гиперактивный
Высокий: Игривый, Дерзкий, Дикий, Авантюрист. Низкий: Сонливый, Стоик, Дзен.

### `sociality` — 0 = одиночка / 100 = социальный
Высокий: Эмпат, Дзен. Низкий: Дикий, Параноик (нач.), Хаотик.

### `order` — 0 = хаотичный / 100 = дисциплинированный
Высокий: Стоик, Дзен, Чистюля. Низкий: Хаотик, Дикий, Игривый.

### `appetite` — 0 = безразличный / 100 = сосредоточен на ресурсах
Высокий: Гурман, Жадный. Низкий: Дзен, Стоик, Мудрый.

### `caution` — 0 = смелый/безрассудный / 100 = тревожный/осторожный
Высокий: Нервный, Параноик. Низкий: Дерзкий, Дикий, Авантюрист.

### `curiosity` — 0 = закрытый / 100 = исследователь
Высокий: Мудрый, Авантюрист, Хаотик. Низкий: Сонливый, Стоик.

---

## 2. Позиции характеров в пространстве черт

```
Характер       vitality  sociality  order  appetite  caution  curiosity   radius_base
─────────────────────────────────────────────────────────────────────────────────────
playful            90        60       20       40        20       60          25
drowsy             10        40       55       35        40       15          25
foodie             55        50       50       95        30       45          25
bold               80        40       35       45         5       55          22
zen                30        75       85       30        25       45          22
anxious            60        50       40       55        90       50          22
feral              75        10       15       60        15       55          20
sage               35        65       70       40        45       90          22
pristine           50        55       80       40        65       40          22
empath             45        95       55       40        55       50          20
greedy             70        30       55       85        35       60          20
melancholic        20        55       60       35        60       65          22
chaotic            70        40        5       50        20       80          20
stoic              15        35       95       20        30       20          22
adventurer         75        55       25       45        10       95          20
paranoid           40        20       65       35        95       55          18
```

### Динамический радиус (по возрасту)

```typescript
function getDynamicRadius(personality: PersonalityDefinition, ageHours: number): number {
  const base = PERSONALITY_TRAIT_MAP[personality.id].radiusBase;
  const ageDays = ageHours / 24;
  if (ageDays < 7)  return base - 3;
  if (ageDays < 30) return base;
  if (ageDays < 90) return base + 4;
  return                base + 8;
}
```

---

## 3. Математика движка

### 3.1 Что хранится в Pet

```typescript
// Пространство черт
traitVector:           TraitVector;
dailyTraitBudget:      Partial<Record<TraitKey, number>>;

// O(1)-счётчики эволюции
currentTargetZone:     PersonalityId | null;
ticksInTargetZone:     number;
voidSyncs:             number;

// UI-снапшоты
dailyTraitSnapshots:   Array<{ date: string; vector: TraitVector }>;

// Core Memories
coreMemories:          CoreMemory[];
lastMemoryTimestamp:   Partial<Record<`${TraitKey}_${'up'|'down'}`, string>>;
visitedZones:          PersonalityId[];      // зоны, получившие rare Threshold Crossing memory

// Эволюция
evolutionProposal?:    EvolutionProposal;
evolutionHistory:      EvolutionRecord[];

// Формирование
formationComplete:     boolean;
formationProgress:     number;              // 0–200

// Trauma / Catharsis
traumaLevel:           number;
catharsisProgress:     number;
catharsisAchieved:     boolean;
traumaCooldownUntil:   string | null;

// Когнитивный диссонанс
dailyVectorVariance:   number;
confusedState:         boolean;
sleepStartedAt:        string | null;       // когда начался текущий сон
lastSleepTimestamp:    string | null;       // когда завершился последний полный сон

// Singularity
ticksInSingularity:    number;
singularityZones:      PersonalityId[];     // 3 зоны активной точки сингулярности
```

### 3.2 Формула применения влияния

```
raw_delta      = influence.traitDeltas[key] × computedIntensity(influence, pet, ctx)
                 × (globalPatch[influence.id]?.intensityMultiplier ?? 1.0)   ← балансировка меты

remaining      = DAILY_BUDGET[key] - (dailyTraitBudget[key] ?? 0)
budgeted_delta = clamp(raw_delta, -remaining, +remaining)
dailyTraitBudget[key] += abs(budgeted_delta)

SMOOTHING_ALPHA = 0.08
pet.traitVector[key] = clamp(
  pet.traitVector[key] + budgeted_delta × SMOOTHING_ALPHA,
  0, 100
)
```

**Суточные лимиты (DAILY_BUDGET):**
```
vitality:   ±12    sociality:  ±8     order:     ±6
appetite:   ±10    caution:    ±8     curiosity: ±10
```

После применения:
```typescript
const posSum = TRAIT_KEYS.reduce((s, k) => s + Math.max(0, budgetedDelta[k] ?? 0), 0);
const negSum = TRAIT_KEYS.reduce((s, k) => s + Math.abs(Math.min(0, budgetedDelta[k] ?? 0)), 0);
pet.dailyVectorVariance += posSum + negSum;
```

### 3.3 Регрессия к "дому"

```typescript
const REGRESSION_RATE = 0.02;
for (const key of TRAIT_KEYS) {
  const home = PERSONALITY_TRAIT_MAP[pet.personality].position[key];
  pet.traitVector[key] += (home - pet.traitVector[key]) * REGRESSION_RATE;
}
```

### 3.4 Метрика погружения (depth-of-immersion)

```typescript
function depthOfImmersion(vector: TraitVector, personalityId: PersonalityId, ageHours: number): number {
  const home     = PERSONALITY_TRAIT_MAP[personalityId];
  const radius   = getDynamicRadius(home, ageHours);
  const distance = euclideanDistance(vector, home.position);
  return (radius - distance) / radius;
}

function euclideanDistance(a: TraitVector, b: TraitVector): number {
  return Math.sqrt(TRAIT_KEYS.reduce((sum, k) => sum + (a[k] - b[k]) ** 2, 0) / TRAIT_KEYS.length);
}
```

### 3.5 Алгоритм проверки эволюции

```typescript
function checkEvolution(pet: Pet): void {
  // Singularity перехватывает логику если активна
  if (checkSingularity(pet)) return;

  const currentDepth = depthOfImmersion(pet.traitVector, pet.personality, pet.ageHours);

  if (currentDepth > 0) {
    pet.currentTargetZone = null;
    pet.ticksInTargetZone = 0;
    pet.evolutionProposal = undefined;
    return;
  }

  const best = PERSONALITIES
    .filter(p => p.id !== pet.personality)
    .map(p => ({ id: p.id, depth: depthOfImmersion(pet.traitVector, p.id, pet.ageHours) }))
    .reduce((a, b) => (a.depth > b.depth ? a : b));

  if (best.depth <= 0) { handleVoidState(pet); return; }

  if (pet.currentTargetZone !== best.id) {
    pet.currentTargetZone = best.id;
    pet.ticksInTargetZone = 0;
  }
  pet.ticksInTargetZone++;

  const HYSTERESIS = 8;
  const currentDepthAbs = Math.abs(currentDepth) *
    getDynamicRadius(PERSONALITY_TRAIT_MAP[pet.personality], pet.ageHours);
  if (currentDepthAbs < HYSTERESIS) return;

  const STABILITY_SYNCS = 72;
  if (pet.ticksInTargetZone < STABILITY_SYNCS) return;

  pet.evolutionProposal = {
    targetPersonalityId: best.id as PersonalityId,
    readiness: Math.min(100, Math.round((pet.ticksInTargetZone / STABILITY_SYNCS) * 100)),
    depth: best.depth,
    proposedAt: new Date().toISOString(),
    coreMemoryIds: selectRelevantMemories(pet, best.id as PersonalityId),
  };
}

function handleVoidState(pet: Pet): void {
  pet.currentTargetZone = null;
  pet.ticksInTargetZone = 0;
  pet.voidSyncs = (pet.voidSyncs ?? 0) + 1;
  const VOID_THRESHOLD_SYNCS = 7 * 24;
  if (pet.voidSyncs >= VOID_THRESHOLD_SYNCS && pet.emergentState !== 'identity_crisis') {
    pet.emergentState = 'identity_crisis';
    pet.emergentStateEnteredAt = new Date().toISOString();
  }
}
```

---

## 4. Период формирования (Milestone-based)

```typescript
const FORMATION_THRESHOLD = 200;

const FORMATION_WEIGHTS: Record<InfluenceCategory, number> = {
  action: 1.0, item: 1.5, training: 2.0, discipline: 1.5,
  cosmetic: 1.2, environment: 0.8, social: 2.0, system: 0.0,
};

function updateFormationProgress(pet: Pet, influence: RegisteredInfluence, budgetedDelta: Partial<TraitVector>): void {
  if (pet.formationComplete) return;
  const deltaSum = TRAIT_KEYS.reduce((s, k) => s + Math.abs(budgetedDelta[k] ?? 0), 0);
  pet.formationProgress = Math.min(
    FORMATION_THRESHOLD,
    pet.formationProgress + deltaSum * (FORMATION_WEIGHTS[influence.category] ?? 1.0)
  );
  if (pet.formationProgress >= FORMATION_THRESHOLD) completeFormation(pet);
}

function completeFormation(pet: Pet): void {
  const starter = PERSONALITIES
    .map(p => ({ id: p.id, depth: depthOfImmersion(pet.traitVector, p.id, 0) }))
    .reduce((a, b) => (a.depth > b.depth ? a : b));
  pet.personality       = starter.id as PersonalityId;
  pet.formationComplete = true;
  addCoreMemory(pet, {
    tier: 'rare', emoji: '🥚',
    text: `Характер сформировался: ${PERSONALITIES.find(p => p.id === starter.id)?.name}`,
    category: 'system', traitKey: 'vitality', direction: 'origin',
  });
}

function createInitialTraitVector(legacyVector?: TraitVector, legacyCoefficient?: number): TraitVector {
  const neutral: TraitVector = { vitality: 50, sociality: 50, order: 50, appetite: 50, caution: 50, curiosity: 50 };
  if (!legacyVector) return neutral;
  const coeff = legacyCoefficient ?? 0.15;
  return Object.fromEntries(
    TRAIT_KEYS.map(k => [k, neutral[k] + (legacyVector[k] - 50) * coeff])
  ) as TraitVector;
}
```

---

## 5. Core Memories — нарративная обёртка с Tiny AI

### Tier-система

| Tier | Триггер | Хранение |
|------|---------|----------|
| `rare` | Первое пересечение границы зоны (строго раз за жизнь, §5.2) | Никогда не вытесняется |
| `common` | Значительный недельный дрейф (per-axis + per-direction cooldown) | FIFO, max 20 |

### Интерфейс CoreMemory

```typescript
interface CoreMemory {
  id:               string;
  timestamp:        string;
  tier:             'rare' | 'common';
  emoji:            string;
  text:             string;
  category:         InfluenceCategory;
  traitKey:         TraitKey;
  direction:        'up' | 'down' | 'origin';
  personalityHint?: PersonalityId;
}
```

### 5.1 Генерация текста — MemoryTextGenerator

Два взаимозаменяемых генератора с общим интерфейсом:

```typescript
interface MemoryGenerationContext {
  personality:        PersonalityDefinition;
  ageHours:           number;
  traitKey:           TraitKey;
  direction:          'up' | 'down' | 'origin';
  category:           InfluenceCategory;
  emergentState:      EmergentStateType | null;
  dominantInfluences: string[];    // top-3 label из влияний за день
}

interface MemoryTextGenerator {
  generate(ctx: MemoryGenerationContext): Promise<string>;
}

// Реализация 1 — шаблоны (всегда доступна, fallback)
class TemplateGenerator implements MemoryTextGenerator {
  async generate(ctx: MemoryGenerationContext): Promise<string> {
    const templates = MEMORY_TEMPLATES[ctx.traitKey]?.[ctx.direction] ?? ['Что-то изменилось'];
    return templates[Math.floor(Math.random() * templates.length)];
  }
}

// Реализация 2 — on-device Tiny AI (когда доступна)
class TinyAIGenerator implements MemoryTextGenerator {
  async generate(ctx: MemoryGenerationContext): Promise<string> {
    const prompt = buildMemoryPrompt(ctx);
    try {
      const raw    = await window.ai?.generate(prompt, { maxTokens: 30 }) ?? '';
      const cleaned = sanitizeMemoryText(raw);
      return cleaned || new TemplateGenerator().generate(ctx);  // fallback если пусто
    } catch {
      return new TemplateGenerator().generate(ctx);
    }
  }
}

function buildMemoryPrompt(ctx: MemoryGenerationContext): string {
  return [
    `Питомец: ${ctx.personality.name}, ${Math.floor(ctx.ageHours / 24)} дней.`,
    `Действия дня: ${ctx.dominantInfluences.join(', ')}.`,
    `Черта "${ctx.traitKey}" сдвинулась ${ctx.direction === 'up' ? 'вверх' : 'вниз'}.`,
    `Одно предложение в дневник от третьего лица. Без имён характеров.`,
  ].join(' ');
}

function sanitizeMemoryText(raw: string): string {
  return raw.trim().replace(/\n/g, ' ').slice(0, 120);
}

// Выбор реализации
function createMemoryTextGenerator(): MemoryTextGenerator {
  return DeviceCapabilities.hasOnDeviceAI() ? new TinyAIGenerator() : new TemplateGenerator();
}
```

**Fallback-цепочка:** TinyAI → Template → хардкод `'Что-то изменилось'`. Движок всегда получает строку.

### 5.2 Триггер 1 — Threshold Crossing (rare, строго раз за жизнь)

```typescript
function checkThresholdCrossings(pet: Pet, prevVector: TraitVector): void {
  for (const p of PERSONALITIES) {
    if (p.id === pet.personality) continue;

    const wasOutside = depthOfImmersion(prevVector,      p.id, pet.ageHours) <= 0;
    const isInside   = depthOfImmersion(pet.traitVector, p.id, pet.ageHours) >  0;

    // Rare memory — строго раз за жизнь питомца на каждую зону
    if (wasOutside && isInside && !pet.visitedZones.includes(p.id)) {
      pet.visitedZones.push(p.id);
      addCoreMemory(pet, {
        tier: 'rare', emoji: p.emoji,
        text: await memoryGenerator.generate({ /* ctx */ }),
        category: 'system', traitKey: getDominantDriftAxis(pet.traitVector, p),
        direction: 'up', personalityHint: p.id,
      });
    }
    // Возвращение в старую зону — молча, без памяти
  }
}
```

### 5.3 Триггер 2 — Weekly Drift (common, per-axis + per-direction cooldown)

```typescript
const WEEKLY_DRIFT_THRESHOLD = 6;
const MEMORY_COOLDOWN_MS     = 72 * 60 * 60 * 1000;

function checkWeeklyDrift(pet: Pet): void {
  if (pet.dailyTraitSnapshots.length < 7) return;
  const weekAvg = computeWeeklyAverage(pet.dailyTraitSnapshots);

  for (const key of TRAIT_KEYS) {
    const delta     = pet.traitVector[key] - weekAvg[key];
    if (Math.abs(delta) < WEEKLY_DRIFT_THRESHOLD) continue;
    const direction = delta > 0 ? 'up' : 'down';

    // Кулдаун по (axis, direction) — не блокирует противоположное направление
    const cooldownKey = `${key}_${direction}` as `${TraitKey}_${'up'|'down'}`;
    const lastTs      = pet.lastMemoryTimestamp[cooldownKey];
    if (lastTs && Date.now() - new Date(lastTs).getTime() < MEMORY_COOLDOWN_MS) continue;

    addCoreMemory(pet, { tier: 'common', /* ... */ });
    pet.lastMemoryTimestamp[cooldownKey] = new Date().toISOString();
    break;
  }
}
```

### 5.4 Шаблоны текстов (fallback)

```typescript
const MEMORY_TEMPLATES: Record<TraitKey, Record<'up'|'down', string[]>> = {
  vitality:  { up: ['Бурная игровая сессия', 'Не хотел останавливаться'],    down: ['Тихий спокойный день', 'Долгий отдых'] },
  sociality: { up: ['Долгое время вместе', 'Особенно близкий момент'],        down: ['Снова один...', 'Привык обходиться без тебя'] },
  order:     { up: ['Всё по расписанию', 'День прошёл правильно'],            down: ['Всё вверх дном', 'Хаос как стиль жизни'] },
  appetite:  { up: ['Новый вкус', 'Гастрономическое открытие'],               down: ['Ел что дали', 'Еда — просто топливо'] },
  caution:   { up: ['Что-то напугало', 'Тревожный день'],                     down: ['Бесстрашный сегодня', 'Смелее обычного'] },
  curiosity: { up: ['Новое открытие', 'Мир стал интереснее'],                 down: ['Привычный маршрут', 'Зачем что-то менять'] },
};
```

---

## 6. Пять Emergent States

### `singularity` — Точка сингулярности (priority 0)

Наивысший приоритет — перехватывает `checkEvolution` раньше всего остального. Единственный способ мгновенной эволюции в игре.

**Условие:** вектор питомца находится одновременно в 3+ зонах, и глубины погружения почти равны.

```typescript
interface SingularityState {
  zones: PersonalityId[];    // 3 зоны "ножа"
}

function detectSingularity(pet: Pet): SingularityState | null {
  const inside = PERSONALITIES
    .map(p => ({ id: p.id, depth: depthOfImmersion(pet.traitVector, p.id, pet.ageHours) }))
    .filter(x => x.depth > 0)
    .sort((a, b) => b.depth - a.depth);

  if (inside.length < 3) return null;

  const EPSILON = 0.15;  // глубины трёх зон не расходятся более чем на 15%
  if (inside[0].depth - inside[2].depth >= EPSILON) return null;

  return { zones: inside.slice(0, 3).map(x => x.id) as PersonalityId[] };
}

function checkSingularity(pet: Pet): boolean {
  const state = detectSingularity(pet);

  if (!state) {
    // Вышли из состояния — схлопнуть в случайную из зон
    if (pet.ticksInSingularity > 0) collapseSingularity(pet);
    pet.ticksInSingularity = 0;
    pet.singularityZones   = [];
    return false;
  }

  // Обновить зоны (они могут слегка меняться)
  pet.singularityZones = state.zones;
  pet.ticksInSingularity++;

  const SINGULARITY_THRESHOLD_SYNCS = 48;  // 48ч на острие ножа
  if (pet.ticksInSingularity >= SINGULARITY_THRESHOLD_SYNCS &&
      pet.emergentState !== 'singularity') {
    pet.emergentState = 'singularity';
    pet.emergentStateEnteredAt = new Date().toISOString();

    addCoreMemory(pet, {
      tier: 'rare', emoji: '✨',
      text: 'Грани характера слились в единое',
      category: 'system', traitKey: 'curiosity', direction: 'up',
    });
  }

  return true;
}

function collapseSingularity(pet: Pet): void {
  if (!pet.singularityZones.length) return;

  // Мгновенная эволюция в случайную из трёх зон — без 72-синкового ожидания
  const target = pet.singularityZones[Math.floor(Math.random() * pet.singularityZones.length)];
  pet.personality    = target;
  pet.emergentState  = null;
  pet.evolutionHistory.push({
    fromPersonalityId: pet.personality,
    toPersonalityId:   target,
    evolvedAt:         new Date().toISOString(),
    trigger:           'singularity',
  });

  addCoreMemory(pet, {
    tier: 'rare', emoji: PERSONALITIES.find(p => p.id === target)?.emoji ?? '🌀',
    text: `Схлопнулся в ${PERSONALITIES.find(p => p.id === target)?.name}`,
    category: 'system', traitKey: 'vitality', direction: 'origin',
  });
}
```

**Emergent state definition:**
```typescript
{
  type: 'singularity',
  name: 'Точка сингулярности',
  description: 'Питомец завис между тремя личностями. Любое движение решит всё.',
  emoji: '✨',
  priority: 0,       // наивысший — выше shadow_form
  exclusive: true,
  blockedActions: [],
  modifiedActions: [
    { actionType: 'play',  xpMultiplier: 3.0, coinMultiplier: 2.0 },
    { actionType: 'feed',  xpMultiplier: 3.0, coinMultiplier: 2.0 },
    { actionType: 'bond',  xpMultiplier: 3.0, coinMultiplier: 2.0 },
    // Кулдауны всех предметов обнуляются на время состояния (item cooldown bypass)
  ],
  exitHint: 'Любое действие может схлопнуть в один из характеров. Или удерживай баланс.',
  visual: {
    bodyAnimation: 'glitch',
    eyeExpression: 'prismatic',
    particleEffect: 'tripleStar',
    overlayTint: 'rgba(255,255,255,0.05)',
  },
}
```

---

### `identity_crisis` — Кризис идентичности

Активируется: вне всех зон > 7 дней.

```typescript
{
  type: 'identity_crisis', name: 'Кризис идентичности', emoji: '🌫', priority: 2, exclusive: true,
  blockedActions: [],
  modifiedActions: [
    { actionType: 'play',  xpMultiplier: 0.5, coinMultiplier: 0.7 },
    { actionType: 'feed',  xpMultiplier: 0.5, coinMultiplier: 1.0 },
    { actionType: 'bond',  xpMultiplier: 1.5, coinMultiplier: 1.0 },
  ],
  exitHint: 'Выработай регулярный паттерн ухода на несколько дней',
  visual: { bodyAnimation: 'dissolve', eyeExpression: 'hollow', overlayTint: 'rgba(100,100,100,0.28)' },
}
```

---

### `shadow_form` — Теневая форма (с двойной защитой от фарма)

Активируется: `traumaLevel >= 75` **и** `traumaCooldownUntil` истёк.

```typescript
function canEnterShadowForm(pet: Pet): boolean {
  if (pet.traumaCooldownUntil && new Date() < new Date(pet.traumaCooldownUntil)) return false;
  return pet.traumaLevel >= 75;
}

function exitShadowForm(pet: Pet): void {
  pet.emergentState     = null;
  pet.traumaLevel       = 0;
  pet.catharsisProgress = 0;
  const cooldown = new Date();
  cooldown.setDate(cooldown.getDate() + 14);
  pet.traumaCooldownUntil = cooldown.toISOString();
}

function triggerCatharsis(pet: Pet): void {
  exitShadowForm(pet);
  addCoreMemory(pet, { tier: 'rare', emoji: '🌅', text: 'Прошли через тьму вместе',
    category: 'system', traitKey: 'sociality', direction: 'up' });
  if (!pet.catharsisAchieved) {
    pet.catharsisAchieved = true;
    scheduleCatharsisBurst(pet);  // XP ×5.0 на 2ч — только первый раз
  }
}
```

**Петля:** 1-й раз → X5 XP + rare memory. 2-й раз → только Core Memory. 3-й+ → 14-дневный кулдаун делает цикл нефармабельным.

---

### `confused` — Когнитивный диссонанс

Активируется: `dailyVectorVariance >= 25`. Сбрасывается **только при завершении полного цикла сна** (≥4ч непрерывно), не при полуночи.

```typescript
const MINIMUM_RESET_SLEEP_HOURS = 4;

// Начало сна — только запомнить время
function onStartSleep(pet: Pet): void {
  pet.sleepStartedAt = new Date().toISOString();
}

// Завершение сна — сброс только если проспал достаточно и проснулся естественно
function onWakeFromSleep(pet: Pet, naturalWake: boolean): void {
  if (pet.sleepStartedAt) {
    const sleptHours = (Date.now() - new Date(pet.sleepStartedAt).getTime()) / 3_600_000;
    if (naturalWake && sleptHours >= MINIMUM_RESET_SLEEP_HOURS) {
      pet.dailyVectorVariance = 0;
      pet.confusedState       = false;
      pet.lastSleepTimestamp  = new Date().toISOString();
    }
    // wake_early или короткий сон — variance остаётся, питомец не отдохнул
  }
  pet.sleepStartedAt = null;
}

// Аварийный клапан: 48ч без полноценного сна (feral, bold)
function checkVarianceHardReset(pet: Pet): void {
  if (!pet.lastSleepTimestamp) return;
  const hoursSinceSleep = (Date.now() - new Date(pet.lastSleepTimestamp).getTime()) / 3_600_000;
  if (hoursSinceSleep >= 48) {
    pet.dailyVectorVariance = 0;
    pet.confusedState       = false;
  }
}
```

**Почему wake_early не сбрасывает:** прерванный сон не переваривает впечатления. Плюс `wake_early` увеличивает variance через `traumaDelta +2` в реестре — каждый цикл "уснул-разбудил" не только не сбрасывает, но и добавляет диссонанс.

---

### `singularity` — описан в §6.1 выше.

---

## 7. Система Эха — Dynasty Legacy

```typescript
function recordLegacy(account: Account, pet: Pet): void {
  const BLEND_RATIO = 0.70;

  account.legacyVector = account.legacyVector
    ? Object.fromEntries(
        TRAIT_KEYS.map(k => [
          k,
          pet.traitVector[k] * BLEND_RATIO + account.legacyVector![k] * (1 - BLEND_RATIO)
        ])
      ) as TraitVector
    : { ...pet.traitVector };

  const lastEvolution    = pet.evolutionHistory.at(-1);
  const wasEpicLegendary = lastEvolution &&
    ['feral','empath','chaotic','greedy','adventurer','paranoid'].includes(lastEvolution.toPersonalityId);
  account.legacyCoefficient = wasEpicLegendary ? 0.20 : 0.15;
  account.legacyGeneration  = (account.legacyGeneration ?? 0) + 1;

  const lastName = PERSONALITIES.find(p => p.id === pet.personality)?.name;
  account.legacyDescription = account.legacyGeneration === 1
    ? `В нём живёт дух ${lastName}`
    : `Линия крови ${account.legacyGeneration} поколений`;
}
```

**Затухание:** вес первого питомца в 10-м ≈ `0.3^9 × 0.7 ≈ 0.00007`. Математически честно, нарративно — "линия крови".

**Account fields:**
```typescript
legacyVector?:      TraitVector;
legacyCoefficient?: number;
legacyGeneration?:  number;
legacyDescription?: string;
```

---

## 8. LiveOps — Remote Registry с Global Balance

### 8.1 Архитектура загрузки

```typescript
let remoteRegistry:          RegisteredInfluence[]  = [];
let globalBalancePatches:    GlobalBalancePatch[]    = [];
let remoteRegistryFetchedAt: number | null           = null;
const REMOTE_TTL_MS = 60 * 60 * 1000;  // 1 час

export async function fetchRemoteData(): Promise<void> {
  if (remoteRegistryFetchedAt && Date.now() - remoteRegistryFetchedAt < REMOTE_TTL_MS) return;
  try {
    const resp = await fetch('/api/influence-registry');
    const data = await resp.json();
    remoteRegistry       = (data.seasonal   ?? []).filter(validateRemoteInfluence);
    globalBalancePatches = (data.balance     ?? []).filter(validateBalancePatch);
    remoteRegistryFetchedAt = Date.now();
  } catch { /* используем кеш */ }
}

export function getInfluenceRegistry(): RegisteredInfluence[] {
  return [...STATIC_INFLUENCE_REGISTRY, ...remoteRegistry];
}

export function getIntensityMultiplier(influenceId: string): number {
  const patch = globalBalancePatches.find(p => p.influenceId === influenceId);
  return patch?.intensityMultiplier ?? 1.0;
}
```

### 8.2 GlobalBalancePatch — не патчит traitDeltas напрямую

```typescript
interface GlobalBalancePatch {
  influenceId:          string;
  intensityMultiplier:  number;   // только в [0.80, 1.20] — ±20% от базового
  reason:               'meta_balance';
  appliedAt:            string;
}

function validateBalancePatch(raw: unknown): GlobalBalancePatch | null {
  if (!isObject(raw)) return null;
  if (typeof raw.intensityMultiplier !== 'number') return null;
  if (raw.intensityMultiplier < 0.80 || raw.intensityMultiplier > 1.20) return null;
  if (raw.reason !== 'meta_balance') return null;
  return raw as GlobalBalancePatch;
}
```

**Что балансируется:** не процент эволюций (1/16 каждого), а **дисперсия** — ни один характер не должен набирать >25% и падать <2% среди всех питомцев. Скорость изменения: max ±2% мультипликатора в неделю (7-дневный rolling average на сервере).

**Прозрачность:** в настройках игрока: "🌐 Глобальная балансировка активна — мета адаптируется к сообществу."

### 8.3 Защита от координированных атак

```typescript
// Сервер игнорирует данные от аккаунтов с аномальным поведением (z-score > 3)
// Патчи применяются с задержкой 7 дней (rolling average фильтрует спайки)
// Hard cap: multiplier не может измениться более чем на 0.02 за одну итерацию
```

### 8.4 Пример сезонного ивента (Halloween)

```json
{
  "seasonal": [
    {
      "id": "remote:halloween_season",
      "category": "system",
      "label": "Хэллоуинская атмосфера",
      "traitDeltas": { "caution": 0.3, "curiosity": 0.3 },
      "cooldownSyncs": 24
    },
    {
      "id": "remote:pumpkin_latte",
      "category": "item",
      "label": "Тыквенный латте",
      "traitDeltas": { "caution": -0.4, "appetite": 1.0, "sociality": 0.5 },
      "cooldownSyncs": 12
    }
  ],
  "balance": [
    {
      "influenceId": "action:play",
      "intensityMultiplier": 0.92,
      "reason": "meta_balance",
      "appliedAt": "2026-10-01T00:00:00Z"
    }
  ]
}
```

Слабые дельты (±0.3) создают тенденцию, а не детерминированный результат. За месяц Хэллоуина: ~9 единиц смещения по caution — заметно, но не все питомцы эволюционируют в Параноиков.

---

## 9. Реестр влияний (STATIC_INFLUENCE_REGISTRY)

### Типы

```typescript
export interface RegisteredInfluence {
  id: string;
  category: InfluenceCategory;
  label: string;
  traitDeltas: Partial<Record<TraitKey, number>>;
  traumaDelta?: number;
  cooldownSyncs?: number;
  conditions?: InfluenceCondition[];
  intensityRules?: IntensityRule[];
  onApply?: 'sleep_start' | 'sleep_wake_natural' | 'sleep_wake_early';  // хук жизненного цикла
}
```

### Фрагмент реестра

```typescript
export const STATIC_INFLUENCE_REGISTRY: RegisteredInfluence[] = [

  { id: 'action:play', category: 'action', label: 'Игра',
    traitDeltas: { vitality: +2, curiosity: +1, order: -1 }, cooldownSyncs: 0,
    intensityRules: [
      { condition: { type: 'time_of_day', params: { from: 22, to: 6 } }, multiplier: 1.5 },
      { condition: { type: 'flag_active', params: { flag: 'play_burnout' } }, multiplier: 0.3 },
    ],
  },

  { id: 'action:bond', category: 'action', label: 'Bond',
    traitDeltas: { sociality: +2, caution: -1 }, traumaDelta: -3, cooldownSyncs: 1,
    intensityRules: [
      { condition: { type: 'personality_is', params: { id: 'empath' } }, multiplier: 1.5 },
      { condition: { type: 'trait_above', params: { key: 'caution', value: 80 } }, multiplier: 0.5 },
    ],
  },

  { id: 'action:sleep_natural', category: 'action', label: 'Естественный сон',
    traitDeltas: { vitality: -1, order: +1.5 }, cooldownSyncs: 12,
    onApply: 'sleep_start',
    // Сброс variance происходит в onWakeFromSleep() при естественном пробуждении ≥4ч
  },

  { id: 'action:wake_early', category: 'action', label: 'Разбудили в первый час сна',
    traitDeltas: { order: -2, caution: +2, vitality: +1 }, traumaDelta: +2, cooldownSyncs: 2,
    onApply: 'sleep_wake_early',
    // НЕ сбрасывает variance — прерванный сон ничего не переваривает
  },

  { id: 'action:sleep_forced', category: 'action', label: 'Принудительный сон',
    traitDeltas: { vitality: -2, order: -1, caution: +1 }, traumaDelta: +1, cooldownSyncs: 6,
    onApply: 'sleep_start',
  },

  { id: 'action:bathe', category: 'action', label: 'Купание',
    traitDeltas: { order: +2, caution: -0.5 },
    intensityRules: [{ condition: { type: 'personality_is', params: { id: 'feral' } }, multiplier: -2 }],
  },

  { id: 'action:heal', category: 'action', label: 'Лечение',
    traitDeltas: { caution: +1, sociality: +0.5 }, traumaDelta: -2, cooldownSyncs: 3,
  },

  { id: 'system:inactivity_long', category: 'system', label: 'Перерыв > 48ч',
    traitDeltas: { sociality: -3, caution: +3, order: -1 }, traumaDelta: +3, cooldownSyncs: 48,
  },

  { id: 'system:consistent_week', category: 'system', label: '7 дней подряд',
    traitDeltas: { order: +3, sociality: +2, caution: -2 }, traumaDelta: -5, cooldownSyncs: 168,
    conditions: [{ type: 'streak_days', params: { action: 'any', days: 7 } }],
  },

  { id: 'system:starvation', category: 'system', label: 'Голод < 5 (3+ синков)',
    traitDeltas: { caution: +3, sociality: -2 }, traumaDelta: +5, cooldownSyncs: 6,
  },

  { id: 'item:puzzle',       category: 'item', label: 'Головоломка',         traitDeltas: { curiosity: +4, order: +2, vitality: -1 },    cooldownSyncs: 6  },
  { id: 'item:music_box',    category: 'item', label: 'Музыкальная шкатулка', traitDeltas: { sociality: +3, caution: -2, order: +1 },     traumaDelta: -4, cooldownSyncs: 8  },
  { id: 'item:magic_potion', category: 'item', label: 'Магическое зелье',     traitDeltas: { curiosity: +3, appetite: +2 },               traumaDelta: -8, cooldownSyncs: 24 },
  { id: 'item:magic_wand',   category: 'item', label: 'Волшебная палочка',    traitDeltas: { curiosity: +5, vitality: +3, caution: -2 },  cooldownSyncs: 12 },
  { id: 'item:crystal_ball', category: 'item', label: 'Хрустальный шар',      traitDeltas: { curiosity: +4, caution: -1, sociality: +2 }, traumaDelta: -3, cooldownSyncs: 24 },

  { id: 'env:new_room',      category: 'environment', label: 'Новая комната',    traitDeltas: { curiosity: +4, vitality: +2, caution: -1 }, cooldownSyncs: 0  },
  { id: 'env:same_room_48h', category: 'environment', label: '48ч в одной комнате', traitDeltas: { curiosity: -2, order: +1 },             cooldownSyncs: 48 },

  // Social — НИКОГДА без traumaDelta (защита от grief, проверяется при старте)
  { id: 'social:visit_feral',    category: 'social', label: 'С Диким',      traitDeltas: { vitality: +1, order: -1, caution: -0.5 }, cooldownSyncs: 12, conditions: [{ type: 'formation_period', params: { active: 0 } }] },
  { id: 'social:visit_sage',     category: 'social', label: 'С Мудрым',     traitDeltas: { curiosity: +2, order: +1 },               cooldownSyncs: 8,  conditions: [{ type: 'formation_period', params: { active: 0 } }] },
  { id: 'social:visit_paranoid', category: 'social', label: 'С Параноиком', traitDeltas: { caution: +2, sociality: -1 },             cooldownSyncs: 12, conditions: [{ type: 'formation_period', params: { active: 0 } }] },
  { id: 'social:visit_empath',   category: 'social', label: 'С Эмпатом',    traitDeltas: { sociality: +2, caution: -1 },             cooldownSyncs: 8,  conditions: [{ type: 'formation_period', params: { active: 0 } }] },
  { id: 'social:visit_chaotic',  category: 'social', label: 'С Хаотиком',   traitDeltas: { curiosity: +2, order: -1.5, vitality: +1 },cooldownSyncs: 12, conditions: [{ type: 'formation_period', params: { active: 0 } }] },
  { id: 'social:visit_playful',  category: 'social', label: 'С Игривым',    traitDeltas: { vitality: +1, curiosity: +1, order: -0.5 },cooldownSyncs: 12, conditions: [{ type: 'formation_period', params: { active: 0 } }] },

  // Будущие функции — раскомментировать при добавлении
  /*
  { id: 'training:word_success',     category: 'training',   label: 'Выучил слово',          traitDeltas: { curiosity: +3, order: +2, sociality: +1 },  cooldownSyncs: 1  },
  { id: 'discipline:praise',         category: 'discipline', label: 'Похвала',               traitDeltas: { sociality: +3, caution: -1, order: +1 },    traumaDelta: -2, cooldownSyncs: 2  },
  { id: 'discipline:harsh_punishment',category:'discipline', label: 'Жёсткое наказание',     traitDeltas: { caution: +4, sociality: -3 },               traumaDelta: +8, cooldownSyncs: 12 },
  { id: 'cosmetic:outfit_luxury',    category: 'cosmetic',   label: 'Роскошная одежда',      traitDeltas: { appetite: +3, sociality: +2 },              cooldownSyncs: 24 },
  { id: 'item:treat_luxury',         category: 'item',       label: 'Роскошное угощение',    traitDeltas: { appetite: +4, sociality: +1, curiosity: +1 },traumaDelta: -3, cooldownSyncs: 6  },
  */
];
```

---

## 10. Пассивные бонусы от эволюции

```typescript
const EVOLUTION_LEGACY: Partial<Record<PersonalityId, EvolutionBonus>> = {
  feral:      { description: 'Следы дикой природы',         xpMultiplierBonus: 0.05, uniqueTrait: 'Ночные действия +5% XP навсегда' },
  empath:     { description: 'Эмпатический след',           xpMultiplierBonus: 0.08, uniqueTrait: 'bond-действия всегда +5 happiness' },
  chaotic:    { description: 'Хаотический осколок',         xpMultiplierBonus: 0.10, uniqueTrait: '10% шанс ×2 XP на любое действие' },
  greedy:     { description: 'Жадное наследие',                                      uniqueTrait: '+3% монет к каждой игре навсегда' },
  adventurer: { description: 'Дух авантюры',                xpMultiplierBonus: 0.06, uniqueTrait: 'Первая еда дня всегда +5 curiosity' },
  paranoid:   { description: 'Параноидальная бдительность', xpMultiplierBonus: 0.12, uniqueTrait: 'Если все статы > 80: +15% к XP' },
};
```

---

## 11. Безопасность — полный список контрактов

```typescript
function validateInfluenceRegistry(registry: RegisteredInfluence[]): void {
  for (const inf of registry) {
    if (inf.category === 'social' && inf.traumaDelta !== undefined)
      throw new Error(`${inf.id}: social нельзя с traumaDelta`);

    if (inf.id.startsWith('remote:')) {
      if (!ALLOWED_REMOTE_CATEGORIES.has(inf.category))
        throw new Error(`${inf.id}: remote использует запрещённую категорию`);
      if (inf.traumaDelta !== undefined)
        throw new Error(`${inf.id}: remote нельзя с traumaDelta`);
      for (const key of TRAIT_KEYS) {
        const v = inf.traitDeltas[key];
        if (v !== undefined && Math.abs(v) > 2)
          throw new Error(`${inf.id}: remote delta > ±2`);
      }
    }
  }
}

const ALLOWED_REMOTE_CATEGORIES = new Set<InfluenceCategory>(['system', 'environment', 'item']);
```

| Механизм | Что защищает |
|----------|-------------|
| `cooldownSyncs` | Нельзя применять влияние слишком часто |
| `DAILY_BUDGET` | Суточный потолок изменений |
| `SMOOTHING_ALPHA = 0.08` | Нет резких скачков |
| `STABILITY_SYNCS = 72` | Минимум 3 дня до эволюции |
| `FORMATION_WEIGHTS['system'] = 0.0` | Нельзя фармить формирование |
| `catharsisAchieved` | X5 XP буст только раз за жизнь |
| `traumaCooldownUntil` | 14 дней между shadow_form |
| `visitedZones` | Rare Threshold Crossing — раз за жизнь на зону |
| `onWakeFromSleep (≥4ч)` | Нельзя сбросить confused коротким сном |
| `GlobalBalancePatch max ±20%` | Нельзя сломать мету через Remote Registry |
| `social без traumaDelta` | Нельзя травмировать чужого питомца |

---

## 12. Файловая структура

```
src/personality/
  evolutionTypes.ts          ← все TypeScript типы
  influenceRegistry.ts       ← STATIC + fetchRemoteData() + getInfluenceRegistry()
  personalityTraitMap.ts     ← позиции 16 + EVOLUTION_LEGACY
  TraitEvolutionEngine.ts    ← движок (чистые функции)
  memoryTextGenerator.ts     ← MemoryTextGenerator, TemplateGenerator, TinyAIGenerator
  npcPets.ts                 ← NPC_PETS
  index.ts                   ← re-export

src/components/personality/
  TraitRadar.tsx             ← 6D диаграмма черт
  EvolutionBanner.tsx        ← предложение эволюции с Core Memories
  CoreMemoryCard.tsx         ← rare / common карточка
  EvolutionHistory.tsx       ← история эволюций
  SingularityBanner.tsx      ← активная сингулярность + 3 возможных характера
  NpcVisitPanel.tsx          ← выбор NPC
  CatharsisProgress.tsx      ← прогресс исцеления в shadow_form
  DynastyLegacyBadge.tsx    ← "Линия крови X поколений"
```

---

## 13. Новые поля

```typescript
// Pet — добавить в src/api/types.ts
traitVector:           TraitVector;
dailyTraitBudget:      Partial<Record<TraitKey, number>>;
currentTargetZone:     PersonalityId | null;
ticksInTargetZone:     number;
voidSyncs:             number;
dailyTraitSnapshots:   Array<{ date: string; vector: TraitVector }>;
coreMemories:          CoreMemory[];
lastMemoryTimestamp:   Partial<Record<`${TraitKey}_${'up'|'down'}`, string>>;
visitedZones:          PersonalityId[];       // Ghost Memories fix
evolutionProposal?:    EvolutionProposal;
evolutionHistory:      EvolutionRecord[];
formationComplete:     boolean;
formationProgress:     number;
traumaLevel:           number;
catharsisProgress:     number;
catharsisAchieved:     boolean;
traumaCooldownUntil:   string | null;
dailyVectorVariance:   number;
confusedState:         boolean;
sleepStartedAt:        string | null;         // Sleeping Beauty fix
lastSleepTimestamp:    string | null;
ticksInSingularity:    number;
singularityZones:      PersonalityId[];

// Account
legacyVector?:         TraitVector;
legacyCoefficient?:    number;
legacyGeneration?:     number;
legacyDescription?:    string;
```

---

## 14. План реализации

### Phase A.0 — Milestone Formation
- [ ] `FORMATION_THRESHOLD`, `FORMATION_WEIGHTS`
- [ ] `formationProgress`, `formationComplete`, `visitedZones: []`
- [ ] `createInitialTraitVector()` с Dynasty Legacy
- [ ] UX-индикатор прогресса

### Phase A.1 — Offline-first Core Contract
- [x] `PetCommand` — структурные команды с идемпотентным `commandId`
- [x] `DomainEvent` — машинно-читаемые события для replay/sync
- [x] `OfflinePetSave` — snapshot + append-only command log + sync cursor
- [x] Serializable `influenceCooldowns` для replay-friendly cooldown state
- [x] `PERSONALITY_ENGINE_VERSION` и `STATIC_REGISTRY_VERSION`
- [x] Pure helpers для append/deduplicate/getUnsynced/markSynced
- [x] Personality-side command handler для trait/sleep/sync эффектов
- [x] Replay helper для последовательного применения command log
- [x] Persist adapter contract для offline-сохранения
- [x] Mock runtime сохраняет/восстанавливает offline snapshot + command log
- [ ] Full command handler для gameplay stats/economy/inventory/rewards
- [ ] Полное подключение persist adapter к браузерному store/runtime
- [ ] Backend replay/validation adapter

### Phase A — Фундамент
- [ ] `evolutionTypes.ts`
- [ ] `personalityTraitMap.ts`
- [ ] `influenceRegistry.ts` — Static + Remote + GlobalBalance
- [ ] `memoryTextGenerator.ts` — TemplateGenerator + TinyAIGenerator интерфейс
- [ ] `TraitEvolutionEngine.ts`
- [ ] Валидация реестра при старте
- [ ] Добавить поля в Pet и Account
- [ ] Unit-тесты

### Phase B — Интеграция в MockApi
- [ ] `applyInfluence()` во всех actions (с `getIntensityMultiplier()`)
- [ ] `applyRegression()` + `checkEvolution()` в `syncPet()`
- [ ] `checkSingularity()` + `collapseSingularity()`
- [ ] `onStartSleep()` / `onWakeFromSleep()` с min-sleep-duration
- [ ] `checkVarianceHardReset()` (48h fallback)
- [ ] `identity_crisis` через voidSyncs
- [ ] `shadow_form`: double-barrier, `triggerCatharsis()`
- [ ] `acceptEvolution()` / `rejectEvolution()`
- [ ] `applyNpcVisit()`
- [ ] `recordLegacy()` Dynasty blend

### Phase C — Core Memories
- [ ] `checkThresholdCrossings()` с `visitedZones` guard
- [ ] `checkWeeklyDrift()` per-axis + per-direction cooldown
- [ ] `MemoryTextGenerator.generate()` — шаблоны + AI path
- [ ] `CoreMemoryCard.tsx` (rare / common визуально различимы)
- [ ] Нарративный EvolutionProposal text

### Phase D — UI
- [ ] `TraitRadar.tsx`
- [ ] `EvolutionBanner.tsx`
- [ ] `SingularityBanner.tsx` — три зоны, glitch-анимация
- [ ] `CatharsisProgress.tsx`
- [ ] `DynastyLegacyBadge.tsx`
- [ ] `NpcVisitPanel.tsx`
- [ ] Confused state indicator

### Phase E — LiveOps
- [ ] `/api/influence-registry` endpoint
- [ ] Server-side: rolling average для GlobalBalancePatch (7-day window, ±2%/week cap)
- [ ] Remote влияния — server validation на входе
- [ ] CMS для геймдизайнеров: сезонные JSON без кода

### Phase F — Tiny AI
- [ ] `DeviceCapabilities.hasOnDeviceAI()`
- [ ] `TinyAIGenerator.generate()` с sanitization и fallback
- [ ] A/B тест: template vs AI — метрики engagement с Core Memory cards

### Phase G — Новые функции
- [ ] Обучение словам → `training:*`
- [ ] Наказание → `discipline:*`
- [ ] Одежда → `cosmetic:*`
- [ ] Мультиплеер → реальные питомцы вместо NPC

---

## 15. Offline-first execution model

Архитектурное решение зафиксировано в `docs/adr/0001-offline-first-personality-engine.md`.

### Решение

Система эволюции характера реализуется как **offline-first shared TypeScript engine**.

Это означает:

- питомец должен продолжать развиваться, получать Core Memories, менять настроение, проходить sleep lifecycle и реагировать на действия без интернета;
- доменная математика должна жить в чистом TypeScript-ядре, независимом от React, Zustand, `localStorage`, `fetch` и UI;
- frontend может применять движок локально в offline mode;
- будущий backend должен использовать тот же движок или совместимый пакет для replay/validation/sync;
- frontend-only не является финальной моделью авторитета для экономики, рейтингов, LiveOps, мультиплеера и account-wide legacy.

### Граница ответственности

Core engine:

- принимает `PetState`, command, clock/context, influence registry и balance patches;
- возвращает новый state и domain events;
- не читает сеть, браузерное хранилище или React state напрямую.

Frontend/offline adapter:

- хранит latest snapshot;
- ведёт append-only command log;
- применяет core engine локально;
- показывает state в UI;
- отправляет unsynced commands при возвращении сети.

Backend/future adapter:

- валидирует или переигрывает command log;
- возвращает canonical state;
- жёстко контролирует economy, leaderboard, social/multiplayer и LiveOps;
- мягко принимает personal progression, если нет явной порчи или abuse.

### Offline storage contract

Минимально хранить:

```typescript
interface OfflinePetSave {
  petSnapshot: Pet;
  commandLog: PetCommand[];
  lastSyncedCommandId: string | null;
  engineVersion: string;
  registryVersion: string;
  savedAt: string;
}
```

Команды должны быть идемпотентными и иметь стабильный `commandId`.

### Time policy

Offline simulation использует client time, чтобы питомец оставался живым без сети. При последующей синхронизации backend может ограничивать rewards и competitive effects при аномальных скачках времени, но не должен ломать базовый personal progress без серьёзной причины.

### Registry policy

Core получает registry как аргумент. Загрузка `/api/influence-registry`, кеширование remote registry и выбор fallback-версии — инфраструктурная ответственность, не часть чистого движка.

Если игрок offline, используется последний валидный кеш. Если кеша нет, статический registry достаточен для обычного ухода.

---

*Документ v5.0. `INFLUENCE_REGISTRY` обновляется при каждой новой функции без изменения версии. Версию обновлять только при изменении математики движка, структуры `TraitVector`, алгоритма `checkEvolution`, или контрактов безопасности.*
