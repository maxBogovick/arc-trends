# Pet Action Design Template

Last verified against current architecture on 2026-05-23.

Use this template when adding or changing a pet action. Keep it short for simple actions. Expand only when the action touches backend replay, risky emotional mechanics, inventory, or new command families.

Architecture rules live in `docs/pet_action_system_architecture.md`.

## Lightweight Action Spec

```md
## Action

Id:
Family:
Variant:
Player intent:

Immediate effect:
Personality effect:
Behavior evidence:
Risk/blocking:
Explainability:
Tests:
```

## Field Guidance

### Id

Stable internal id, for example `action:play:puzzle`.

### Family

Stable command family, for example `play`, `bond`, `sleep`, `wake`, `use_item`.

### Variant

Action style inside a family. Leave empty only when updating legacy behavior without adding a new style.

### Player Intent

One sentence explaining why a player would choose this action now.

Good:

- "Train curiosity without exhausting the pet."
- "Calm a tense pet through emotional repair."

Bad:

- "Another play button."
- "Makes the pet happy."

### Immediate Effect

Stats, rewards, inventory, or blocking changes visible right away.

### Personality Effect

Trait direction and why it represents identity change.

Example:

- `curiosity +`, because the action trains investigation.
- `order +`, because the action reinforces routine.

### Behavior Evidence

Long-term player style evidence.

Example:

- `exploration +`, because the player repeatedly offers discovery.
- `recovery +`, because the player repeatedly repairs emotional state.

### Risk/Blocking

Cooldowns, sleep restrictions, low-energy restrictions, trauma risk, inventory ownership, or "none".

Use "none" only when there is no plausible risk or restriction beyond normal command validity.

### Explainability

Player-facing sentence the assistant can use after the action.

Example:

> Puzzle play trained curiosity and patience, so it nudged the pet toward a more thoughtful style.

### Tests

Name the tests needed. Do not list every global command by default.

Minimum useful tests:

- action changes expected traits/behavior;
- action differs from nearest similar action;
- replay is deterministic if command shape changed;
- backend/Rust tests if backend applies it.

## Escalation Add-ons

Add these sections only when relevant.

### Backend Add-on

```md
Backend endpoint:
Sync support:
Command log shape:
Rejected/blocked policy:
Rust parity:
```

### Risk Add-on

```md
Risk reason:
Trauma/catharsis effect:
Mitigation action:
Accumulation test:
Recovery test:
Assistant warning:
```

### Inventory/Item Add-on

```md
Item requirement:
Item kind:
Inventory mutation:
Item-style counter impact:
Failed-use rollback:
```

### New Command Family Add-on

```md
Why variant is not enough:
Command payload:
Legacy compatibility:
Offline replay:
Backend parser:
Migration:
```

## Example: Simple Variant

```md
## Action

Id: action:play:puzzle
Family: play
Variant: puzzle
Player intent: Train curiosity and patience without spending as much energy as active play.

Immediate effect: moderate happiness gain, small energy cost, normal XP, no coins bonus.
Personality effect: curiosity +, order +, vitality - small.
Behavior evidence: play +, exploration +, order +.
Risk/blocking: blocked while asleep; weak when pet energy is critically low.
Explainability: Puzzle play trained curiosity and patience, so it moved the pet toward a more thoughtful style.
Tests: differs from play:active in trait and behavior evidence; deterministic replay; assistant groups it separately.
```

## Example: Risky Variant

```md
## Action

Id: action:wake:forceful
Family: wake
Variant: forceful
Player intent: Interrupt sleep immediately when the player accepts stress risk.

Immediate effect: wakes pet, small energy disruption, no reward.
Personality effect: caution +, order -, vitality + small.
Behavior evidence: disruption +.
Risk/blocking: only available while asleep; adds trauma when sleep was short.
Explainability: Forceful waking interrupted recovery, making the pet more guarded and less stable.
Tests: differs from wake:gentle; repeated use accumulates risk; recovery action can reduce risk; backend rejects/accepts consistently.

### Risk Add-on

Risk reason: abrupt interruption during recovery.
Trauma/catharsis effect: trauma increases only when sleep duration is below safe threshold.
Mitigation action: bond:listen or sleep:ritual.
Accumulation test: repeated short forceful wakes increase caution/trauma.
Recovery test: mitigation reduces trauma pressure.
Assistant warning: "This wakes the pet now, but repeated abrupt waking can make it guarded."
```
