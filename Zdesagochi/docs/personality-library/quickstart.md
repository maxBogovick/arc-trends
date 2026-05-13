# Personality Library Quickstart

```ts
import {
  createPersonalityEngine,
  migratePersonalityState,
  type PersonalityState,
} from '../packages/personality-core/src';
import { zdesagochiPetPreset } from '../packages/personality-pet-preset/src';

const engine = createPersonalityEngine(zdesagochiPetPreset);
const migrated = migratePersonalityState(savedState);

if (!migrated.ok) {
  throw new Error(`Unsupported personality state: ${migrated.reason}`);
}

const result = await engine.applyCommand(migrated.state, {
  type: 'feed',
  foodId: 'apple',
  at: new Date().toISOString(),
  commandId: crypto.randomUUID(),
});

const nextState: PersonalityState = result.pet;
```

Runnable local proof:

```bash
npm run demo:personality-core
```

The demo imports only the package-like core and preset entrypoints.
