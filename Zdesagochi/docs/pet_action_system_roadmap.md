# Pet Action System Roadmap

Last verified against current architecture on 2026-05-24.

This is a planning document, not an architecture contract. It can change when product priorities or playtest findings change.

Architecture rules live in `docs/pet_action_system_architecture.md`. The action spec template lives in `docs/pet_action_system_action_template.md`.

## Current Progress

Implemented production action slices:

- `play:active`;
- `play:puzzle`;
- `play:social`;
- `bond:listen`;
- `bond:praise`;
- `sleep:ritual`;
- `sleep:nap`;
- `wake:gentle`.

Implemented UI/recommendation slice:

- action panel shows 3-5 recommended actions first;
- recommendations are computed from pet state, assistant guidance, and engine evidence;
- complete actions are grouped by Care, Play, Bond, Routine, Items;
- the complete list is behind progressive disclosure;
- existing variants still call their existing command variants;
- no new UI-only pet actions were added.

## Current Problem

The current action set is too small and too generic:

- feed;
- play;
- sleep/wake;
- bathe;
- heal;
- bond;
- add/use item.

These actions work technically, and the first two action slices now prove distinct training styles. The next product gap is safe exploration and clearer item-oriented recommendations, not another flat list of buttons.

## Product Direction

Move from flat actions to training styles:

- different play styles;
- different bonding styles;
- routines and recovery;
- exploration;
- item-oriented behavior.

The first goal is not many actions. The first goal is proving that variants produce distinct personality and behavior evidence.

## Completed First Slice

Completed actions:

1. `play:active`
2. `play:puzzle`
3. `bond:listen`
4. `sleep:ritual`

Why these were first:

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

- `play:social`: implemented.
- `play:chaos`: not approved until it has mechanics beyond "active play with more disruption".

### Bond

- `bond:hug`: explicit warm-contact variant compatible with current bond.
- `bond:praise`: implemented.
- `bond:boundary`: risky order-building action, requires careful assistant warning.

### Routine

- `wake:gentle`: implemented.
- `wake:forceful`: risky wake style, requires trauma/recovery tests.
- `sleep:nap`: implemented.

### Exploration

- `explore:room`: room curiosity.
- `explore:inspect_item`: curiosity/order around items.
- `explore:new_thing`: risky discovery, not first slice.

Recommended next safe engine slice:

1. Decide command shape: new `explore` command family versus room/item command variants.
2. Specify stat, trait, behavior, blocker, and explainability output for `explore:room`.
3. Specify how `explore:inspect_item` relates to existing `use_item` and item diversity behavior.
4. Add TS engine tests first, then Rust parity if backend replay applies the commands.
5. Update backend direct endpoint and offline sync support together if backend receives the new commands.

### Items

- `items:rotate_toys`: diverse item exposure.
- `items:organize`: order around inventory.
- `items:repeat_favorite`: repeated item style.

Current note:

- item add/use behavior already exists and is tested;
- these backlog items should not become UI-only buttons unless they map to real item commands or variants;
- item-specific recommendations need an inventory-aware policy before they should appear as recommended actions.

## Release Planning Rules

- Prefer 3-5 actions per slice.
- Do not add risky trauma-increasing actions before assistant warnings and recovery tests exist.
- Recommendations/categories are now ergonomic enough for the next small safe slice; keep the panel grouped by intent.
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

- action variant support in command contracts: done for current variants;
- influence data support for behavior evidence: done for current variants;
- assistant aggregation by `type:variant`: done for current variants;
- action recommendation selector: done for current action panel;
- backend command log includes `variant`: done for accepted direct actions and sync results;
- Rust parity for backend-applied variants: done for current variants;
- payload-hash idempotency remains backend hardening work.

## UI Recommendation Rules

The action panel recommendation selector should keep these constraints:

- recommend only supported action ids that map to real engine behavior or existing item flows;
- rank urgent pet state above generic personality shaping;
- use engine evidence such as trauma, confused state, emergent state, traits, and behavior profile;
- use assistant target guidance only as a signal, not as an excuse to show unsupported variants;
- keep risky actions out until trauma/recovery/warning policy and tests exist.
