# Postgres Replay Record Persistence Layout

## Context

- Postgres courses, runs, rounds, decisions, and settlements mapping has been built incrementally behind the adapter boundary.
- Replay mapping is not implemented yet.
- Replay data is related to `replay_hash`, `SettlementResult`, and round settled state, but replay persistence must only save and return existing replay data.
- Persistence mapping must not recalculate truth, generate replay hashes, mutate settlement results, or mutate rounds.

## Current Repository Contracts

The replay repository namespace is `ReplayRepositoryPort` in `services/api/src/repository-ports.ts`.

- `saveReplayInputManifest(manifest: ReplayInputManifest): Promise<void>`
- `getReplayInputManifest(tenantId: RepositoryId, manifestId: RepositoryId): Promise<ReplayInputManifest | null>`
- `saveReplayRun(run: ReplayRun): Promise<void>`
- `getReplayRun(tenantId: RepositoryId, replayRunId: RepositoryId): Promise<ReplayRun | null>`
- `saveReplayReport(report: ReplayReport): Promise<void>`
- `getReplayReport(tenantId: RepositoryId, replayReportId: RepositoryId): Promise<ReplayReport | null>`
- `saveReplayDiffReport(report: ReplayDiffReport): Promise<void>`
- `getReplayDiffReport(tenantId: RepositoryId, replayDiffReportId: RepositoryId): Promise<ReplayDiffReport | null>`

There are no replay list methods in the current repository port. Missing `get` calls return `null`.

## Replay Contract Shapes

`ReplayInputManifest` from `@simwar/shared-contracts`:

- Required identity fields: `manifest_id`, `tenant_id`
- Required run and round fields: `run_id`, `round_id`
- Required hash fields: `input_hash`, `manifest_hash`
- Required payload-like fields: `source_result_id`, `included_sources`, `excluded_from_truth_hash`
- Required timestamp fields: `created_at`
- Optional fields: none in the current contract

`ReplayRun`:

- Required identity fields: `replay_run_id`, `tenant_id`
- Required run and round fields: `run_id`, `round_id`
- Required status fields: `replay_mode`, `status`
- Required relationship fields: `manifest_id`
- Required timestamp fields: `started_at`, `completed_at`
- Optional fields: none in the current contract

`ReplayReport`:

- Required identity fields: `replay_report_id`, `tenant_id`
- Required run and round fields: `run_id`, `round_id`
- Required relationship fields: `replay_run_id`, `source_result_id`
- Required status and result fields: `status`, `matched`, `replay_result_hash`
- Required timestamp fields: `created_at`
- Optional fields: none in the current contract

`ReplayDiffReport`:

- Required identity fields: `diff_report_id`, `tenant_id`
- Required run and round fields: `run_id`, `round_id`
- Required relationship fields: `replay_report_id`
- Required status and payload-like fields: `severity`, `differences`
- Required timestamp fields: `created_at`
- Optional fields: none in the current contract

No current replay contract contains a generic `replay_record_id` or a generic `replay_hash` field.

## Current JSON Adapter Behavior

The JSON adapter stores replay data in separate in-memory collections:

- `replayInputManifests`
- `replayRuns`
- `replayReports`
- `replayDiffReports`

Current save behavior appends with `push` and does not replace existing records. Current replay save methods preserve the full object passed to them and do not call `store.persist()`.

Current get behavior:

- `getReplayInputManifest` filters by `tenant_id` and either `replay_input_manifest_id` or `manifest_id`.
- `getReplayRun` filters by `tenant_id` and either `replay_run_id` or `run_id`.
- `getReplayReport` filters by `tenant_id` and either `replay_report_id` or `report_id`.
- `getReplayDiffReport` filters by `tenant_id` and either `replay_diff_report_id`, `diff_report_id`, or `report_id`.

The current adapter uses first match from collection order. It has no list methods and no deterministic database ordering behavior yet. Tenant isolation is explicit in each get method.

## Current Postgres Schema

Current `replay_records` columns in `db/migrations/0001_initial_repository_schema.sql`:

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

Current indexes exist for `tenant_id`, `run_id`, `round_id`, `record_type`, `manifest_id`, `replay_run_id`, `replay_report_id`, and `created_at`. There is no current `replay_record_id` column, no generic `replay_hash` column, and no tenant-scoped unique constraint for replay business identity.

## Proposed Record Classification

Use one `replay_records` table with `record_type`, explicit query columns, and typed JSONB `payload`.

Allowed `record_type` values should be limited to current repository contract types:

- `manifest`
- `run`
- `report`
- `diff`

This matches the existing migration direction, avoids four new tables, and keeps queryable identity fields explicit while allowing each contract shape to remain typed in `payload`. Each independent table would duplicate tenant/run/round/hash columns and increase migration scope. A single table without a type field is not acceptable because the contracts use different business identifiers and payload shapes.

## Proposed Identity Model

Business identity must be tenant scoped and type scoped.

- `manifest`: `tenant_id + record_type + manifest_id`
- `run`: `tenant_id + record_type + replay_run_id`
- `report`: `tenant_id + record_type + replay_report_id`
- `diff`: `tenant_id + record_type + replay_diff_report_id`

The current shared contract uses `diff_report_id`, while the current migration uses `replay_diff_report_id`. Future schema or mapping must resolve that name mismatch before implementing diff read/write mapping.

Future get queries should filter by `tenant_id`, `record_type`, and the type-specific identity column. Current JSON adapter fallback IDs, such as `report_id`, are compatibility behavior and should be covered by parity tests before deciding whether Postgres must support them.

Because the JSON adapter save behavior appends rather than upserts, the internal row `id` must not assume the business identifier is globally unique. If append parity is preserved, `id` needs an insertion discriminator in addition to tenant, type, and business identity. If a future parity PR changes replay save to upsert, add a tenant-scoped unique constraint for the business identity in the same PR.

The current contracts do not include version fields. Whether multiple records with the same business identity should be allowed remains unresolved until JSON replay repository parity guardrails are added.

## Explicit Columns vs JSONB

Use explicit columns for:

- `tenant_id`
- `record_type`
- type-specific identity: `manifest_id`, `replay_run_id`, `replay_report_id`, `replay_diff_report_id`
- `run_id`
- `round_id`
- relationship fields that already exist as columns: `source_result_id`
- typed hash fields that already exist as columns: `input_hash`, `manifest_hash`, `replay_result_hash`
- status when the contract has it: `ReplayRun.status` or `ReplayReport.status`

Store the full typed contract object in `payload` as JSONB. Explicit columns are query projections and must match the typed object. `payload` should preserve the full current contract shape so read mapping can reconstruct the exact object without guessing from `metadata`.

`metadata` is for non-contract persistence metadata only. It must not enter replay hash, settlement truth, replay truth, or contract reconstruction.

JSONB write rules:

- Arrays and objects must be serialized with `JSON.stringify`.
- SQL parameters for JSONB must use an explicit `::jsonb` cast.
- Optional fields must be cleared with `null` when an upsert path is introduced. If append-only insert parity remains, absent optional fields should remain absent inside `payload`.

## Replay Hash Boundary

- Persistence mapping must not generate `replay_hash`.
- Persistence mapping must not call `buildReplayHash`.
- Persistence mapping only saves and returns existing hash fields from replay contracts.
- Persistence mapping must not change `SettlementResult.replay_hash`.
- Persistence mapping must not change `Round.replay_hash`.
- Persistence mapping must not modify the relationship between settlement result hashes and round settled markers.
- Persistence mapping must not change repeated settlement or replay idempotency behavior.

## Read Mapping Semantics

Future read mapping should:

- enforce tenant isolation in every query
- return `null` for missing get calls
- avoid list behavior because the current replay repository port has no list methods
- use deterministic first-match ordering if duplicate business identities remain append-compatible, such as `created_at ASC, id ASC`
- reconstruct the full typed object from `payload`
- validate explicit column projections against the type-specific identity used for the query where tests require it
- not read `metadata` as contract data
- not recalculate replay hashes

## Write Mapping Semantics

Future write mapping should:

- match current JSON adapter save behavior unless a separate parity PR changes it
- append records if current push behavior is preserved
- use tenant-scoped and type-scoped identity fields
- write the full typed object to `payload` with `JSON.stringify(... )` and `::jsonb`
- project explicit columns from the typed object
- save existing hash fields exactly as provided
- not write role drafts, AI advice, learning evidence, prompt output, or analytics-only data into replay truth
- not modify rounds, settlements, decisions, or settlement idempotency
- not trigger settlement or replay hash generation

Write upsert behavior is not currently safe to assume because the JSON adapter appends replay records. Add JSON replay repository parity tests before deciding between append-only insert and tenant-scoped upsert.

## Schema Gaps

- `record_type` is already present.
- Type-specific identity columns are mostly present, but the contract field `diff_report_id` does not match the schema column `replay_diff_report_id`.
- There is no version field in current replay contracts or schema.
- `replay_mode`, `matched`, `severity`, `included_sources`, `excluded_from_truth_hash`, `started_at`, and `completed_at` are not explicit columns and should live in typed JSONB `payload` unless a future query requires explicit columns.
- `payload` is sufficient for full object preservation only after this layout is accepted and future mapping stores the full typed object there.
- There is no tenant-scoped unique constraint. This is compatible with append semantics but not with an upsert implementation.
- There is no `id = replay_record_id` constraint and no `replay_record_id` column.
- The schema is close enough for read mapping after parity tests define duplicate and fallback-ID behavior.
- The schema is not enough for write mapping if future implementation requires upsert semantics or deterministic replacement.

## Mapping Readiness Decision

Ready for replay read mapping: no.

- Reason: the schema can support typed reads through `record_type`, type-specific IDs, and `payload`, but JSON replay parity tests do not yet lock duplicate handling, fallback identity fields, or first-match ordering.

Ready for replay write mapping: no.

- Reason: current JSON saves append to collections, while a Postgres write implementation must still decide append-only insert versus upsert and how to generate internal row IDs for duplicate business identities.

Ready for runtime wiring: no.

- Reason: Postgres runtime wiring must wait for replay schema/layout docs, JSON parity tests, read/write mappings, Postgres parity tests, replay hash and idempotency guardrails, and disposable DB verification.

## Recommended PR Split

1. `test: add JSON replay repository parity guardrails`
2. `db: add explicit Postgres replay record persistence columns`
3. `api: add Postgres replay read mapping`
4. `api: add Postgres replay write mapping`
5. `test: add Postgres replay repository parity guardrails`
6. `test: add replay hash and idempotency no-regression guardrails`
7. `ops: add disposable Postgres replay verification`
8. `config: only then consider opt-in provider wiring`

If JSON parity tests confirm append-only saves and the existing schema remains sufficient, the schema PR can be narrowed to the `diff_report_id` naming gap or skipped when no schema change is required.

## Not In Scope

This PR does not:

- modify migrations
- modify repository contracts
- modify JSON adapter
- modify Postgres adapter
- modify repository provider
- modify API handlers
- implement replay mapping
- connect Postgres runtime
- modify settlement logic
- modify settlement result shape
- modify replay hash generation
- modify `buildReplayHash` inputs
- modify canonical/latest decision selection
- allow role drafts, AI advice, learning evidence, prompt output, or analytics-only data into settlement truth
