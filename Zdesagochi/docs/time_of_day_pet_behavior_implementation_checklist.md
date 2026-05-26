# Time Of Day Pet Behavior Implementation Checklist

## Scope

Implement the approved time-of-day activity design as a deterministic proactive suggestion layer.

## Checklist

- [x] Add period detection with adaptive schedule support.
- [x] Extract full behavior config into `src/personality/timeOfDayActivityConfig.ts`.
- [x] Keep `timeOfDayActivities.ts` as execution engine only.
- [x] Add typed config patch support for periods, fallbacks, scoring, defaults, rules, rule overrides, and disabled activity ids.
- [x] Add JSON Schema for external config patch validation.
- [x] Add visual rule editor for activity disable/multiplier tuning.
- [x] Add server-side structural validation for `timeOfDayConfigPatch`.
- [x] Add boundary spam guard.
- [x] Add Utility AI scoring with hard guards and multipliers.
- [x] Add an expanded activity catalog.
- [x] Support direct action targets.
- [x] Support narrow deep-link targets.
- [x] Add dismissal cooldown state.
- [x] Add pending deep-link lifecycle state.
- [x] Add persisted schedule learning from daily app opens.
- [x] Add timezone-travel reset for learned schedule state.
- [x] Add quiet-hours suppression for routine suggestions.
- [x] Add suggestion analytics for shown/opened/dismissed/completed.
- [x] Add runtime tuning config for activity weights and disabled activities.
- [x] Add debug report for winning and suppressed candidates.
- [x] Add UI panel for routine settings, analytics, and debug inspection.
- [x] Add remote config loading from URL with local cache.
- [x] Add local admin JSON config override.
- [x] Add stable A/B cohort assignment.
- [x] Add cohort-specific score multipliers.
- [x] Add analytics JSON export.
- [x] Add deterministic copy variants for repeated activities.
- [x] Add backend proactive config endpoints.
- [x] Add backend analytics ingestion endpoint.
- [x] Add backend admin analytics/audit endpoints.
- [x] Add admin authorization through `PROACTIVE_ADMIN_EMAILS`.
- [x] Add backend audit log for config publishing.
- [x] Add backend config signature generation.
- [x] Add client-side signature verification helper.
- [x] Add frontend integration for backend publish/load/analytics upload.
- [x] Integrate with proactive pet suggestions.
- [x] Wire UI CTA handling.
- [x] Add tests for period detection.
- [x] Add tests proving centralized config drives behavior.
- [x] Add tests for declarative config patch overrides.
- [x] Add tests documenting JSON Schema externally editable fields.
- [x] Add tests for critical needs overriding routine suggestions.
- [x] Add tests for scoring gates/multipliers.
- [x] Add tests for deep-link pending completion.
- [x] Add tests for dismissal cooldowns.
- [x] Add tests for schedule learning.
- [x] Add tests for quiet hours.
- [x] Add tests for runtime tuning and debug candidates.
- [x] Add tests for analytics/settings persistence.
- [x] Add tests for copy variants.
- [x] Add tests for remote config merge and cohort tuning.
- [x] Add tests for A/B cohort persistence and analytics export.
- [x] Add tests for remote config signature verification.
- [x] Run `npm run build`.
- [x] Run `npm test`.
- [x] Run `cargo check`.

## Evidence To Capture

- Files changed: frontend proactive modules/UI/API/store/tests plus `src/personality/timeOfDayActivityConfig.ts` and backend config/router/handlers/db/migration/OpenAPI.
- Tests added: period/adaptive offset/timezone reset, critical priority over after-action/routines, preventive breakfast, availability multipliers, night exceptions, dismissal cooldown, pending deep-link completion, boundary guard, schedule learning, quiet hours, runtime tuning, debug candidates, analytics/settings persistence, copy variants, remote config merge, cohort tuning, A/B cohort persistence, analytics export, signature verification.
- Build/test commands and results: `npm run build` passed; `npm test` passed; `cargo check` passed.
- Known limitations: admin role source is environment-based (`PROACTIVE_ADMIN_EMAILS`), and signature uses a shared verification secret model rather than public-key signatures.
- Follow-up suggestions the user did not explicitly request: move admin roles into DB, rotate signing keys, add server-side config schema validation beyond required `version`, and add dashboard charts over ingested analytics.
