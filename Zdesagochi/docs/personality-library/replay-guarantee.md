# Replay Guarantee

Replay is deterministic when the caller provides the same:

- initial `PersonalityState`;
- ordered command list;
- command ids;
- command timestamps;
- state schema version;
- engine version;
- registry version;
- preset/config;
- RNG behavior when a command path needs RNG.

The replay contract is:

```ts
const engine = createPersonalityEngine(zdesagochiPetPreset);
const replay = await engine.replay(initialState, commands, runtime);
```

The returned `PersonalityReplayResult` includes:

- final state;
- ordered command results;
- accumulated domain events;
- influence cooldowns;
- current sync counter;
- state schema version;
- engine and registry versions.

Storage, sync queue persistence, and backend acknowledgement are app-side concerns. They are intentionally not part of the core replay guarantee.
