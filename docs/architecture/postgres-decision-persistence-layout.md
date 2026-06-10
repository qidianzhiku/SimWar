# Postgres Decision Persistence Layout

## Purpose

This document defines the intended persistence layout for future Postgres decision mapping before any adapter code, migrations, provider selection, or runtime wiring changes. It turns the current decision mapping gaps into an explicit storage contract for later small PRs.

The layout is documentation-only. It does not mean the Postgres adapter can read or write decisions yet, and it does not connect Postgres to runtime.

## Decision Contract Fields

Required `Decision` fields:

- `decision_id`
- `tenant_id`
- `run_id`
- `round_id`
- `round_no`
- `team_id`
- `status`
- `version`
- `payload`
- `validation_report`
- `submitted_by`

Optional `Decision` fields:

- `canonical_source`
- `merge_commit_id`
- `team_confirmation_id`

## Proposed Column Layout

Future Postgres decision persistence should use explicit columns for the fields that are needed for repository mapping, version ordering, and settlement truth reads:

- `decision_id`
- `tenant_id`
- `run_id`
- `round_id`
- `round_no`
- `team_id`
- `version`
- `status`
- `submitted_by`
- `canonical_source`
- `merge_commit_id`
- `team_confirmation_id`
- `payload`
- `validation_report`
- `metadata`
- `created_at`
- `updated_at`

Layout notes:

- `payload` should preserve the business decision payload exactly.
- `validation_report` should be stored separately as JSONB to avoid ambiguity.
- `submitted_by` should be an explicit text column.
- `round_no` should be an explicit integer column to avoid joins during decision truth reads.
- `metadata` is for non-contract persistence metadata only, not settlement truth inputs.

## Write Behavior

Future write mapping should preserve current repository parity:

- `saveDecision` persists the complete `Decision` object without reshaping business payload.
- `saveCanonicalDecision` persists the complete canonical `Decision` object.
- Upsert identity remains `tenant_id + decision_id`.
- `version` must be preserved exactly.
- Write mapping must not reorder, rewrite, or infer version history.

`saveDecision` and `saveCanonicalDecision` may share the same persistence layout, but they must not change the meaning of canonical selection, submitted versions, or role-derived merge metadata.

## Read Behavior

Future read mapping should reconstruct the shared `Decision` contract from explicit columns plus the documented JSONB columns:

- `getDecisionById` filters by `tenant_id + decision_id`.
- `listDecisionsForRound` filters by `tenant_id + run_id + round_id`.
- `getCanonicalDecisionForTeamRound` must exactly match the documented JSON adapter semantics until a separate parity PR changes it.

Read mapping must not infer missing required fields from unrelated tables unless a later schema PR documents that relationship and adds parity tests.

## Canonical / Latest Decision Boundary

Repository canonical lookup and settlement latest version selection must not be silently unified.

Current risk points:

- The repository port exposes `getCanonicalDecisionForTeamRound`.
- The current settlement path relies on existing in-memory/store behavior and latest version selection.
- Decisions are settlement and replay hash inputs.

Any change to canonical/latest behavior requires dedicated tests and a separate PR. Postgres runtime wiring cannot happen until canonical/latest parity tests exist.

## Replay and Settlement Truth Rules

Future decision persistence must preserve the settlement truth chain:

- Do not change `replay_hash` generation.
- Do not change `buildReplayHash` inputs.
- Do not change settlement result shape.
- Do not allow role drafts into settlement truth.
- Do not allow AI advice into settlement truth.
- Do not allow learning evidence into settlement truth.
- `Decision.payload` and `Decision.validation_report` are truth inputs only when they match the existing `Decision` contract path.

## Future PR Split

1. `db: add explicit Postgres decision persistence columns`
2. `api: add Postgres decisions read mapping`
3. `api: add Postgres decisions write mapping`
4. `test: add canonical/latest decision parity tests`
5. `test: add replay/settlement no-regression tests`
6. `ops: add disposable Postgres decision verification before runtime wiring`

## Not In Scope

This PR does not:

- Modify migrations.
- Modify adapter code.
- Modify JSON adapter behavior.
- Modify provider selection.
- Connect Postgres runtime.
- Change API handlers.
- Change settlement logic.
- Change `replay_hash`.
- Change canonical/latest decision selection.
