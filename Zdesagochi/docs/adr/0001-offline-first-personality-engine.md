# ADR 0001: Offline-first shared personality engine

## Status

Accepted.

## Context

Zdesagochi must allow a player to keep caring for, developing, and talking to a pet when there is no internet connection. This includes local actions, stat changes, personality drift, Core Memories, sleep lifecycle, emergent states, and future conversation features.

At the same time, future online features need server authority for economy, leaderboards, multiplayer, LiveOps balance, remote registries, anti-abuse checks, and cross-device account state.

The current implementation already has a TypeScript personality/evolution module under `src/personality`. The risk is letting that become browser/UI-specific code, which would make future backend validation and replay harder.

## Decision

Implement the personality and evolution rules as an offline-first shared TypeScript simulation engine.

The engine should be deterministic and independent from React, Zustand, browser storage, `fetch`, and UI concerns. It should take state, a command, time, and registry data as inputs, and return updated state plus domain events.

The frontend may run this engine locally while offline. A future backend should run the same engine, or a compatible package built from the same source, to validate and synchronize offline progress.

This is not a decision to make the frontend the permanent sole authority. It is a decision to make the simulation portable and usable offline.

## Boundaries

- Domain logic belongs in a shared personality core, not in React components or store actions.
- UI displays state and dispatches commands; it does not own evolution math.
- Mock API is an adapter for local development and offline play, not the long-term source of domain rules.
- Network loading, registry fetch/cache, persistence, and synchronization are infrastructure concerns outside the pure engine.
- Memory text can be generated locally, but the structured memory event must remain machine-readable and replayable.

## Offline Persistence Model

Offline state should be stored as:

- latest pet snapshot;
- append-only command log;
- last synced command id;
- personality engine version;
- influence registry version;
- local timestamps needed for sleep and sync lifecycle.

Commands should be idempotent and carry stable ids, for example:

```typescript
type PetCommand =
  | { type: 'feed'; foodId: string; at: string; commandId: string }
  | { type: 'play'; scoreSeed: string; at: string; commandId: string }
  | { type: 'sleep'; at: string; commandId: string }
  | { type: 'wake'; at: string; commandId: string }
  | { type: 'bond'; at: string; commandId: string }
  | { type: 'sync'; at: string; commandId: string };
```

## Synchronization Policy

When connectivity returns, the client sends unsynced commands to the backend.

The backend should validate or replay the command log and return canonical state. Personal pet progress should be accepted leniently when possible. Competitive, economy, social, and multiplayer effects should be validated strictly and capped where needed.

If client and server results diverge, reconciliation should avoid harsh emotional rollbacks. Prefer compensating domain events or reward caps over deleting memories or undoing visible pet development unless there is clear corruption or abuse.

## Time Policy

Offline simulation may use client time so the pet remains playable without internet.

A future backend should detect anomalies such as large clock jumps and cap server-authoritative rewards. Suspicious time should not make the pet unusable, but it may limit economy, leaderboard, LiveOps, or multiplayer outcomes.

## Registry Policy

The simulation engine should receive the influence registry and balance patches as data. Fetching remote registry data, caching it, and choosing fallback versions should live outside the engine.

When offline, the client uses the last valid cached registry. If there is no cached remote registry, static registry rules remain enough for normal pet care.

## Consequences

Positive:

- Full offline care remains possible.
- The same rules can later run on the backend.
- Tests can exercise the engine without browser or server dependencies.
- Future sync can replay structured commands instead of trusting opaque snapshots.

Tradeoffs:

- More upfront discipline is needed around module boundaries.
- Some online outcomes need reconciliation after offline play.
- Competitive/economy features need separate validation rules.

## Implementation Guidance

- Keep `src/personality` free of React, Zustand, and storage dependencies.
- Move browser-specific helpers such as remote `fetch` and `window.ai` behind adapters when extracting the shared core.
- Gradually move action orchestration out of `MockApiService` into command handlers.
- Add new features first as core commands and domain events, then wire them to UI/API adapters.
