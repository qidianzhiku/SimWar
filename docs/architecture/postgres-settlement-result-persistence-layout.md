# Postgres Settlement Result Persistence Layout

## Purpose

This document defines the intended persistence layout for future Postgres settlement result mapping before any migration, adapter implementation, or runtime wiring.

Settlement results are truth-chain objects. The layout must preserve the existing `SettlementResult` contract, JSON adapter repository parity, `replay_hash` behavior, and settlement idempotency boundaries.

## SettlementResult Contract Fields

Required `SettlementResult` fields:

- `settlement_result_id`
- `tenant_id`
- `run_id`
- `round_id`
- `round_no`
- `parameter_set_id`
- `scenario_package_id`
- `replay_hash`
- `team_results`

`team_results` contains `TeamSettlement[]`, including:

- `team_id`
- `team_name`
- `state_true`
- `state_obs`
- `state_est`

`state_true` is settlement truth output. It must only be produced by the settlement engine path and must not be rewritten by repository mapping.

## Current JSON Adapter Parity

The JSON repository adapter currently defines the parity target:

- `getSettlementResult` filters by `tenant_id` and `settlement_result_id`.
- `getSettlementResult` returns `null` when missing.
- `listSettlementResultsForRound` filters by `tenant_id`, `run_id`, and `round_id`.
- `listSettlementResultsForRound` returns `[]` when no results match.
- `listSettlementResultsForRound` preserves current store order.
- `saveSettlementResult` upserts by `tenant_id` and `settlement_result_id`.
- `saveSettlementResult` preserves the full settlement object, including `replay_hash`, `team_results`, and any non-contract persistence metadata already attached to the stored object.
- `saveSettlementResult` does not upsert across tenant boundaries.
- Replacement does not reorder unrelated settlement results.

## Proposed Column Layout

Future `settlement_results` rows should use explicit columns for scalar contract fields and an explicit JSONB column for typed settlement team outputs.

Recommended columns:

- `id`
- `settlement_result_id`
- `tenant_id`
- `run_id`
- `round_id`
- `round_no`
- `parameter_set_id`
- `scenario_package_id`
- `replay_hash`
- `team_results`
- `payload`
- `metadata`
- `created_at`
- `updated_at`

Column semantics:

- `id` is an internal row id and is not part of the `SettlementResult` contract.
- `settlement_result_id` is the contract id.
- `tenant_id` scopes identity, reads, writes, and isolation.
- `run_id` and `round_id` support round result queries.
- `round_no`, `parameter_set_id`, and `scenario_package_id` should be explicit to avoid reconstructing truth-chain context from ambiguous JSON payloads.
- `replay_hash` stores the already computed settlement truth hash. Repository mapping must not compute or mutate it.
- `team_results` should store `SettlementResult.team_results` exactly as JSONB.
- `payload` may preserve the full `SettlementResult` snapshot for forward compatibility and audit comparison, but adapter projection should not depend on undocumented payload keys when explicit columns exist.
- `metadata` is for non-contract persistence metadata only. It is not a settlement truth input and must not enter replay hash generation.

## Identity and Upsert Behavior

Future Postgres write mapping should match JSON adapter parity:

- Upsert identity is `tenant_id + settlement_result_id`.
- `settlement_result_id` should not be treated as globally unique.
- A deterministic internal `id` may be generated from `tenant_id + settlement_result_id`.
- Upsert replacement must fully replace contract fields for the matching tenant-scoped settlement result.
- Upsert replacement must not preserve stale `round_no`, `parameter_set_id`, `scenario_package_id`, `replay_hash`, or `team_results`.
- Upsert must not reorder unrelated settlement results in observable list behavior.

Suggested future uniqueness:

```sql
CONSTRAINT settlement_results_tenant_result_id_unique UNIQUE (tenant_id, settlement_result_id)
```

## Read Behavior

Future Postgres read mapping should project the contract shape from explicit columns:

- `getSettlementResult(tenantId, settlementResultId)` filters by `tenant_id` and `settlement_result_id`.
- Missing `getSettlementResult` returns `null`.
- `listSettlementResultsForRound(tenantId, runId, roundId)` filters by `tenant_id`, `run_id`, and `round_id`.
- Missing list results return `[]`.
- List reads should use deterministic ordering that preserves JSON store-order parity as closely as possible, such as `created_at ASC, settlement_result_id ASC`.
- Reads must return the `SettlementResult` contract shape and must not expose `id` or `metadata` as contract fields.

## Write Behavior

Future Postgres `saveSettlementResult` mapping should:

- Use the repository adapter execution boundary only.
- Insert explicit contract columns.
- Upsert on `tenant_id + settlement_result_id`.
- Persist `team_results` exactly as provided.
- Persist `replay_hash` exactly as provided.
- Preserve the full `SettlementResult` snapshot in `payload` if the adapter chooses to keep forward-compatible object storage.
- Keep `metadata` separate from settlement truth data.
- Avoid writing role drafts, AI advice, learning evidence, billing, entitlement, or case governance data into settlement truth fields.

## Replay Hash and Truth Rules

Repository mapping must not change truth-chain behavior:

- Do not change `replay_hash` generation.
- Do not change `buildReplayHash` inputs.
- Do not recompute `replay_hash` in repository code.
- Do not mutate `SettlementResult.replay_hash`.
- Do not change settlement result shape.
- Do not change canonical/latest decision selection.
- Do not allow role drafts into settlement truth.
- Do not allow AI advice into settlement truth.
- Do not allow learning evidence into settlement truth.

## Future PR Split

Recommended next PRs:

1. `db: add explicit Postgres settlement result persistence columns`
2. `api: add Postgres settlement result read mapping`
3. `api: add Postgres settlement result write mapping`
4. `test: add Postgres settlement repository parity tests`
5. `test: add replay_hash stability and settlement idempotency guardrails`
6. `docs: specify replay record persistence layout`
7. `ops: add disposable Postgres settlement verification`
8. `config: only then consider opt-in provider wiring`

## Not In Scope

This document PR does not:

- modify migrations
- modify adapter code
- modify repository provider behavior
- modify JSON adapter behavior
- modify API handlers
- modify route contracts
- modify response bodies or status codes
- connect Postgres runtime
- read `DATABASE_URL`
- change settlement logic
- change `replay_hash`
- change `buildReplayHash` inputs
- change settlement result shape
- change canonical/latest decision selection
- allow role drafts, AI advice, or learning evidence into settlement truth
