# Postgres Adapter Migration Plan

## Purpose

This document plans the gradual migration path for a future Postgres repository
adapter in SimWar.

It is a planning document only. It does not wire Postgres into runtime, does not
mean production uses Postgres, and does not change API handlers, repository
behavior, settlement logic, replay hashing, or canonical decision selection.

## Current Baseline

The current baseline already has repository boundaries that prepare the project
for a future Postgres adapter:

- The repository provider and repository facade exist as API-facing data access
  boundaries.
- Repository ports define the adapter surface for command and read paths.
- The JSON adapter remains the current default baseline for local runtime
  behavior.
- Settlement, replay, and decision truth-chain behavior remain governed by the
  existing service/runtime behavior.
- `docs/devops/postgres-adapter-verification.md` records the current
  prerequisites and gaps for real disposable Postgres verification.

Current Postgres verification gaps remain documented separately:

- `db/migrations/` is not available in current master.
- A Postgres repository adapter implementation is not available in current
  master.
- Postgres adapter parity and integration tests are not available in current
  master.
- `npm run test:migration:apply` is not available in current master.
- `npm run test:postgres-adapter` is not available in current master.
- A disposable Postgres verification workflow has not yet been executed against
  the current repository.

## Non-Goals

This migration plan explicitly does not do the following:

- Do not connect Postgres to runtime.
- Do not modify API handlers.
- Do not modify settlement logic.
- Do not modify `replay_hash`.
- Do not modify canonical or latest decision selection.
- Do not modify the boundary that keeps role drafts, AI advice, and learning
  evidence out of settlement truth.
- Do not replace the JSON adapter in one step.
- Do not modify route contracts, response bodies, or status codes.

## Proposed Target Architecture

The target architecture keeps repository ports as the source of truth for the
adapter boundary.

- Repository ports remain the shared contract for storage adapters.
- The JSON adapter remains the default baseline until an explicit later change.
- The Postgres adapter implements the same repository ports as the JSON adapter.
- The repository provider can later select an adapter by explicit configuration.
- Runtime wiring must be behind explicit configuration and must happen in a
  later PR after parity and verification are proven.
- Adapter parity tests must prove JSON and Postgres behavior remain consistent
  for the covered repository operations.

The intended direction is:

```text
API routes / services
  -> repository facade
  -> repository ports
  -> JSON adapter by default
  -> Postgres adapter only behind explicit later configuration
```

## Migration Phases

### Phase 1: Docs And Contracts

- Document the migration plan.
- Confirm the repository port surface that a Postgres adapter must implement.
- Identify persistence entities needed by current command and read paths.

### Phase 2: Schema And Migrations

- Add a `db/migrations` skeleton.
- Define initial tables for courses, simulation runs, rounds, decisions,
  settlement results, and audit logs as applicable.
- Include state snapshots or replay records only where current repository ports
  require them.
- Do not wire migrations into runtime.

### Phase 3: Postgres Adapter Skeleton

- Add the Postgres adapter class or module.
- Implement the minimal constructor and connection boundary.
- Keep runtime wiring out of scope.
- Preserve existing behavior with no API or settlement changes.

### Phase 4: Adapter Parity Tests

- Add tests comparing JSON adapter and Postgres adapter behavior.
- Cover courses, runs, rounds, decisions, settlement results, and audit logs.
- Cover write/read parity where command ports exist.
- Add focused checks for ordering, idempotency, and replay hash stability where
  adapter behavior can affect repository reads or writes.

### Phase 5: Verification Scripts

- Add `test:migration:apply`.
- Add `test:postgres-adapter`.
- Document `DATABASE_URL` usage.
- Ensure tests skip safely when `DATABASE_URL` is absent, but report that
  Postgres verification was skipped clearly.

### Phase 6: Disposable DB Verification

- Run migrations against a disposable local Postgres database.
- Run Postgres adapter tests against that disposable database.
- Update verification docs with real results.
- Do not claim production readiness from disposable local verification alone.

### Phase 7: Optional Runtime Wiring

- Wire Postgres only after parity and disposable database verification pass.
- Place runtime selection behind an explicit environment or configuration flag.
- Keep the JSON adapter as the default until the default is intentionally
  changed in a later PR.

## Data Model Candidates

Candidate tables for future migrations include:

- `courses`
- `simulation_runs`
- `simulation_rounds`
- `decisions`
- `settlement_results`
- `audit_logs`
- `state_snapshots`, if required by current repository ports
- `replay_records`, if required by current repository ports

Role-related tables must be deferred unless they are already required by current
contracts and repository ports. They should not be added only because the
Postgres adapter exists.

This document intentionally does not define SQL. Table names, columns, indexes,
constraints, RLS policies, and migration runner details should be proposed in
the schema/migration PR.

## Truth Chain Guardrails

Future Postgres adapter work must preserve SimWar truth-chain behavior:

- `replay_hash` generation must not change.
- `buildReplayHash` inputs must not change.
- Canonical/latest decision selection must not change.
- The `SettlementResult` shape must not change.
- The relationship between `round.replay_hash` and
  `settlement.replay_hash` must stay stable.
- Role drafts, AI advice, and learning evidence must not enter settlement truth.
- The adapter must preserve ordering, versioning, and idempotency assumptions
  currently relied on by the JSON/runtime baseline.
- Replay and Shadow Replay must remain read-only with respect to official
  settlement truth.
- Adapter mapping must not add, drop, or reinterpret truth-protected fields.

These guardrails take priority over reducing JSON-store usage or accelerating
runtime wiring.

## Testing Strategy

Postgres migration work should add tests in layers:

- Unit tests for adapter mapping between shared contracts and database rows.
- Parity tests comparing JSON adapter and Postgres adapter behavior.
- Migration apply tests against an empty disposable database.
- Transaction and rollback expectation tests for failed writes.
- Audit append/read ordering tests.
- Settlement replay hash parity tests.
- `DATABASE_URL` absent behavior tests or clear skip reporting.
- Disposable database verification using a local Postgres instance.

Adapter parity should cover both successful and failure-oriented behavior where
the existing repository ports expose those semantics. Tests must not change
business expectations, route contracts, settlement behavior, replay hash inputs,
or canonical decision selection.

## PR Sequencing

Recommended follow-up PR titles:

1. `db: add initial Postgres migration skeleton`
2. `api: add Postgres repository adapter skeleton`
3. `test: add Postgres adapter parity tests`
4. `chore: add Postgres verification scripts`
5. `test: verify Postgres adapter against disposable database`
6. `api: add explicit repository adapter selection config`
7. `api: wire Postgres adapter behind explicit config`

The runtime wiring PR should come only after the migration, adapter, parity,
script, and disposable database verification PRs are complete.

## Open Questions

- Should the adapter use `node-postgres` / `pg`, or another database library
  already approved for the repository?
- Where should connection pooling live: adapter, provider, API runtime, or a
  separate infrastructure boundary?
- Which migration runner should be used?
- Should tenant fields be present on every table from the first migration?
- Should audit logs be append-only at the database constraint level?
- Should settlement results be immutable at the database constraint level?
- Should replay and state snapshots share tables, or remain split by purpose?
- Should local development include a Docker Compose target for Postgres?
- Should CI run disposable Postgres verification on every PR, or only on
  adapter/migration-related PRs?
