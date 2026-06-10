# Postgres Settlement and Replay Mapping Gaps

## Context

- The Postgres adapter already has dependency-free query helpers plus courses, runs, rounds, and decisions read/write mapping.
- Settlement and replay mapping is intentionally not implemented yet.
- Settlement and replay are truth-chain sensitive because `replay_hash` depends on selected decisions and settlement outputs.

## Current Repository Contracts

Settlement methods in `services/api/src/repository-ports.ts`:

- `getSettlementResult(tenantId, settlementResultId)` reads one `SettlementResult` or returns `null` when missing.
- `listSettlementResultsForRound(tenantId, runId, roundId)` returns matching `SettlementResult[]` or `[]` when none match.
- `saveSettlementResult(result)` writes a full `SettlementResult`.

Replay methods in `services/api/src/repository-ports.ts`:

- `saveReplayInputManifest` / `getReplayInputManifest`
- `saveReplayRun` / `getReplayRun`
- `saveReplayReport` / `getReplayReport`
- `saveReplayDiffReport` / `getReplayDiffReport`

Current contract behavior expects missing `get` calls to return `null`, missing list calls to return `[]`, and settlement writes to upsert the full object.

## Current JSON Adapter Behavior

- Settlement results are stored in `store.settlementResults`.
- `getSettlementResult` filters by `tenant_id` and `settlement_result_id`.
- `listSettlementResultsForRound` filters by `tenant_id`, `run_id`, and `round_id`.
- `saveSettlementResult` upserts by `tenant_id` and `settlement_result_id`.
- Settlement list order preserves current store order.
- The full `SettlementResult` object is preserved.
- Replay records are pushed into in-memory collections for manifests, runs, reports, and diff reports.

## Settlement and Replay Truth Chain

- The settlement entry point is `runSettlement`.
- The settlement writer path uses `settleRoundWithSettlementWriter(..., facade.settlements)`.
- `runSettlement` still reads some truth inputs directly from `store`.
- Decisions are selected from `store.decisions`.
- Latest submitted decision selection uses `versions.at(-1)`.
- `buildReplayHash` is implemented in `services/api/src/simulation.ts`.
- `buildReplayHash` inputs include:
  - `parameter_set_id`
  - `scenario_package_id`
  - `run_id`
  - `round_no`
  - `seed`
  - decision `team_id`, `version`, and `payload`
  - `team_results` `state_true`
- `replay_hash` is stored in `SettlementResult.replay_hash` and `Round.replay_hash`.
- `replay_hash` is reused by result views, the round settled marker, and settlement idempotency behavior.

## Current Postgres Schema

Current `settlement_results` columns:

- `id`
- `settlement_result_id`
- `tenant_id`
- `run_id`
- `round_id`
- `replay_hash`
- `payload`
- `metadata`
- `created_at`
- `updated_at`

Current `replay_records` columns:

- `id`
- `tenant_id`
- `run_id`
- `round_id`
- `record_type`
- `manifest_id`
- `replay_run_id`
- `replay_report_id`
- `replay_diff_report_id`
- `source_result_id`
- `input_hash`
- `manifest_hash`
- `replay_result_hash`
- `status`
- `payload`
- `metadata`
- `created_at`
- `updated_at`

The current `replay_records` table has typed hash fields, but no generic `replay_hash` column.

## Schema and Layout Gaps

- Settlement `round_no` is not explicit.
- `parameter_set_id` is not explicit.
- `scenario_package_id` is not explicit.
- `team_results` typed layout is not explicit.
- Settlement full-object `payload` layout is not specified.
- `replay_records` typed payload layout is not specified.
- `Round.replay_hash` persistence path is not repository-backed.
- Settlement idempotency still depends on `store.settlementResults`.
- `runSettlement` still mixes repository facade access and direct store access.

## Why Mapping Is Not Ready

- Read mapping is unsafe until the settlement result payload layout is specified.
- Write mapping is unsafe until the `SettlementResult` persistence layout is specified.
- Replay mapping is unsafe until replay typed layouts are specified.
- Runtime wiring is blocked until store-direct truth-chain reads are isolated or parity-tested.

## Blocking Questions

1. Should settlement `round_no` be an explicit column or derived?
2. Should `parameter_set_id` and `scenario_package_id` be stored explicitly on `settlement_results`?
3. Should `team_results` be stored as explicit JSONB or inside `payload`?
4. What is the canonical `SettlementResult` JSONB layout?
5. What is the canonical `ReplayRecord` JSONB layout?
6. How should `Round.replay_hash` be persisted through repository boundaries?
7. Should idempotency use the repository facade instead of `store.settlementResults`?
8. What parity tests are required before Postgres settlement mapping?
9. What disposable Postgres verification is required before runtime wiring?

## Recommended PR Split

1. `test: add JSON settlement repository parity guardrails`
2. `docs: specify settlement result persistence layout`
3. `db: add explicit Postgres settlement result persistence columns`
4. `api: add Postgres settlement result read mapping`
5. `api: add Postgres settlement result write mapping`
6. `test: add settlement repository parity tests`
7. `docs: specify replay record persistence layout`
8. `db: add replay record persistence columns if needed`
9. `api: add Postgres replay read/write mapping`
10. `test: add replay_hash stability and idempotency guardrails`
11. `ops: add disposable Postgres settlement/replay verification`
12. `config: only then consider opt-in provider wiring`

## Not In Scope

This document PR does not:

- modify migrations
- modify adapter code
- modify repository provider
- modify JSON adapter
- modify API handlers
- modify settlement logic
- modify `replay_hash`
- modify `buildReplayHash` inputs
- modify settlement result shape
- modify canonical/latest decision selection
- connect Postgres runtime
- allow role drafts, AI advice, or learning evidence into settlement truth
