# Personality Library API

## Packages

- `packages/personality-core/src` — state, commands, events, engine factory, migration, versions.
- `packages/personality-pet-preset/src` — Zdesagochi virtual pet preset.

These are package-like local boundaries. They are not published npm packages yet.

## Core Concepts

- `PersonalityState` — serializable engine-owned state.
- `PetCommand` — deterministic command input.
- `PetCommandResult` — next state, domain events, gameplay deltas, modifiers, versions.
- `createPersonalityEngine(config)` — creates an engine instance.
- `migratePersonalityState(raw)` — validates and upgrades state snapshots to the current schema.

## Versions

- `PERSONALITY_STATE_SCHEMA_VERSION` — serialized state contract version.
- `PERSONALITY_ENGINE_VERSION` — engine behavior version.
- `STATIC_REGISTRY_VERSION` — bundled registry/preset data version.

Persist all three with command results or save snapshots when possible.

## Package Exports Policy

Core exports must stay storage-agnostic, UI-agnostic, backend-agnostic, and browser-agnostic.

Do not export from core:

- app `Pet` / `Account`;
- `localStorage` helpers;
- `LocalSave`;
- `SyncQueue`;
- backend replay adapters;
- React/UI code;
- `mockApi`.

App adapters live under `src/api`.
