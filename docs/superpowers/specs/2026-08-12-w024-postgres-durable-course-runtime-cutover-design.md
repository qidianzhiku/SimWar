# W024 Bounded Course/Run PostgreSQL Runtime Cutover Design

**Mission:** `SIMWAR-W024-POSTGRES-DURABLE-COURSE-RUNTIME-CUTOVER-MACRO-WAVE-V1.0`
**Candidate:** `CAND-W024-C-DURABILITY-POSTGRESQL`
**Design status:** Approved direction, implementation not started
**Approved route:** Bounded Course/Run Cutover
**Design base:** `24e3baf0c21a0aad7ee6a945ee2441e3e4873d07`

## 1. Decision Summary

W024 will add an explicit, opt-in PostgreSQL runtime mode for the bounded
Course/Run execution path. The existing JSON runtime remains available as an
explicit `json` mode and remains the default unless the operator sets
`SIMWAR_REPOSITORY_MODE=postgres`. In PostgreSQL mode, PostgreSQL is the sole
active persistence authority for the bounded path. The server will fail closed
when PostgreSQL configuration, connectivity, migration state, or required
capabilities are invalid. It will never silently fall back to JSON.

The cutover is deliberately bounded. It reuses the existing repository ports
and facade boundary, activates only the Course/Run journey needed to prove
durable execution, and leaves unrelated capabilities on their existing
contracts. This is an internal engineering application mode, not a production
cutover, a general adapter-completeness claim, or permission to change the
simulation truth model.

The implementation will prove the following chain with a disposable real
PostgreSQL instance:

```text
explicit postgres mode
  -> forward-only migration
  -> Course / Team / Run / Round / Decision persistence
  -> settlement and replay persistence
  -> API stop / restart / reconnect
  -> exact retry returns the existing result
  -> conflicting retry fails closed
```

## 2. Current Reality

The authenticated design base is `24e3baf0c21a0aad7ee6a945ee2441e3e4873d07`.
W023 governance is merged at this SHA. Before W024 implementation, the
current remote master must be re-read and the source SHA must be recorded in
the W024 evidence root; any drift or conflicting runtime work pauses the wave.

The current repository facts relevant to this design are:

- `services/api/src/repository-provider.ts` exposes a small provider boundary,
  but currently offers only `custom` and `json` modes and wires JSON into the
  server by default.
- `services/api/src/repository-facade.ts` is the route-facing repository
  boundary. Routes and application services already consume the facade and
  provider rather than selecting a store directly.
- `services/api/src/repository-ports.ts` defines ports for identity, sessions,
  courses, teams, runs, scenarios, parameter sets, rounds, decisions,
  settlements, domain events, snapshots, audits, replay, role workflow,
  evidence, teacher confirmation, governed advisory data, and validation
  sessions.
- `services/api/src/postgres-repository-adapter.ts` contains PostgreSQL query
  mappings and settlement/replay persistence helpers, but it is not yet the
  active runtime provider. Its runtime activation and transaction behavior
  must be completed only for the bounded W024 path.
- `services/api/src/server.ts` currently creates a JSON provider when no
  provider is injected. W024 must replace implicit selection with explicit
  mode resolution while preserving test injection and existing JSON behavior.
- Migrations `0001` through `0005` are existing historical inputs and must
  remain byte-identical. W024 may add only forward-only migration files.
- The root package already declares `pg` as a development dependency. A
  package-level runtime dependency change is allowed only if the actual
  service build requires it; lockfile and manifest deltas must be recorded,
  not assumed away.

## 3. Scope and Non-Goals

### In scope

- Explicit `json | postgres` repository mode selection.
- PostgreSQL pool creation, readiness validation, bounded lifecycle and clean
  shutdown.
- Forward-only migration application and migration identity checks for the
  disposable W024 database.
- PostgreSQL implementations or composition required by the bounded
  Course/Run journey through the existing ports/facade.
- Durable persistence for Course, Team, Run, Round, canonical Decision,
  settlement result, replay record, required state snapshot and audit record
  used by that journey.
- Tenant and Course/Run boundary checks at the active repository boundary.
- Exact retry reuse and conflicting retry fail-closed behavior.
- Stop/restart/reconnect validation against the same PostgreSQL database.
- Contract, integration, browser and fresh-clone evidence for the bounded
  path.

### Explicitly out of scope

- PostgreSQL as the universal repository for every existing capability.
- Removal of JSON mode or migration of existing JSON snapshots.
- Changes to simulation-core formulas, settlement formulas, Score, Rank,
  canonical Decision selection, replay hash inputs or replay truth semantics.
- New Truth writers, a second event store, or a second LearningGoal/Rubric
  authority.
- Student visibility widening, private payload projection, AI final grading,
  external model activation or advisory authority changes.
- RLS, cross-process production concurrency, HA, backup/restore, failover,
  billing, real customer data, Pilot, Production or W025.
- A general schema redesign or unrelated cleanup of the Postgres adapter.

## 4. Runtime Authority Model

The runtime mode is an explicit operator input:

```text
SIMWAR_REPOSITORY_MODE=json      -> JSON provider, current default semantics
SIMWAR_REPOSITORY_MODE=postgres  -> PostgreSQL provider, no JSON fallback
missing or invalid mode          -> fail closed with a stable configuration error
```

The mode resolver must run before route registration and must expose the
selected mode in health/readiness and evidence. A `postgres` process must
fail before serving Course/Run traffic when the pool cannot connect, required
migrations are absent, the database identity is wrong, or the bounded
provider is incomplete. A JSON store may not be opened as a hidden fallback
in PostgreSQL mode. The implementation and tests must include a source and
runtime assertion that no fallback path is reachable.

The existing `RepositoryProvider` remains the composition object. The
PostgreSQL provider must supply the same route-facing facade shape for the
bounded operations. Provider-specific capabilities must make known limits
explicit rather than allowing an unsupported operation to silently use JSON.

The JSON provider remains unchanged in authority semantics and continues to
be used by existing unit tests unless a test explicitly opts into PostgreSQL.
No test may depend on ambient machine configuration to select the provider.

## 5. Bounded Course/Run Journey

The implementation must map each step to an existing route/service and port
before coding. The bounded journey is:

1. Create or read an exact tenant-scoped Course.
2. Bind the exact Course/Scenario/ParameterSet inputs required by the current
   Run contract.
3. Create or read a Team and its tenant-scoped membership.
4. Create an exact Run and its Round state.
5. Accept the existing role workflow and canonical Decision path without
   changing its authority rules.
6. Persist the canonical Decision and its audit trail through PostgreSQL.
7. Execute the existing settlement path and persist the official result and
   replayable inputs through PostgreSQL.
8. Publish the existing read-only result projection.
9. Stop the API process, restart it with the same explicit PostgreSQL mode,
   reconnect to the same database, and read the Course/Run/Round/Decision,
   settlement, replay and audit state.
10. Re-submit the same idempotent settlement input and receive the existing
    result with the same identity/replay hash semantics.
11. Submit a conflicting input for the same business identity and receive a
    stable fail-closed conflict; no second official result is written.

No arbitrary event payload is copied into official settlement or evidence.
Student-safe projections remain derived views and cannot expose internal
settlement evidence, hidden parameters or database records outside the
existing visibility policy.

## 6. PostgreSQL Lifecycle and Failure Semantics

The PostgreSQL runtime will own a pool with explicit startup and shutdown
operations. Startup must perform, in order:

1. Validate mode and required connection configuration.
2. Connect with bounded timeout.
3. Verify database identity and migration state.
4. Verify the bounded provider capability set.
5. Register the provider and only then start the HTTP listener.

Shutdown must stop accepting new requests, close the HTTP server, drain or
cancel in-flight repository work according to current service semantics, and
close the pool. Restart tests must prove a new process can reconnect without
reading a JSON snapshot.

The same database connection configuration is used for all steps of one
disposable run. A test must fail if a PostgreSQL process is accidentally
started against a second database, a stale migration state, or an implicit
JSON store.

Transaction boundaries must cover the official multi-record writes required
by one command. Audit failure, settlement conflict, or required write failure
must fail closed according to the current command contract; it must not leave
an official result that the API reports as successful. W024 does not claim
crash-safe recovery beyond the tested transaction and restart scenarios.

## 7. Migration Strategy

Existing migrations `0001`–`0005` are immutable historical inputs. W024 adds
one or more new forward-only migrations only when source mapping proves they
are required. Each new migration must have:

- a monotonic filename and a stable identity;
- an explicit transaction/lock strategy;
- tenant-scoped keys and foreign keys for the bounded Course/Run records;
- uniqueness needed for deterministic settlement identity and exact retry;
- indexes for the actual bounded query paths;
- no cascade behavior that changes current domain semantics;
- no RLS policy unless separately authorized by the W024 boundary;
- an apply-again test showing the migration runner is deterministic;
- a fresh disposable database apply receipt.

Migration tests must prove that pre-existing migrations are byte-identical,
the full chain applies to an empty database, and the new migration rejects
or safely handles invalid tenant-scoped references. There must be no automatic
repair, delete or update preflight.

## 8. Settlement, Replay and Idempotency Invariants

The W024 implementation must preserve these invariants:

- The canonical Decision remains the sole settlement input.
- SettlementResult remains written only by the existing settlement authority.
- Score and Rank formulas and writers are untouched.
- Replay consumes the frozen historical manifest and cannot overwrite the
  official result.
- Replay hash inputs are unchanged; Postgres persistence must not add
  provider-specific fields to the truth hash.
- Exact retry for the same tenant, run, round and command/input identity
  returns the existing official result, not a new row or new side effect.
- A conflicting retry for the same business identity and different semantic
  input fails closed with a stable conflict classification.
- Different tenants cannot read or mutate each other's Course/Run, Decision,
  settlement, replay or audit records.
- A restart cannot turn a prior official result into a second result or alter
  the historical replay record.

The tests must compare before/after row identities, replay hashes, audit
counts and visible projections. A passing HTTP status alone is insufficient.

## 9. Tenant and Visibility Boundary

Every bounded repository query and command receives an explicit tenant
context. Tenant identity comes from the existing authenticated/request
boundary, not from an arbitrary payload field supplied by a client. Course,
Team, Run, Round, Decision, settlement, replay and audit access must be
checked with the tenant-scoped identity in the SQL predicate or transaction
boundary.

Cross-tenant, cross-course, cross-run and stale-reference attempts must be
negative-tested. The Student route must remain absent or unchanged for any
new internal persistence data. Teacher/API projections may show only the
existing safe fields. Database rows, audit internals, connection details,
hidden parameters and raw private payloads must not leak through HTTP.

## 10. Graph and Impact Analysis

Before implementation, run the repository-native graph path if a current
source-bound Graphify or CodeGraph index exists. If unavailable, record
`GRAPH_UNAVAILABLE_WITH_REPO_NATIVE_FALLBACK` and use explicit source/import,
route-to-facade, facade-to-port, adapter-to-table and test-to-command
inspection. One bounded graph self-heal/status attempt is allowed if it is
directly useful; no graph repair mission may be created.

The W024 graph contribution ledger must record, for every query:

- source SHA and graph freshness;
- query and returned symbols/edges;
- source files read back;
- decision changed or confirmed;
- validation that exercised the decision;
- observed false positives/false negatives;
- fallback method when graph output was unavailable or incomplete.

Graph output is decision support only. Source, tests, disposable PostgreSQL,
browser evidence and CI remain authoritative. The target is at least three
material graph contributions, but the final report must state the actual
count honestly.

## 11. Validation Design

Validation is divided into gates and must be run with a disposable real
PostgreSQL environment. The exact command names are frozen only after Phase 0
confirms the repository scripts and test harness.

### Contract and static gates

- schema/fixture/OpenAPI/shared-type parity;
- provider mode and configuration contract;
- migration shape and immutable prior migration check;
- typecheck, lint, build, hidden-Unicode and diff checks;
- direct-store boundary and protected-writer scans;
- no JSON fallback source/runtime scan.

### Targeted runtime gates

- PostgreSQL provider startup/readiness/shutdown;
- bounded Course/Team/Run/Round persistence;
- canonical Decision persistence;
- settlement write/read and replay persistence;
- exact retry reuse;
- conflicting retry fail-closed;
- cross-tenant and stale-reference rejection;
- Student safe projection and no private-field exposure.

### Restart and fresh-clone gates

- empty disposable database migration;
- API process A journey and clean stop;
- API process B reconnect and readback;
- settlement/replay continuity across restart;
- fresh detached clone with `npm ci` and the same PostgreSQL validation;
- default full test command, with any unrelated baseline anomaly recorded as
  a classified limit rather than relabeled as PASS;
- browser journey when the bounded Course/Run surface has a real UI path.

No serial-only diagnostic, focused test, worker override, retry, timeout
increase or assertion weakening can replace the default acceptance command.

## 12. Product Acceptance and Stop Rules

The implementation may be considered product-complete only when all required
W024 rows are explicitly mapped to current-head tests and sealed evidence.
At minimum, the final acceptance must show:

- explicit Postgres mode selection;
- no silent JSON fallback;
- real forward-only migration;
- durable Course/Run journey;
- settlement and replay persistence;
- stop/restart/reconnect success;
- exact retry reused;
- conflicting retry failed closed;
- zero replay-hash forks;
- zero tenant leakage;
- zero Student visibility widening;
- no Truth/Score/Rank/Replay authority mutation;
- fresh-clone reproducibility.

Any UNKNOWN, NOT_RUN, stale receipt, unresolved P1/P2, authority breach,
privacy breach, or new product regression blocks merge. A disposable
environment failure is recorded separately and cannot be converted to a
product PASS by rerunning until green.

After product merge, only the required post-merge fresh-clone evidence may be
collected. A single docs-only Governance Closure follows product acceptance
and binds product merge SHA, post-merge SHA, evidence digest, graph receipt,
and known limits. No automatic successor starts.

## 13. Design-Level File Ownership

The implementation allowlist will be frozen from the Phase 0 source map
before any code mutation. The expected bounded ownership surface is:

- repository provider composition and explicit mode resolution in
  `services/api/src/repository-provider.ts` and the smallest dedicated runtime
  helper required for pool lifecycle;
- the existing PostgreSQL adapter and port/facade composition only where the
  bounded Course/Run path is proven to require it;
- `services/api/src/server.ts` only for explicit provider startup/shutdown and
  health/readiness wiring;
- one new forward-only migration under `db/migrations/`;
- `services/api/package.json` and `package-lock.json` only if the service
  runtime genuinely needs a package-level `pg` declaration;
- focused contract, unit, integration and browser tests;
- the smallest existing script/helper additions needed to create and tear
  down the disposable Postgres validation environment;
- W024 design, evidence and governance records in their authorized docs
  locations.

No application, simulation-core, Student, settlement-formula, replay-hash,
workflow, unrelated package or unrelated documentation file is part of this
design. The exact final allowlist, manifest and resource locks are produced
before implementation and are invalidated by any scope expansion.

## 14. Risks and Mitigations

| Risk                              | Mitigation                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| Partial Postgres adapter coverage | Bound the first runtime to Course/Run and fail closed for unsupported operations.              |
| Hidden JSON fallback              | Explicit mode resolver, source scan, runtime fault injection and mode readback.                |
| Migration/schema drift            | Immutable prior migration hashes, forward-only new migration, fresh empty-database apply.      |
| Retry creates duplicate result    | Transactional uniqueness plus exact/conflict integration tests across restart.                 |
| Tenant predicate omission         | Composite keys/foreign keys, negative cross-tenant tests and SQL/source audit.                 |
| Server lifecycle leak             | Pool startup/shutdown receipt, clean stop, reconnect and process-handle checks.                |
| Full-suite host anomaly           | Baseline/control classification; never substitute focused or serial evidence for default gate. |
| Scope expansion into T4 authority | Immediate stop and new Owner decision.                                                         |

## 15. Design Acceptance

This document records the approved implementation direction: **Bounded
Course/Run Cutover**. It does not authorize a merge, a Governance Closure,
W025, Pilot, Production, or an automatic successor. Before implementation,
the next plan must freeze the Phase 0 evidence root, exact source-derived
allowlist, acceptance traceability matrix, migration list, resource locks,
and disposable PostgreSQL commands.
