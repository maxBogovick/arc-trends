# Time Of Day Pet Behavior Design

## Goal

Make the pet feel aware of the real time of day. The pet should proactively suggest context-appropriate actions such as breakfast in the morning, activity during the day, calmer care in the evening, and sleep rituals at night. These suggestions must also respect the pet's current personality, stats, sleep state, and evolution direction.

This is a design document for approval before implementation.

## Existing Foundation

The project already supports time-aware behavior in several places:

- command handling uses `command.at` and derives `clientLocalHour` through `now.getHours()`;
- influence rules already support `time_of_day`;
- room lighting and sky visuals already use local real time;
- proactive suggestions already let the pet initiate a message and optional action;
- action execution is centralized through supported action ids.

Therefore this feature should be implemented as a new recommendation policy layer, not as a separate chat system.

## Design Principles

1. Time-of-day rules are suggestions, not hard locks.
2. Critical needs always win over routine suggestions and ordinary after-action flavor.
3. Important after-action feedback is high priority only when no critical need is active.
4. The same time period should feel different for different personalities.
5. First version should use existing actions only.
6. No LLM/network dependency in the first version.
7. Rules should be data-driven and testable.
8. The user should still be able to ignore the suggestion.
9. Repeatedly ignored suggestions must cool down.
10. Context labels such as "breakfast" or "evening walk" should not create new engine commands unless they add unique mechanics.

## Priority Order

When generating a proactive pet message, priorities should be:

1. emergency / critical needs: hunger, health, energy, cleanliness, bond, trauma, confused/shadow states;
2. blocked action feedback when it helps the user recover from an impossible action;
3. important after-action feedback: evolution proposal, major trait shift, new memory;
4. recovery and emotional safety suggestions;
5. time-of-day routine suggestions;
6. evolution/personality training suggestions;
7. generic mood fallback.

Critical needs may also modify softer feedback. Example: "Мне приятно, но я всё ещё очень голоден." This prevents a happy reaction from hiding an urgent need.

## Time Periods

Default time periods:

| Period | Time | Main Theme |
|---|---:|---|
| `early_morning` | 05:00-07:59 | gentle wake, light care |
| `morning` | 08:00-11:59 | breakfast, exercise, plan for day |
| `day` | 12:00-16:59 | activity, learning, exploration |
| `evening` | 17:00-20:59 | care, bonding, cleanup, calmer play |
| `night` | 21:00-04:59 | sleep ritual, quiet recovery |

These boundaries should be easy to change later.

### Adaptive Schedule

The default windows are only a starting point. The implementation should support an offset so the user's real routine can shift the schedule by up to 2 hours.

Suggested MVP behavior:

- start with the default periods;
- observe the first meaningful app session of each day;
- if the user consistently starts later or earlier, shift `early_morning` and `morning` locally;
- never shift more than ±2 hours in the first version;
- if the detected device timezone offset changes by more than 4 hours compared with the last saved session, reset the adaptive offset to 0 and rebuild the routine from the new local time;
- tests should use explicit dates/hours and not depend on device time.

This avoids telling a late-schedule user that 07:00 is always "morning" for them.

### Boundary Spam Guard

Period boundaries must not create noisy message churn.

Rules:

- if less than 15 minutes remain before the next period and there are no critical needs, score routine suggestions using the next period;
- do not emit a new routine suggestion if another routine suggestion was shown less than 10 minutes ago;
- emergency, blocked-action feedback, and important after-action feedback can bypass this guard;
- if a period changes while a suggestion is visible, keep the visible suggestion until it is dismissed, completed, or naturally expires.

## Activity Model

The first draft was too narrow because it mapped every idea directly to one existing action button. The better model is:

- **activity** = what the pet asks for in human language;
- **primary action** = what can be executed now;
- **destination** = where the UI should send the user when the activity needs inventory, shop, room, or editor context;
- **future command** = optional later engine command when the activity deserves unique gameplay effects.

This lets the pet suggest richer things now without pretending every activity is already a first-class engine command.

```ts
type ActivityTarget =
  | { kind: 'action'; actionId: SupportedPetActionId }
  | { kind: 'deep_link'; destination: 'inventory' | 'shop' | 'room' | 'assistant'; filter?: string }
  | { kind: 'inventory_item'; itemId?: string; itemType?: ItemType }
  | { kind: 'room'; roomId?: string }
  | { kind: 'future_command'; commandId: string };

interface TimeOfDayActivity {
  id: string;
  label: string;
  target: ActivityTarget;
  periodAffinity: DayPeriod[];
  personalityAffinity?: PersonalityId[];
  traitIntent: TraitKey[];
  behaviorIntent: BehaviorAxis[];
  message: string;
}
```

In the first implementation, `kind: 'action'` is executable directly from the speech bubble. Other targets should not be generic navigation buttons like "Рюкзак" or "Магазин". They should be deep links with a narrowed intent, such as "Выбрать игрушку", "Использовать шкатулку", or "Открыть подходящие комнаты".

## Existing Action Mapping

The first version should not add new commands. Use these existing actions:

| User-facing Idea | Existing Action |
|---|---|
| Breakfast | `feed` |
| Exercise / charge | `play` |
| Puzzle / learning | `play_puzzle` |
| Walk / shared activity | `play_social` for now |
| Hygiene / cleanup | `bathe` |
| Check health | `heal` |
| Hug / attention | `bond` |
| Listen / calm support | `bond_listen` |
| Praise / confidence | `bond_praise` |
| Nap | `sleep_nap` |
| Sleep ritual | `sleep_ritual` |
| Wake gently | `sleep` when pet is asleep |

Later, if needed, separate commands can be added only when the activity has unique mechanics. "Breakfast" and "dinner" should remain `feed` with time-aware text and scoring unless meal timing gets unique gameplay behavior.

## Expanded Activity Catalog

### Morning Activities

| Activity | Current Target | Future Command | Best For |
|---|---|---|---|
| Gentle wake | `sleep` if asleep and energy high | none | drowsy, zen, anxious |
| Breakfast | `feed` | none unless meals get unique mechanics | foodie, greedy, empath |
| Morning stretch | `play` | none unless low-risk exercise becomes distinct | bold, playful, stoic |
| Quick charge | `play` or inventory `energy_drink` | none initially | bold, chaotic, adventurer |
| Garden check | deep link to room `forest` | `walk` only if walks can find items/events | feral, adventurer, curious |
| Beach air | deep link to room `beach` | none initially | playful, foodie, empath |
| Brain warm-up | `play_puzzle` or item `puzzle` | none | sage, curious, stoic |
| Confidence praise | `bond_praise` | none | anxious, melancholic, empath |
| Calm breathing | `bond_listen` | `breathing_ritual` | anxious, zen, paranoid |
| Tidy start | `bathe` if cleanliness low | `tidy_room` | pristine, stoic, zen |
| Check vitamins | inventory `vitamin` if owned, else `heal` if health low | none | anxious, pristine |
| Plan the route | deep link to room selection | none initially | adventurer, sage |

### Day Activities

| Activity | Current Target | Future Command | Best For |
|---|---|---|---|
| Active play | `play` | `active_training` | bold, playful, chaotic |
| Puzzle session | `play_puzzle` / item `puzzle` | none | sage, curious, stoic |
| Shared game | `play_social` | none | empath, playful, melancholic |
| Forest walk | room `forest` | `walk` only if walks can find items/events | feral, adventurer, curious |
| Beach walk | room `beach` | none initially | playful, foodie, empath |
| Space observation | room `space` / item `crystal_ball` | `stargaze` only if it gets unique memory/trait events | sage, curious, paranoid |
| Toy rotation | inventory toy item | none | playful, chaotic, adventurer |
| Music break | item `music_box` | none | anxious, empath, melancholic |
| Decoration refresh | inventory decoration | none initially | pristine, empath, zen |
| Snack break | `feed` only if hunger low enough | none initially | foodie, greedy |
| Training challenge | `play` | `training_session` only if progression differs | bold, greedy, stoic |
| Explore shop | deep link to relevant shop filter | none | greedy, curious, adventurer |
| Memory review | deep link to personality assistant | `memory_reflection` if it changes memories/traits | sage, melancholic, paranoid |

### Evening Activities

| Activity | Current Target | Future Command | Best For |
|---|---|---|---|
| Dinner | `feed` if hunger below threshold | none unless meals get unique mechanics | foodie, empath, drowsy |
| Bath and cleanup | `bathe` | none initially | pristine, stoic, zen |
| Quiet walk | room `forest` / `beach` | `walk` only if walks can find items/events | adventurer, empath, melancholic |
| Listen together | `bond_listen` | none | anxious, melancholic, paranoid |
| Praise the day | `bond_praise` | none | empath, bold, playful |
| Soft shared game | `play_social` | none | playful, empath |
| Puzzle cooldown | `play_puzzle` | none | sage, curious, stoic |
| Music box wind-down | item `music_box` | none | anxious, drowsy, zen |
| Lights and comfort | decoration `fairy_lights` | none initially | drowsy, empath, melancholic |
| Health check | `heal` only if health/trauma justify it | none | anxious, pristine |
| Sleep preparation | `sleep_ritual` | none | zen, drowsy, stoic |

### Night Activities

| Activity | Current Target | Future Command | Best For |
|---|---|---|---|
| Sleep ritual | `sleep_ritual` | none | most personalities |
| Short rest | `sleep_nap` | none | drowsy, melancholic |
| Calm listening | `bond_listen` | none | anxious, paranoid, shadow/recovery |
| Moon watch | room `space` / `crystal_ball` | `stargaze` only if unique events exist | sage, curious, paranoid |
| Night patrol | room `forest` | `night_patrol` | feral, chaotic if energy high |
| Quiet music | item `music_box` | none | zen, anxious, empath |
| Star smoothie caution | inventory `star_smoothie` only if energy emergency | none | avoid at night generally |
| Nocturnal zoomies | `play` only with high energy and allowed personality | `night_zoomies` | feral, chaotic |
| Protective check | `bond_listen` / `heal` if trauma or health low | `safety_check` | paranoid, anxious |

### Weekend / Special-Day Activities

These are optional later once calendar-aware rules exist:

| Activity | Current Target | Future Command | Best For |
|---|---|---|---|
| Long walk | room deep link | `walk` only with item/event chance | adventurer, feral, empath |
| Room makeover | room/editor deep link | none initially | pristine, empath, curious |
| Treat day | shop/inventory food | none initially | foodie, playful |
| Training streak | `play` / `play_puzzle` | `training_session` only if progression differs | bold, stoic, sage |
| Memory evening | assistant tab | `memory_reflection` | sage, melancholic, empath |

## Activity Richness Requirements

Each period should have at least:

- 2 care activities;
- 2 social/recovery activities;
- 2 active/play activities;
- 2 exploration/environment activities;
- 1 inventory/shop/room activity.

This prevents the pet from always suggesting the same button.

## Dismissal And Cooldown Policy

Ignoring a suggestion must affect future suggestions. Otherwise the pet will feel repetitive.

Suggested state:

```ts
interface DismissedActivityState {
  activityId: string;
  dismissedAt: string;
  cooldownUntil: string;
  dismissCount: number;
}
```

Rules:

- dismissing an activity suppresses the same `activityId` for at least 30 minutes;
- repeated dismissal increases cooldown: 30m -> 2h -> rest of period;
- emergency suggestions ignore dismissal cooldowns;
- period change may clear soft routine dismissals;
- after successful completion, clear dismissal state for that activity;
- do not persist this forever; 7 days of history is enough.

This applies to direct action suggestions and deep-link suggestions.

## Deep Link Lifecycle

Deep links need an explicit pending state. Opening a filtered inventory, room, shop, or assistant view is not the same as completing the pet's requested activity.

Suggested state:

```ts
interface PendingActivityState {
  activityId: string;
  target: ActivityTarget;
  openedAt: string;
  expiresAt: string;
  expectedCompletion:
    | { kind: 'action'; actionId: SupportedPetActionId }
    | { kind: 'inventory_item'; itemId?: string; itemType?: ItemType }
    | { kind: 'room_equipped'; roomId?: string }
    | { kind: 'assistant_viewed' };
}
```

Rules:

- clicking a deep-link CTA creates a pending activity for 1-2 minutes;
- the activity is completed only if the expected action happens before `expiresAt`;
- opening inventory/shop/room and then closing without action does not count as completion;
- if pending expires without completion, apply a soft cooldown to avoid immediately repeating the same suggestion;
- if completed, clear dismissal/cooldown state for that activity and allow after-action feedback;
- direct action CTA does not need pending state because the action itself is the completion signal.

## Fallback Policy

Every period must have a neutral fallback with no CTA. It should appear when no valid activity passes scoring or when all valid activities are cooling down.

Fallback examples:

| Period | Fallback |
|---|---|
| `early_morning` | "Начнем тихо. Я рядом." |
| `morning` | "Какой темп выберем сегодня?" |
| `day` | "Я готов подстроиться под твой день." |
| `evening` | "Можно сделать вечер мягче." |
| `night` | "Тише. Я буду рядом." |

Fallbacks must never hide critical needs.

## Base Routine Rules

These are generic suggestions before personality flavoring:

### Early Morning

- If asleep and energy is high: suggest gentle wake.
- If awake and hunger is below comfortable range: suggest breakfast.
- If awake and bond is low: suggest gentle contact.
- If anxiety/trauma is high: suggest calm breathing or listen together.
- If `pristine`/`stoic`/`zen`: suggest tidy start when cleanliness is below stable range.
- Avoid active play unless energy is high and personality supports it.

### Morning

- Suggest breakfast if hunger is not high.
- Suggest exercise if energy is good.
- Suggest puzzle/learning for curious/orderly styles.
- Suggest walk/exploration for `feral`, `adventurer`, `curious`.
- Suggest confidence praise for `anxious`, `melancholic`, `empath`.
- Suggest inventory-based energy/health support only when owned and justified.
- Suggest social contact if bond is below stable range.

### Day

- Suggest active play if energy is enough.
- Suggest puzzle for curiosity growth.
- Suggest shared play for social growth.
- Suggest room/scene activity based on unlocked rooms.
- Suggest toy rotation if inventory has toys.
- Suggest decoration refresh for orderly/social personalities.
- Suggest shop/inventory exploration for greedy/curious/adventurer styles.
- Suggest food only if hunger is actually low enough.

### Evening

- Suggest bath if cleanliness is below stable range.
- Suggest bond/listen/praise for social recovery.
- Suggest calmer play only if energy and mood are good.
- Suggest music box if owned and the pet is anxious/tired/sad.
- Suggest quiet walk for adventurer/empath/melancholic if energy is not low.
- Suggest room comfort/decorations for drowsy/zen/empath.
- Suggest sleep ritual as evening approaches.

### Night

- Suggest sleep ritual for most personalities.
- Suggest short recovery or listening if stressed.
- Suggest moon watch/stargazing for sage/curious/paranoid when calm.
- Suggest night patrol only for feral/chaotic and only with high energy.
- Avoid food unless hunger is critical.
- Avoid active play for most personalities.
- Allow night activity only for personalities designed around disruption or wildness, and only when energy is high.

## Personality-Specific Rules

The same period should produce different phrasing and action preferences by personality.

### Playful

- Morning: ask for light game or shared play.
- Day: prefer play/social play.
- Evening: calmer shared play.
- Night: avoid overstimulation unless happiness is low and energy is high.

Example: "Утро для игры. Давай разомнемся?"

### Drowsy

- Early morning: prefer gentle wake only when energy is high.
- Morning: slow breakfast or quiet contact.
- Day: nap can be valid earlier than for others.
- Evening/night: sleep ritual has high priority.

Example: "Я проснулся медленно. Давай без суеты."

### Foodie

- Morning: breakfast has high priority.
- Day: food only if hunger dropped, otherwise avoid spam.
- Evening: dinner-style feed if hunger is low.
- Night: do not suggest food unless hunger is critical.

Example: "Утро без завтрака не считается утром."

### Bold

- Morning: exercise/play if energy is high enough.
- Day: active challenge through play.
- Evening: short recovery if energy is low.
- Night: can resist sleep in text, but should still suggest recovery when tired.

Example: "Давай зарядку. Я уже готов."

### Zen

- Early morning: gentle rhythm, bond, or ritual.
- Morning: calm care before activity.
- Day: balanced puzzle or social care.
- Evening/night: sleep ritual strongly preferred.

Example: "Начнем день спокойно и ровно."

### Anxious

- Morning: praise/listen before active tasks.
- Day: safe routine, no chaotic stimulation.
- Evening/night: sleep ritual or listen.
- Avoid night play unless user has deliberately built a different pattern.

Example: "Можно начать тихо? Так мне спокойнее."

### Feral

- Morning: exploration/play.
- Day: active play or room change later.
- Evening/night: night activity can be acceptable if energy is high.
- Bath suggestions should be lower priority unless cleanliness is critical.

Example: "Пахнет новым днем. Пойдем исследовать?"

### Sage

- Morning: puzzle/learning.
- Day: exploration with order.
- Evening: calm puzzle or ritual.
- Night: sleep ritual unless curiosity/evolution target strongly suggests puzzle.

Example: "Утро хорошо подходит для загадки."

### Pristine

- Morning: cleanup if cleanliness dropped.
- Day: orderly care.
- Evening: bath/ritual.
- Night: avoid active mess-making.

Example: "Сначала порядок, потом все остальное."

### Empath

- Morning: hug/praise.
- Day: shared play.
- Evening: listen/bond.
- Night: calm presence and sleep ritual.

Example: "Начнем день рядом?"

### Greedy

- Morning: breakfast if hunger supports it.
- Day: reward-oriented play.
- Evening: avoid overfeeding, prefer useful action.
- Night: rest unless hunger is low.

Example: "Давай начнем с полезного."

### Melancholic

- Morning: gentle bond or praise.
- Day: light shared activity if energy is enough.
- Evening: listen/recovery.
- Night: sleep ritual.

Example: "Давай начнем день тихо, но вместе."

### Chaotic

- Morning: playful suggestion, but not always the same one.
- Day: varied activity.
- Evening: can suggest unusual play if stats are stable.
- Night: night activity allowed only with high energy; otherwise ritual.

Example: "Утро? Отлично. Сделаем что-нибудь не по плану."

### Stoic

- Morning: routine, order, maybe cleanup.
- Day: restrained action, puzzle, or care.
- Evening/night: ritual and recovery.
- Avoid frequent playful suggestions.

Example: "Режим сначала. Потом действуем."

### Adventurer

- Morning: walk/exploration mapped to shared play for now.
- Day: exploration or puzzle.
- Evening: recover after activity.
- Night: avoid new adventure unless energy is high and stress is low.

Example: "День начинается с маршрута."

### Paranoid

- Morning: safe routine, listen, praise.
- Day: predictable action.
- Evening/night: ritual and low stimulation.
- Avoid chaotic/night suggestions.

Example: "Лучше начать с привычного."

### Curious

- Morning: puzzle/learning.
- Day: exploration and new stimuli.
- Evening: calm puzzle.
- Night: sleep ritual unless energy is high and stress is low.

Example: "У меня вопрос к этому утру. Дай загадку?"

## Activity Rules By Personality And Period

This matrix describes the target feel. It is intentionally richer than the executable MVP.

| Personality | Early Morning | Morning | Day | Evening | Night |
|---|---|---|---|---|---|
| `playful` | wake + silly hello | stretch game, breakfast if needed | active play, toy rotation | shared game, praise | sleep ritual unless high energy |
| `drowsy` | slow wake | breakfast, gentle bond | nap, music box | early ritual, cozy room | sleep, no active asks |
| `foodie` | breakfast | breakfast/treat planning | snack only if hungry, shop food | dinner, music | no food unless critical hunger |
| `bold` | charge/exercise | training challenge | active play, competition | recovery after challenge | resists sleep text, still recommends rest |
| `zen` | calm breathing | tidy start, balanced breakfast | puzzle, quiet care | ritual, music | sleep ritual |
| `anxious` | listen/praise | safe routine | predictable puzzle/care | listen, health check | ritual/listen, no stimulation |
| `feral` | sniff route | forest walk | active exploration | patrol if energy high | night patrol/zoomies only if stable |
| `sage` | brain warm-up | puzzle | space observation, memory review | puzzle cooldown | moon watch or ritual |
| `pristine` | tidy start | bath if needed | decoration refresh | bath/comfort | clean sleep ritual |
| `empath` | hug | praise/shared breakfast | shared play | listen/praise | calm presence |
| `greedy` | useful breakfast | plan rewards | coin play/shop | useful action, no waste | rest unless hunger low |
| `melancholic` | gentle bond | praise | light shared play | listen/music | sleep ritual |
| `chaotic` | random light task | unusual play | varied activity/toy rotation | odd but safe activity | night zoomies if energy high |
| `stoic` | routine | tidy start/training | puzzle, restrained play | ritual | sleep |
| `adventurer` | route plan | walk | room exploration | quiet walk/recovery | avoid adventure unless stable |
| `paranoid` | safe routine | listen/predictable care | safety check, controlled puzzle | ritual/check | protective check or ritual |
| `curious` | question/puzzle | brain warm-up | exploration, crystal ball | puzzle cooldown | moon watch if calm |

## Rule Shape

Implementation should use Utility AI scoring with gates and multipliers, not a huge matrix of hard min/max filters and not a pure additive formula. Hard guards are allowed for impossibilities and safety. Multipliers should zero out unavailable or invalid activities.

```ts
type DayPeriod = 'early_morning' | 'morning' | 'day' | 'evening' | 'night';

interface TimeOfDayActivityRule {
  id: string;
  activityId: string;
  target?: ActivityTarget;
  baseScore: number;
  periodWeights: Partial<Record<DayPeriod, number>>;
  personalityWeights?: Partial<Record<PersonalityId, number>>;
  traitWeights?: Partial<Record<TraitKey, number>>;
  behaviorWeights?: Partial<Record<BehaviorAxis, number>>;
  statWeights?: Partial<Record<StatKey, number>>;
  inventoryBonus?: { itemId?: string; itemType?: ItemType; weight: number };
  roomBonus?: { roomId: string; weight: number };
  cooldownPenalty?: number;
  repetitionPenalty?: number;
  hardGuards?: ActivityGuard[];
  gates?: ActivityGate[];
  multipliers?: ActivityMultiplier[];
  message: string;
  reason: string;
}
```

Score model:

```ts
if (hardGuardFails) return null;

rawScore =
  baseScore
  + periodWeight
  + personalityWeight
  + statUrgencyWeight
  + traitOrEvolutionWeight
  + inventoryOrRoomBonus;

score =
  rawScore
  * availabilityMultiplier
  * safetyMultiplier
  * periodCompatibilityMultiplier
  * personalityCompatibilityMultiplier
  * dismissalMultiplier
  * repetitionMultiplier;
```

Multiplier examples:

| Multiplier | When |
|---|---|
| `availabilityMultiplier = 0` | required item is not owned, room is locked, target cannot be opened |
| `safetyMultiplier = 0` | activity would be unsafe for current critical state |
| `periodCompatibilityMultiplier = 0.2-1.5` | activity is weak/strong for current period |
| `personalityCompatibilityMultiplier = 0.3-1.6` | activity conflicts/matches personality |
| `dismissalMultiplier = 0-1` | activity was recently dismissed |
| `repetitionMultiplier = 0.4-1` | activity was recently suggested too often |

Important: stat urgency should not blindly overpower period/personality safety. For example, high energy can increase active-play score, but night active play still gets `periodCompatibilityMultiplier = 0` for most personalities. Only `feral` and `chaotic` can keep that multiplier above zero under safe conditions.

The selector should return the highest valid rule for the current period and pet state. If the target is not directly executable, the UI can show a narrow deep-link CTA, not a generic global navigation CTA.

## Recommended First Slice

Implement:

1. period detection;
2. activity catalog with at least 35 activities;
3. direct executable rules for existing actions;
4. navigation targets for shop, inventory, rooms, and assistant;
5. personality overrides for all personalities at message/ranking level;
6. tests for morning/day/evening/night behavior;
7. tests that critical needs override routine activities;
8. integration into `getProactivePetSuggestion()`.

This proves the richer model without requiring new engine commands immediately.

## Later Engine Commands Worth Adding

These should become real commands if the activity needs unique stat, trait, animation, or event behavior:

| Future Command | Why It Deserves A Command |
|---|---|
| `breathing_ritual` | anxiety recovery without sleep; distinct from bond/sleep |
| `night_patrol` | feral/chaotic night identity without treating it as normal play |
| `memory_reflection` | personality assistant feedback as in-world action, if it affects memories/traits |
| `walk` | only if walking can find items, trigger room events, or create exploration memories |
| `training_session` | only if progression differs from normal play |
| `stargaze` | only if it creates curiosity/order/night memories or events |

Do not add commands for `breakfast`, `dinner`, `treat_day`, or `bath cleanup` unless they get mechanics that generic `feed` / `bathe` cannot represent.

## Open Approval Questions

Before implementation, confirm:

1. Are the period boundaries acceptable?
2. Should "walk" stay mapped to existing actions for now, or should it become a real new command later?
3. Should time-of-day suggestions use real device time in UI, mock time in tests, and command time in engine?
4. Which personalities should get night activity exceptions: only `feral` and `chaotic`, or also `bold`?
5. Should breakfast be suggested when hunger is below 80, below 65, or only below 45?
6. Should deep-link CTAs be allowed in the speech bubble, e.g. "Использовать шкатулку" or "Выбрать игрушку", while generic navigation labels stay out?
7. Which future command should be prioritized first: `breathing_ritual`, `night_patrol`, `memory_reflection`, or mechanic-rich `walk`?

## Proposed Answers For Approval

Recommended decisions:

1. Period boundaries are acceptable for MVP, but implementation must support ±2h adaptive offset.
2. `walk` stays mapped to room/deep-link activity until it has item/event mechanics.
3. UI uses real device time; tests use explicit mock time; engine uses `command.at`.
4. Night activity exceptions are only `feral` and `chaotic`; `bold` may resist sleep in text but should not get night exception mechanics.
5. Breakfast routine can be suggested below hunger 80, but emergency hunger rules still override everything at lower thresholds.
6. Speech bubble should not show generic navigation CTAs; only direct actions or narrow deep links.
7. First future command should be `breathing_ritual`, because it adds a new recovery mechanic without depending on sleep.
