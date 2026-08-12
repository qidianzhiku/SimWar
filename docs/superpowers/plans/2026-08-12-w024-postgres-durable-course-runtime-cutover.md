# W024 Bounded Course/Run PostgreSQL Runtime Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate an explicit, fail-closed PostgreSQL runtime for the bounded
Course/Run journey and prove durable settlement/replay behavior across API
stop, restart and reconnect.

**Architecture:** Keep `RepositoryFacade` and `SimWarRepositoryPorts` as the
only route-facing persistence boundary. Add a real `pg` pool and forward-only
migration runner, compose a PostgreSQL provider from the existing adapter
surface, and make PostgreSQL mode reject unsupported ports instead of creating
JSON shadow writers. Preserve JSON mode, Simulation Core semantics, canonical
Decision ownership and replay hash inputs.

**Tech Stack:** Node.js 24, TypeScript 5.9, npm workspaces, `pg`, PostgreSQL
16, Vitest, Playwright/Chromium, JSON Schema/OpenAPI, Graphify, repository
native source fallback when CodeGraph is degraded.

## Global Constraints

- `SIMWAR_REPOSITORY_MODE=json|postgres` is explicit; invalid or missing
  PostgreSQL configuration fails closed.
- `POSTGRES` mode never silently falls back to JSON and has no same-domain JSON
  shadow writer.
- JSON remains the existing default regression baseline and keeps its current
  semantics.
- Existing migrations `0001` through `0005` remain byte-identical; W024 uses
  only forward-only migration `0006`.
- `pg` and `@types/pg` are the only dependency additions permitted by W024.
- PostgreSQL is sole persistence authority for the bounded Course/Run runtime
  state required by the accepted journey.
- Canonical Decision remains the sole settlement input; Score, Rank,
  SettlementResult semantics and replay hash inputs do not change.
- No Simulation Core semantic change, Student visibility widening, RLS,
  PostgreSQL production claim, Pilot, Production, W025 or automatic successor.
- `RESTART_A_PRE_SETTLEMENT` and `RESTART_B_POST_SETTLEMENT` are mandatory.
- Exact retry returns `reused`; conflicting retry fails closed; no retry or
  timeout masking is allowed.
- Every required acceptance row must be `PASS` or
  `PASS_WITH_EXPLICIT_LIMIT`; `UNKNOWN`, `NOT_RUN`, `NOT_MAPPED` and stale
  receipts block merge.
- The local Evidence Root is
  `C:\Temp\simwar-w024-postgres-durable-course-runtime-20260812T091327Z`.
- The approved base is
  `24e3baf0c21a0aad7ee6a945ee2441e3e4873d07`; the source-derived Phase 0
  allowlist is the W024 file ownership map in that Evidence Root.

## Frozen File Map

### Runtime and persistence

- Create `services/api/src/postgres-runtime.ts` for mode resolution, pool
  lifecycle, migration application, readiness and clean shutdown.
- Modify `services/api/src/repository-provider.ts` for explicit JSON/Postgres
  provider composition and capability declarations.
- Modify `services/api/src/postgres-repository-adapter.ts` for bounded port
  parity, exact immutable input reads, Team/Role Workflow persistence and the
  mandatory transaction executor.
- Modify `services/api/src/repository-ports.ts` so Role Workflow reads/writes
  are awaitable without changing JSON behavior or authority semantics.
- Modify `services/api/src/json-repository-adapter.ts` to satisfy the
  awaitable Role Workflow boundary with the current JSON implementation.
- Modify `services/api/src/role-workflow.ts` and its direct dependents to await
  durable repository operations.
- Modify `services/api/src/server.ts` for explicit runtime selection, startup
  readiness, graceful shutdown and fail-closed excluded ports.
- Create `db/migrations/0006_w024_bounded_course_run_runtime.sql` for Team,
  exact immutable runtime inputs, Role Workflow append records and bounded
  tenant-scoped constraints.
- Modify `services/api/package.json`, root `package.json` and
  `package-lock.json` only for the runtime `pg` declaration and required types.

### Tests and harness

- Create `tests/unit/postgres-runtime.test.ts`.
- Modify `tests/unit/repository-provider.test.ts`.
- Modify `tests/unit/postgres-repository-adapter.test.ts`.
- Modify `tests/unit/role-workflow-command-service.test.ts`.
- Modify direct Role Workflow dependents' unit tests only when TypeScript
  awaitability requires it.
- Create `tests/integration/postgres-w024-durable-course-runtime.test.ts`.
- Create `tests/integration/postgres-w024-restart.test.ts`.
- Create `scripts/postgres-w024-durable-course-runtime.test.ts` as the real
  disposable PostgreSQL Vitest harness and report writer.
- Keep existing PostgreSQL replay and W015 migration tests unchanged except
  for compilation fixes required by the new shared runtime helper.

### Documentation and evidence

- Keep the approved design at
  `docs/superpowers/specs/2026-08-12-w024-postgres-durable-course-runtime-cutover-design.md`.
- This plan is the implementation record.
- Product code does not modify contracts, Simulation Core, Student surfaces,
  workflows or unrelated governance files.
- Governance files are changed only in the single post-merge Closure PR.

## Task 1: Seal Phase 0 and establish the RED baseline

**Files:**

- Evidence only: `C:\Temp\simwar-w024-postgres-durable-course-runtime-20260812T091327Z\control\*`
- Evidence only: `C:\Temp\simwar-w024-postgres-durable-course-runtime-20260812T091327Z\product-acceptance\W024_ACCEPTANCE_FREEZE.csv`
- Read-only source: `services/api/src/repository-provider.ts`
- Read-only source: `services/api/src/postgres-repository-adapter.ts`
- Read-only source: `services/api/src/repository-ports.ts`
- Read-only source: `services/api/src/server.ts`

**Interfaces:**

- Consumes: authenticated `origin/master`, valid Frozen Pack, W023 readback,
  PR #365 overlap record and Graph Companion output.
- Produces: current-reality receipt, port parity map, migration gap map,
  frozen 149-row acceptance matrix, exact file ownership map and a repeatable
  baseline command set.

- [x] **Step 1: Verify the live base and pack**

Run:

```powershell
git fetch origin master
git rev-parse origin/master
Get-Content $env:W024_EVIDENCE_ROOT\control\frozen-pack-validation.json
```

Expected: remote master is `24e3baf0c21a0aad7ee6a945ee2441e3e4873d07` and
Frozen Pack status is `FROZEN_PACK_VALID`.

- [x] **Step 2: Verify graph and overlap facts**

Run:

```powershell
npm run graph:companion -- --mode entry --evidence-root $env:W024_EVIDENCE_ROOT\graph\entry
gh pr view 365 --repo qidianzhiku/SimWar --json state,headRefOid,baseRefOid,mergeable,files
```

Expected: Graphify is usable with historical-source limits, CodeGraph is
classified without fabricated output, and PR #365 remains quarantined and
read-only.

- [x] **Step 3: Freeze the acceptance traceability**

Each row in `W024_ACCEPTANCE_FREEZE.csv` has an exact ID, test ID, evidence
artifact path and `required_before_merge=YES`. No row is left unmapped.

- [ ] **Step 4: Capture the existing default baseline**

Run the current commands once before product mutation:

```powershell
npm run typecheck
npm run test:contract
npm test
```

Record command, Node/npm versions, exit code, test files/tests and any
pre-existing anomaly under `tests/baseline/` in the Evidence Root. A focused
or serial control does not replace the default command.

## Task 2: Add the PostgreSQL pool, mode and migration lifecycle

**Files:**

- Create: `services/api/src/postgres-runtime.ts`
- Modify: `services/api/src/repository-provider.ts`
- Modify: `services/api/src/server.ts`
- Modify: `services/api/package.json`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `db/migrations/0006_w024_bounded_course_run_runtime.sql`
- Create: `tests/unit/postgres-runtime.test.ts`
- Modify: `tests/unit/repository-provider.test.ts`

**Interfaces:**

- Consumes: `pg.Pool`, `RepositoryProvider`, existing migration directory and
  `CreateApiServerOptions` injection seam.
- Produces: `RepositoryMode = "json" | "postgres"`,
  `resolveRepositoryMode(env)`, `createPostgresRuntime(options)`,
  `startPostgresRuntime()`, `assertPostgresReadiness()` and
  `closePostgresRuntime()`.

- [ ] **Step 1: Write the failing runtime-mode tests**

Cover these behaviors:

```typescript
expect(resolveRepositoryMode({ SIMWAR_REPOSITORY_MODE: "postgres" })).toBe("postgres");
expect(() => resolveRepositoryMode({ SIMWAR_REPOSITORY_MODE: "sqlite" })).toThrow(
  "repository_mode_invalid"
);
await expect(createPostgresRuntime({ databaseUrl: "" }).start()).rejects.toThrow(
  "postgres_database_config_missing"
);
```

Add a failure test proving a connection error does not call
`createJsonRepositoryProvider` and does not create a JSON store file.

- [ ] **Step 2: Run the RED tests**

Run:

```powershell
npx vitest run tests/unit/postgres-runtime.test.ts tests/unit/repository-provider.test.ts
```

Expected: the new tests fail because no explicit Postgres mode or lifecycle
implementation exists.

- [ ] **Step 3: Add the minimal `pg` runtime dependency declarations**

Use npm workspace commands and inspect the resulting diff:

```powershell
npm install -w @simwar/api pg
npm install -D @types/pg
```

Keep every lockfile change attributable to these declarations only.

- [ ] **Step 4: Implement pool and readiness lifecycle**

The runtime helper must:

```typescript
interface PostgresRuntime {
  provider: RepositoryProvider;
  start(): Promise<void>;
  assertReady(): Promise<void>;
  close(): Promise<void>;
}
```

`start()` validates `DATABASE_URL` or the documented Postgres environment,
connects with a bounded timeout, applies migration `0006`, verifies the
W024 migration marker and constructs the provider. `close()` ends the pool.
No code path may construct a JSON provider after Postgres mode is selected.

- [ ] **Step 5: Run the GREEN unit tests**

Run:

```powershell
npx vitest run tests/unit/postgres-runtime.test.ts tests/unit/repository-provider.test.ts
npm run typecheck
```

Expected: explicit mode, fail-fast, no-fallback and lifecycle tests pass.

## Task 3: Add the bounded forward-only schema and port parity

**Files:**

- Modify: `db/migrations/0006_w024_bounded_course_run_runtime.sql`
- Modify: `services/api/src/postgres-repository-adapter.ts`
- Modify: `services/api/src/repository-ports.ts`
- Modify: `tests/unit/postgres-repository-adapter.test.ts`
- Create: `tests/unit/postgres-w024-migration.test.ts`

**Interfaces:**

- Consumes: existing tables from migrations `0001`–`0005`, shared `Course`,
  `Team`, `Run`, `Round`, `Decision`, `SettlementResult`, Replay and Role
  Workflow types.
- Produces: Postgres mappings for identity, sessions, courses, teams, runs,
  exact scenario/parameter snapshots, rounds, decisions, settlements,
  settlement outcome, audits, replay, snapshots and Role Workflow.

- [ ] **Step 1: Write schema RED tests**

Add tests that inspect the new migration and assert:

```typescript
expect(migration).toContain("CREATE TABLE w024_runtime_inputs");
expect(migration).toContain("CREATE TABLE w024_role_workflow_records");
expect(migration).toContain("FOREIGN KEY (tenant_id, run_id)");
expect(migration).not.toMatch(/ON DELETE CASCADE|CREATE POLICY/i);
```

Add byte-identity assertions for `0001`–`0005` against their Phase 0 hashes.

- [ ] **Step 2: Run schema RED**

```powershell
npx vitest run tests/unit/postgres-w024-migration.test.ts
```

Expected: the new table and constraint assertions fail before migration
`0006` exists.

- [ ] **Step 3: Implement the forward-only migration**

The migration must create tenant-scoped Team/member and immutable runtime-input
records, Role Workflow append records, required indexes, exact settlement
business uniqueness and bounded foreign keys. It must insert one migration
marker consumed by readiness. It must not alter previous files or add RLS.

- [ ] **Step 4: Extend adapter mappings**

Add provider-neutral mappings for every D05/D07/D08/D14 port. Use explicit
tenant predicates in every query. Store the complete contract-shaped object in
JSONB only where the existing schema has payload columns; keep identity and
business-key columns explicit. Remove the active path's ability to construct a
settlement outcome port without `transactionExecutor`.

- [ ] **Step 5: Run adapter GREEN tests**

```powershell
npx vitest run tests/unit/postgres-w024-migration.test.ts tests/unit/postgres-repository-adapter.test.ts
npm run typecheck
```

Expected: schema, tenant predicates, port mappings and transaction-injection
tests pass.

## Task 4: Make Role Workflow awaitable and durable without changing semantics

**Files:**

- Modify: `services/api/src/repository-ports.ts`
- Modify: `services/api/src/json-repository-adapter.ts`
- Modify: `services/api/src/postgres-repository-adapter.ts`
- Modify: `services/api/src/role-workflow.ts`
- Modify: `services/api/src/evidence-provenance.ts`
- Modify: `services/api/src/w020-advisory-service.ts`
- Modify: `services/api/src/validation-session-control-plane.ts`
- Modify: `services/api/src/server.ts`
- Modify: `tests/unit/role-workflow-command-service.test.ts`
- Modify: `tests/integration/role-workflow-endpoint.test.ts`
- Modify: `tests/unit/d2-evidence-provenance-service.test.ts`
- Modify: `tests/unit/w020-advisory-service.test.ts`
- Modify: `tests/unit/validation-session-control-plane.test.ts`

**Interfaces:**

- Consumes: existing synchronous JSON role workflow behavior and new
  `w024_role_workflow_records` mapping.
- Produces: `readRoleWorkflow(...): Promise<RoleWorkflowRepositorySnapshot>`
  and `commitRoleWorkflow(...): Promise<void>` for both providers; JSON
  remains an in-process implementation with identical returned DTOs.

- [ ] **Step 1: Write the failing durability contract tests**

Add a provider-neutral test that commits an assignment, section, merge and
confirmation, constructs a fresh repository instance, and expects the same
snapshot. Add an exact canonical Decision assertion showing the role merge
still creates the existing canonical payload and status.

- [ ] **Step 2: Run the RED tests**

```powershell
npx vitest run tests/unit/role-workflow-command-service.test.ts tests/integration/role-workflow-endpoint.test.ts
```

Expected: the test fails because the current interface is synchronous and the
Postgres implementation has no Role Workflow persistence.

- [ ] **Step 3: Convert the repository boundary to awaitable operations**

Update the interface and service call sites with `await`. Keep authorization,
role merge order, field allowlists, stale-version checks, canonical Decision
construction and Student-safe DTOs unchanged. JSON methods may resolve their
existing in-memory behavior immediately; they must not change output semantics.

- [ ] **Step 4: Implement append/read Role Workflow storage**

Use tenant/run/team/round predicates and append-only records. A Postgres
commit must be transactional with the associated canonical Decision when the
command is `append_confirmation`; a failed write must leave no confirmation
or canonical Decision success state.

- [ ] **Step 5: Run the GREEN role workflow regression floor**

```powershell
npx vitest run tests/unit/role-workflow-command-service.test.ts tests/integration/role-workflow-endpoint.test.ts tests/unit/d2-evidence-provenance-service.test.ts tests/unit/w020-advisory-service.test.ts tests/unit/validation-session-control-plane.test.ts
npm run typecheck
```

Expected: existing JSON role workflow, evidence, W020 and W023 tests remain
green while the repository API is awaitable.

## Task 5: Compose explicit Postgres provider and remove fallback paths

**Files:**

- Modify: `services/api/src/repository-provider.ts`
- Modify: `services/api/src/server.ts`
- Modify: `services/api/src/postgres-runtime.ts`
- Modify: `tests/unit/postgres-runtime.test.ts`
- Modify: `tests/unit/repository-provider.test.ts`

**Interfaces:**

- Consumes: complete bounded Postgres adapter and pool lifecycle.
- Produces: provider mode `postgres`, bounded capabilities, fail-closed
  implementations for excluded optional ports, and server startup/shutdown
  hooks.

- [ ] **Step 1: Add failure tests for hidden fallback**

Assert that Postgres mode:

```typescript
expect(provider.mode).toBe("postgres");
expect(provider.capabilities.knownLimits).not.toContain("JSON_INTERNAL_ONLY");
await expect(provider.ports.governedAdvisories!.append(record)).rejects.toThrow(
  "repository_capability_unavailable"
);
```

Assert source/runtime composition does not call
`createJsonTeacherConfirmationRepositoryPort` or
`createJsonGovernedAdvisoryRepositoryPort` in Postgres mode.

- [ ] **Step 2: Implement provider composition**

`createRuntimeRepositoryProvider` resolves `SIMWAR_REPOSITORY_MODE` before
constructing a store. JSON mode preserves the current provider. Postgres mode
starts the pool/runtime and passes the pool query and transaction executors to
the adapter. Excluded optional ports throw stable unsupported-capability
errors. The process must not create or read the JSON persistence file for
Postgres business state.

- [ ] **Step 3: Wire graceful server shutdown**

The main module must await runtime startup before listening and close the pool
when the HTTP server closes or receives the process shutdown signal. Test
injected providers remain supported for existing unit/integration tests.

- [ ] **Step 4: Run provider GREEN tests**

```powershell
npx vitest run tests/unit/postgres-runtime.test.ts tests/unit/repository-provider.test.ts
npm run typecheck
npm run check:direct-store-boundaries
```

Expected: mode selection, no-fallback, lifecycle and direct-store checks pass.

## Task 6: Build the real disposable PostgreSQL harness and TDD the durable journey

**Files:**

- Create: `scripts/postgres-w024-durable-course-runtime.test.ts`
- Create: `tests/integration/postgres-w024-durable-course-runtime.test.ts`
- Create: `tests/integration/postgres-w024-restart.test.ts`
- Create: `tests/helpers/postgres-w024-harness.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: `SIMWAR_TEST_DATABASE_URL`, migration runner, `createApiServer`,
  explicit Postgres mode and real Chromium/API test helpers.
- Produces: machine-readable W024 receipts for migration, startup, pre/post
  settlement restart, exact retry, conflict retry, tenant isolation and
  cleanup.

- [ ] **Step 1: Write the end-to-end RED journey**

The test must create one disposable database/schema, apply migrations, start
the API in Postgres mode, and perform this fixed sequence:

```text
seed exact immutable inputs
-> create Course, Team, Run, Round
-> assign roles and complete role merge/confirmation
-> Restart A before settlement
-> submit canonical decision and settle
-> publish safe result
-> Restart B after settlement
-> read identical result/hash/audit/replay
-> exact retry returns REUSED
-> conflicting retry returns stable conflict
-> tenant B cannot read or write tenant A
```

Before implementation, the RED test must fail at provider startup or missing
durable parity rather than being skipped for absent database support.

- [ ] **Step 2: Run RED against a disposable real PostgreSQL**

Create a unique temporary cluster with PostgreSQL 16 `initdb`/`pg_ctl` or use
the CI PostgreSQL service, set `SIMWAR_TEST_DATABASE_URL`, and run:

```powershell
npx vitest run tests/integration/postgres-w024-durable-course-runtime.test.ts tests/integration/postgres-w024-restart.test.ts
```

Expected: failure identifies the first missing W024 behavior and the harness
records cleanup in a `finally` path.

- [ ] **Step 3: Implement the disposable harness**

The harness must use a unique database/schema and unique tenant/run IDs per
test, never reuse a developer database, and record Node/npm/PostgreSQL versions,
connection identity, migration hashes, start/stop timestamps and cleanup
status. A failed setup must not be converted into a product pass.

- [ ] **Step 4: Implement the minimal journey adapters**

Use the existing route/service path and repository facade. Do not issue direct
database writes from an application test to make the product flow pass;
database setup may only seed immutable source inputs and test users. Every
official Course/Run/Decision/Settlement/Replay write must go through the
active provider.

- [ ] **Step 5: Run GREEN journey and restart tests**

```powershell
npx vitest run tests/integration/postgres-w024-durable-course-runtime.test.ts tests/integration/postgres-w024-restart.test.ts
```

Expected: both restart gates pass, the exact retry is `reused`, the conflicting
retry is fail-closed, and no JSON store file is touched.

## Task 7: Add current-head contract, security and browser acceptance

**Files:**

- Modify: `tests/contract/` only when an existing runtime-mode contract test
  is the correct current boundary; no business schema change is introduced.
- Create: `tests/integration/postgres-w024-tenant-security.test.ts` only if
  the durable journey cannot keep the security assertions in the two journey
  files.
- Create: `tests/e2e-ui/postgres-w024-course-run-smoke.spec.ts` only if the
  existing Chromium journey needs a real bounded Postgres-mode entry point.
- Modify: `tests/e2e-ui/role-workflow-product-journey.spec.ts` only for the
  explicit provider-mode fixture.

**Interfaces:**

- Consumes: the completed Postgres provider and real journey harness.
- Produces: current-head evidence for C02/C05/C06, H01/H02/H05, I02/I03/I04,
  mobile/visibility checks and required regression floors.

- [ ] **Step 1: Write negative tests first**

Cover invalid mode/config, connection failure, hidden JSON fallback,
cross-tenant read/write, cross-course/run/team/role references, private replay
fields and Student projection. Each negative test must inspect persisted rows
after the failed operation.

- [ ] **Step 2: Run the negative RED suite**

```powershell
npx vitest run tests/integration/postgres-w024-tenant-security.test.ts
```

Expected: missing guards fail before implementation and no test is marked
passed because a request merely returned a non-2xx response.

- [ ] **Step 3: Implement only the missing guards**

Keep tenant identity server-derived, retain Student-safe projections, and
reject any reference not matching the exact persisted tenant/course/run scope.

- [ ] **Step 4: Run the acceptance GREEN suite**

```powershell
npm run test:contract
npm run check:direct-store-boundaries
npm run check:hidden-unicode
npm run typecheck
npm run lint
npm run build
npm run security:audit
npm test
```

Expected: the default command itself passes; focused or serial execution may
be added as diagnosis but cannot replace it.

## Task 8: Graph impact reconciliation and independent review package

**Files:**

- Evidence only under `$env:W024_EVIDENCE_ROOT\graph` and
  `$env:W024_EVIDENCE_ROOT\reviews`.
- Read-only graph/source review of the exact candidate head.

**Interfaces:**

- Consumes: final candidate SHA, changed-file manifest, Graphify, CodeGraph
  status and all validation receipts.
- Produces: graph contribution ledger, caller/callee source readback, missed
  edge register, exact-head review receipt and acceptance matrix closure.

- [ ] **Step 1: Run Graphify impact at the candidate head**

```powershell
npm run graph:companion -- --mode impact --base 24e3baf0c21a0aad7ee6a945ee2441e3e4873d07 --target <candidate-sha> --evidence-root $env:W024_EVIDENCE_ROOT\graph\impact
```

Use the actual candidate SHA after it is frozen. Record every material
decision, source readback and safety-floor comparison.

- [ ] **Step 2: Run CodeGraph exactly once if the source-bound index is usable**

Use `codegraph status`, `codegraph sync` and `codegraph affected` only when
they bind to the candidate source worktree. The Owner amendment forbids
creating a CodeGraph index in the source worktree; an external index or
explicit source fallback is mandatory when the index cannot be safely bound.

- [ ] **Step 3: Perform independent read-only review**

Review exact base/head, every file, port parity, no JSON fallback, migration
integrity, transaction path, restart proof, retry/conflict behavior, tenant
security, Student visibility, truth/replay non-interference and all
non-proofs. Required result: `BLOCKING=0`, `MUST_FIX=0`, `UNKNOWN=0`.

- [ ] **Step 4: Seal the acceptance matrix**

Every A01–J20 row receives a current-head status and evidence digest. Any
unmapped or stale row blocks publication.

## Task 9: Pre-push, one Product PR, merge and post-merge proof

**Files:**

- Remote branch: `codex/w024-postgres-durable-course-runtime`.
- Product PR maximum: one.
- Governance Closure is a later separate docs-only PR, exactly one.

- [ ] **Step 1: Freeze exact candidate facts**

Record:

```powershell
git rev-parse HEAD
git rev-list --count 24e3baf0c21a0aad7ee6a945ee2441e3e4873d07..HEAD
git diff --name-status 24e3baf0c21a0aad7ee6a945ee2441e3e4873d07...HEAD
git diff --check 24e3baf0c21a0aad7ee6a945ee2441e3e4873d07...HEAD
```

Compute the manifest SHA from the exact newline-delimited name-status list.
Worktree must be clean and the manifest must equal the Phase 0 allowlist.

- [ ] **Step 2: Run pre-push gates once**

Run the required current-head contract, boundary, type, lint, build, security,
default full suite, real PostgreSQL, browser and graph receipts. Do not run
until-pass.

- [ ] **Step 3: Push once and create one non-draft Product PR**

PR body must include exact base/head, commit count, manifest, mode semantics,
migration behavior, restart A/B, retry/conflict results, Graph limits, W023/
PR #365 overlap classification, known limits and explicit non-proofs.

- [ ] **Step 4: Wait for checks and perform exact-head review**

Required remote checks: quality, browser-smoke, Analyze JavaScript and
TypeScript, CodeQL and any repository-required PostgreSQL job. Any head,
manifest, base, review or check drift invalidates the merge decision.

- [ ] **Step 5: Obtain the separately required exact-head merge authorization**

This plan does not authorize the merge. The merge decision must bind the
actual base, head, commit count, manifest digest, review result and one
ordinary merge commit attempt.

- [ ] **Step 6: Post-merge fresh detached validation**

At the actual merge SHA, use a new same-owner detached clone and run npm ci,
real disposable PostgreSQL migration, durable journey, Restart A, Restart B,
exact/conflict retries, tenant/security, contract, direct-store, typecheck,
lint, build, security, default full suite, browser and Graph Companion.

- [ ] **Step 7: Create exactly one Governance Closure PR**

Only after all product and fresh-clone evidence passes, update the authorized
W024 cycle/portfolio/capability records. Record product merge SHA,
post-merge SHA, evidence digest, Graphify/CodeGraph limits, JSON baseline,
PostgreSQL internal bounded status, RLS/PITR non-proofs and
`automatic_next_start: false`. Stop after governance readback.

## Verification Matrix

| Gate        | Command/evidence                                       | Required result                                     |
| ----------- | ------------------------------------------------------ | --------------------------------------------------- |
| Mode        | `tests/unit/postgres-runtime.test.ts`                  | explicit json/postgres; invalid config fail closed  |
| Provider    | `tests/unit/repository-provider.test.ts`               | Postgres provider; no JSON fallback                 |
| Migration   | `tests/unit/postgres-w024-migration.test.ts` + real DB | 0001–0005 unchanged; 0006 applies                   |
| Port parity | `tests/unit/postgres-repository-adapter.test.ts`       | bounded ports and tenant predicates                 |
| Role        | role workflow unit/integration                         | role state survives fresh provider                  |
| Settlement  | durable integration                                    | transaction, exactly-once audit, no partial success |
| Restart A   | fresh process before settlement                        | Course/Run/Decision recovered                       |
| Restart B   | fresh process after settlement                         | identical result/hash/audit/replay                  |
| Retry       | durable integration                                    | exact `REUSED`; conflict fail closed                |
| Security    | tenant/private-field tests                             | zero leakage and no visibility widening             |
| Quality     | contract/boundary/type/lint/build/security             | PASS                                                |
| Full suite  | default `npm test`                                     | PASS; no replacement by serial mode                 |
| Browser     | existing/new Chromium journey                          | PASS with bounded Postgres mode                     |
| Graph       | Graph Companion + source fallback                      | current-source readback and safety floors           |
| Remote      | CI/browser/Analyze/CodeQL                              | exact-head PASS                                     |

## Stop Conditions

Stop and preserve evidence without push or merge if:

- remote master drifts from the authenticated base before publication;
- the exact allowlist expands beyond the Phase 0 map;
- PostgreSQL mode needs a second writer, hidden JSON fallback, RLS or a
  Simulation Core/replay-hash semantic change;
- real PostgreSQL cannot be provisioned locally and in CI;
- any required acceptance row remains UNKNOWN, NOT_RUN or NOT_MAPPED;
- default full suite fails with a new W024 failure;
- CodeGraph would require an index in the source worktree;
- the Product PR needs a second ordinary product PR beyond the one same-wave
  recovery allowance;
- a merge attempt fails; do not retry blindly;
- post-merge validation fails; do not create Governance Closure.

Upon a stop condition, record `STOP_PRESERVE_EVIDENCE_REQUEST_NEW_OWNER_DECISION`
unless the W024 prompt explicitly classifies the issue as an ordinary in-scope
defect fixable inside this wave.
