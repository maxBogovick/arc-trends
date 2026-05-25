# Proactive Pet Feedback Design

## Goal

Make the pet feel self-directed: it should occasionally propose useful next steps to the user and explain what changed after actions. The first version must reuse the existing deterministic personality and recommendation systems instead of adding an LLM or a separate dialogue backend.

## Product Scope

The pet should be able to:

- suggest one immediate action when there is a strong state, personality, or evolution reason;
- explain the suggestion in short pet-facing language;
- expose a direct action button when the suggestion maps to a supported action;
- fall back to ordinary mood speech when no suggestion is important;
- give brief after-action feedback when the latest command changed stats, traits, behavior, or evolution readiness.

Out of scope for the first implementation:

- free-form chat;
- network AI generation;
- long conversations;
- new backend endpoints;
- new gameplay commands.

## Existing Systems To Reuse

- `src/personality/guidanceSelectors.ts`
  - already computes `getRecommendedPetActions(pet)`;
  - already maps state, engine evidence, and target guidance to action ids.
- `src/components/Pet/PetTalk.tsx`
  - already renders the speech bubble;
  - currently only picks mood/stat messages.
- `src/components/Actions/ActionPanel.tsx`
  - already maps action ids to concrete store actions;
  - currently owns action handling locally.
- `src/api/explainability.ts`
  - stores command outcomes and domain events;
  - can power after-action feedback in mock/offline UI.

## Design Rules

1. Suggestions are deterministic and derived from current pet state.
2. Suggestions must not point to actions that the UI cannot run.
3. Critical needs beat personality training.
4. Personality/evolution suggestions beat generic mood chatter.
5. Speech should stay short enough for the existing bubble.
6. Components should render the suggestion; domain selection belongs in a personality module.
7. If an action is disabled, the suggestion should degrade to speech without a CTA or choose another action.

## Suggested Data Model

```ts
export interface ProactivePetSuggestion {
  id: string;
  message: string;
  actionId?: SupportedPetActionId;
  reason: string;
  priority: number;
  source: 'need' | 'personality' | 'evolution' | 'recovery' | 'after_action' | 'mood';
  tone: 'urgent' | 'gentle' | 'playful' | 'proud' | 'neutral';
}
```

## Priority Order

1. blocked/special states: sleeping, confused, shadow, high trauma;
2. critical stats: hunger, health, energy, cleanliness, bond;
3. active evolution target or current target zone;
4. strongest recommendation from `getRecommendedPetActions`;
5. personality-flavored mood speech.

## UI Direction

The speech bubble may show:

- pet message;
- small CTA button only when the action is valid;
- no large explanation text inside the scene.

The full action grid remains in `ActionPanel`.

## Verification

- TypeScript build passes.
- Existing personality tests pass.
- The home screen renders with and without suggestions.
- The speech bubble does not overflow on short desktop/mobile widths.
- Sleeping pet does not offer impossible actions.
- Suggested action buttons execute the same store methods as the action panel.
