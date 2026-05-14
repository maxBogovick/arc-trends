# Personality Balance Simulation Report

Generated at: 2026-05-14T10:55:00.513Z

## Summary

| Scenario | Status | Key metrics |
|---|---|---|
| Formation speed | pass | commandsToFormation: 156<br>simulatedDays: 20<br>formationThreshold: 200 |
| Evolution proposal speed | pass | stableChecksToProposal: 72<br>expectedStabilitySyncs: 72<br>targetPersonality: paranoid |
| Shadow entry and recovery | pass | traumaToEnter: 80<br>catharsisSteps: 4<br>cooldownSet: true |
| Singularity rarity and collapse | pass | syncsToSingularity: 48<br>zonesAtEntry: 3<br>collapsedTo: chaotic |
| Memory generation rate | pass | rareMemoriesAcrossCoreScenarios: 6<br>expectedMinimum: 4 |

## Details

### Formation speed

Status: pass

| Metric | Value |
|---|---|
| commandsToFormation | 156 |
| simulatedDays | 20 |
| formationThreshold | 200 |
| formedPersonality | playful |
| rareMemories | 3 |

- Balanced action loop should form a personality without requiring backend or UI state.

### Evolution proposal speed

Status: pass

| Metric | Value |
|---|---|
| stableChecksToProposal | 72 |
| expectedStabilitySyncs | 72 |
| targetPersonality | paranoid |
| readiness | 100 |

- A stable off-home trait vector proposes evolution at the configured stability window.

### Shadow entry and recovery

Status: pass

| Metric | Value |
|---|---|
| traumaToEnter | 80 |
| catharsisSteps | 4 |
| cooldownSet | true |
| rareMemories | 1 |

- Four 25-point catharsis ticks should recover from shadow form.

### Singularity rarity and collapse

Status: pass

| Metric | Value |
|---|---|
| syncsToSingularity | 48 |
| zonesAtEntry | 3 |
| collapsedTo | chaotic |
| rareMemories | 2 |

- Singularity requires the configured threshold and collapses only after leaving the tie zone.

### Memory generation rate

Status: pass

| Metric | Value |
|---|---|
| rareMemoriesAcrossCoreScenarios | 6 |
| expectedMinimum | 4 |

- Formation, catharsis, singularity entry, and singularity collapse all leave durable rare memories.

## Interpretation

- Formation, evolution proposal, shadow recovery, singularity, and rare memory generation are reproducible through deterministic simulation.
- This report is a balance proof artifact, not a replacement for product analytics.
- Warnings should be investigated before changing trait deltas, thresholds, or cooldowns.

