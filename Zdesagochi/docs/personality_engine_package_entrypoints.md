# Personality Package Entrypoints

This repository currently uses source-only local packages. They are not published packages yet.

## Packages

- `@zdesagochi/personality-core`
  - source entrypoint: `packages/personality-core/src/index.ts`
  - owns generic personality engine state, commands, replay, migration, and engine factory API
  - must not import app API types, storage, UI, or legacy `src/personality`

- `@zdesagochi/personality-pet-preset`
  - source entrypoint: `packages/personality-pet-preset/src/index.ts`
  - owns Zdesagochi personality data/defaults and preset runtime defaults
  - may import `personality-core`
  - must not import app API types or legacy `src/personality`

## Current Import Policy

Use relative source entrypoints until package-name resolution is deliberately configured:

- generic reusable API: `packages/personality-core/src`
- Zdesagochi preset/default API: `packages/personality-pet-preset/src`
- app compatibility wrappers with Zdesagochi defaults: explicit modules under `src/personality/*`

Do not import the broad `src/personality` index from app/tests. Use a package entrypoint or an explicit wrapper module instead.

## Package Manifest Policy

The package manifests are intentionally private:

- `"private": true`
- `"version": "0.0.0-private"`
- `"type": "module"`
- `exports["."].types === "./src/index.ts"`
- `exports["."].default === "./src/index.ts"`

They document local package boundaries and future package names. They are not a publish step.

Before converting these to publishable packages, add a real build output policy, generated declarations, package-name import resolution, and package-level integration tests.
