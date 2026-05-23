# Pet Action System Roadmap

Last verified against current architecture on 2026-05-23.

This is a planning document, not an architecture contract. It can change when product priorities or playtest findings change.

Architecture rules live in `docs/pet_action_system_architecture.md`. The action spec template lives in `docs/pet_action_system_action_template.md`.

## Current Problem

The current action set is too small and too generic:

- feed;
- play;
- sleep/wake;
- bathe;
- heal;
- bond;
- add/use item.

These actions work technically, but they do not give the player enough ways to intentionally shape personality.

## Product Direction

Move from flat actions to training styles:

- different play styles;
- different bonding styles;
- routines and recovery;
- exploration;
- item-oriented behavior.

The first goal is not many actions. The first goal is proving that variants produce distinct personality and behavior evidence.

## Recommended First Slice

Start with four actions:

1. `play:active`
2. `play:puzzle`
3. `bond:listen`
4. `sleep:ritual`

Why these first:

- they reuse existing command families;
- they cover different behavior axes;
- they create clear player choices;
- they exercise assistant explanations;
- they avoid inventory complexity in the first slice.

Expected differences:

| Action | Main intent | Personality direction | Behavior direction |
|---|---|---|---|
| `play:active` | Spend energy and train liveliness | vitality, curiosity, lower order | play, slight disruption |
| `play:puzzle` | Train curiosity and patience | curiosity, order | play, exploration, order |
| `bond:listen` | Calm and repair trust | lower caution, sociality | recovery, social |
| `sleep:ritual` | Reinforce stable routine | order, lower caution | order, recovery, care |

## Candidate Backlog

### Play

- `play:social`: cooperative play, sociality and play evidence.
- `play:chaos`: not approved until it has mechanics beyond "active play with more disruption".

### Bond

- `bond:hug`: explicit warm-contact variant compatible with current bond.
- `bond:praise`: confidence/social warmth.
- `bond:boundary`: risky order-building action, requires careful assistant warning.

### Routine

- `wake:gentle`: safer wake style.
- `wake:forceful`: risky wake style, requires trauma/recovery tests.
- `sleep:nap`: short recovery.

### Exploration

- `explore:room`: room curiosity.
- `explore:inspect_item`: curiosity/order around items.
- `explore:new_thing`: risky discovery, not first slice.

### Items

- `items:rotate_toys`: diverse item exposure.
- `items:organize`: order around inventory.
- `items:repeat_favorite`: repeated item style.

## Release Planning Rules

- Prefer 3-5 actions per slice.
- Do not add risky trauma-increasing actions before assistant warnings and recovery tests exist.
- Do not add many UI actions before recommendations/categories are ergonomic.
- Do not add backend-supported variants without backend parser/logging and Rust parity plan.
- If priorities change, update this roadmap without changing the architecture contract.

## Playtest Questions

Use these questions to decide whether an action should stay:

- Can players predict why they would choose it?
- Does the assistant explain its personality effect clearly?
- Does it differ from the nearest action in more than label and animation?
- Does repeated use form a recognizable style?
- Does it make the action panel more interesting without making it harder to scan?

## Known Technical Dependencies

- action variant support in command contracts;
- influence data support for behavior evidence if not already expressive enough;
- assistant aggregation by `type:variant`;
- action recommendation selector;
- backend command log includes `variant`;
- Rust parity for backend-applied variants;
- payload-hash idempotency remains backend hardening work.
