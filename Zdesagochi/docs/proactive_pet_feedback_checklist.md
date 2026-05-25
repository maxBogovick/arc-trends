# Proactive Pet Feedback Checklist

## Implementation Checklist

- [x] Define supported action ids in a shared module.
- [x] Move action execution mapping out of `ActionPanel` so `PetTalk` can trigger the same actions.
- [x] Add `src/personality/proactiveSuggestions.ts`.
- [x] Generate proactive suggestions from needs, recovery states, evolution target, and recommendations.
- [x] Add personality-flavored message variants.
- [x] Keep ordinary mood speech as fallback.
- [x] Update `PetTalk` to render proactive suggestions and optional CTA.
- [x] Wire `PetScene` / `HomePage` so speech CTA can run actions.
- [x] Add after-action feedback from latest explainability record where practical.
- [x] Add or update focused tests for suggestion selection.
- [x] Run `npm run build`.
- [x] Run relevant personality tests or full `npm test` if feasible.
- [ ] Manually inspect UI in local browser. Browser automation was attempted, but the in-app browser policy blocked `http://127.0.0.1:5174/`; do this manually in the app or re-run with an allowed browser target.
- [x] Confirm dev server responds over HTTP.

## Notes While Building

- Reuse `getRecommendedPetActions(pet)` before inventing another recommender.
- Keep texts short: one sentence, ideally under 70 characters.
- Do not add LLM/network dependency in this slice.
- Do not add new pet commands in this slice.
- Avoid making `PetTalk` a store-heavy command dispatcher; pass an action callback down.

## Completion Criteria

- The pet can initiate at least one actionable suggestion.
- The suggestion action performs the same operation as the action panel.
- The system works for ordinary state needs and at least one personality/evolution-driven case.
- The fallback speech still works when there is no actionable suggestion.
