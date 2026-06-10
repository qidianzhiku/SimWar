# Postgres Decision Mapping Gaps

## Context

- Postgres adapter already has query helpers, courses read mapping, runs read
  mapping, and rounds read mapping.
- Decision mapping is intentionally not implemented yet.
- Decisions affect settlement truth and replay hash inputs, so they require
  stricter parity before adapter code.

## Current Repository Contract

The current decision repository boundary is defined in
`services/api/src/repository-ports.ts`.

| Method                             | Category | Purpose                                                                         | Return behavior                              |
| ---------------------------------- | -------- | ------------------------------------------------------------------------------- | -------------------------------------------- |
| `getDecisionById`                  | Read     | Load one decision by `tenant_id` and `decision_id`.                             | Returns `Decision` or `null`.                |
| `getCanonicalDecisionForTeamRound` | Read     | Load the canonical/submitted decision for one tenant, run, round, and team.     | Returns `Decision` or `null`.                |
| `listDecisionsForRound`            | Read     | List decisions for one tenant, run, and round.                                  | Returns `Decision[]`; empty when none match. |
| `saveCanonicalDecision`            | Write    | Persist a complete canonical `Decision` object.                                 | Resolves after the object is stored.         |
| `saveDecision`                     | Write    | Persist a submitted `Decision` exactly as produced by the current command path. | Resolves after the object is stored.         |

The shared `Decision` contract requires `decision_id`, `tenant_id`, `run_id`,
`round_id`, `round_no`, `team_id`, `status`, `version`, `payload`,
`validation_report`, and `submitted_by`. Optional fields are `canonical_source`,
`merge_commit_id`, and `team_confirmation_id`.

## Current JSON Adapter Behavior

The current JSON adapter behavior is defined in
`services/api/src/json-repository-adapter.ts`.

- The full `Decision` object is preserved.
- `getDecisionById` returns the first matching decision for `tenant_id` and
  `decision_id`.
- `listDecisionsForRound` filters by `tenant_id`, `run_id`, and `round_id`.
- `getCanonicalDecisionForTeamRound` returns the first submitted matching
  decision for `tenant_id`, `run_id`, `round_id`, and `team_id`.
- `saveDecision` and `saveCanonicalDecision` upsert/persist the full `Decision`
  unchanged by `tenant_id` and `decision_id`.
- Settlement currently relies on existing in-memory/store decision behavior and
  latest version selection in the runtime path.

## Current Postgres Schema

The current Postgres migration skeleton defines the `decisions` table with these
confirmed columns:

- `id`
- `decision_id`
- `tenant_id`
- `run_id`
- `round_id`
- `team_id`
- `version`
- `status`
- `canonical_source`
- `merge_commit_id`
- `team_confirmation_id`
- `payload`
- `metadata`
- `created_at`
- `updated_at`

Current gaps:

- No explicit `round_no` column.
- No explicit `validation_report` column.
- No explicit `submitted_by` column.
- JSONB layout for the full `Decision` is not specified.
- Write storage layout for `saveDecision` and `saveCanonicalDecision` is not
  specified.

## Replay and Settlement Risks

Decisions are replay and settlement truth inputs. Any Postgres decision mapping
must preserve the current truth chain before runtime wiring.

- Do not change replay hash generation.
- Do not change `buildReplayHash` inputs.
- Do not change canonical/latest decision selection.
- Do not change settlement result shape.
- Do not allow role drafts, AI advice, or learning evidence into settlement
  truth.
- Do not implement Postgres runtime wiring yet.

## Blocking Questions

1. Should `round_no` be an explicit `decisions` column, or derived from
   `simulation_rounds`?
2. Should `validation_report` be an explicit JSONB column or nested inside
   `payload`/`metadata`?
3. Should `submitted_by` be an explicit column?
4. What is the canonical storage layout for the full `Decision` object?
5. Which decision selection rule must Postgres exactly match for settlement:
   repository canonical lookup, latest version, or existing store behavior?
6. How should `saveDecision` and `saveCanonicalDecision` preserve version
   ordering?
7. What parity tests are required before runtime wiring?

## Recommended PR Split

1. `docs/schema: specify Decision persistence layout`
2. `db: add explicit decisions read/write columns if required`
3. `api: add Postgres decisions read mapping`
4. `api: add Postgres decisions write mapping`
5. `test: add decision parity tests for canonical/latest selection`
6. `test: add replay/settlement no-regression guardrails`
7. `ops: add disposable Postgres verification before runtime wiring`

## Not In Scope

This document PR does not:

- Modify adapter code.
- Modify migrations.
- Modify provider selection.
- Connect Postgres runtime.
- Change JSON adapter behavior.
- Change API handlers.
- Change settlement logic.
- Change `replay_hash`.
