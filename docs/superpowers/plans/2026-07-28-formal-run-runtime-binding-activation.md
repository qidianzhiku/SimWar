# Formal Run Runtime Binding Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bind newly created JSON-runtime Runs to exact formal Authority artifacts and use those frozen inputs for settlement and private Replay evidence without changing legacy Run behavior.

**Architecture:** Keep the public, ID-only `Run` unchanged. Persist an append-only private `FormalRunRuntimeBinding` record keyed by tenant and Run, and resolve it through the existing formal Authority ports when a Run has one. Runs without a record stay explicitly `LEGACY_ID_ONLY`; their settlement inputs and replay hashes remain byte-for-byte compatible.

**Tech Stack:** TypeScript, Node HTTP API, npm workspaces, Vitest, existing JSON store adapter, shared contracts.

## Global Constraints

- JSON remains the only active runtime; no PostgreSQL, migration, route activation beyond the existing Run-create route, UI, AI, or default-scenario change.
- Simulation Core remains the sole SettlementResult, Score, Rank, and truth writer.
- Do not derive a formal binding from `store.scenarios` or `store.parameterSets`.
- A formal binding is private: Student projections must not expose exact references, binding digests, resolution digests, manifests, or Authority metadata.
- Existing ID-only Runs remain `LEGACY_ID_ONLY`; no auto-upgrade or auto-latest lookup is permitted.
- Preserve existing `buildReplayHash` inputs and legacy replay hash values.

---

### Task 1: Add append-only private binding persistence

**Files:**

- Modify: `services/api/src/store.ts`
- Create: `services/api/src/formal-run-runtime-binding-store.ts`
- Test: `tests/unit/formal-run-runtime-binding-store.test.ts`

**Interfaces:**

- Produces `FormalRunRuntimeBindingStore` with `append(binding)` and `getForRun(tenantId, runId)`.
- Store snapshots gain an optional backward-compatible `formalRunRuntimeBindings` collection, defaulting to `[]` when absent.

- [ ] **Step 1: Write failing persistence tests**

Test that a binding can be appended once, survives snapshot round-trip, returns a defensive copy, and rejects a second binding for the same tenant/Run.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/unit/formal-run-runtime-binding-store.test.ts`

Expected: FAIL because the private binding store does not exist.

- [ ] **Step 3: Implement the smallest private JSON-backed store**

Only append valid `FormalRunRuntimeBinding` values, never mutate a saved record, and scope lookup by tenant plus Run.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npx vitest run tests/unit/formal-run-runtime-binding-store.test.ts`

Expected: PASS.

### Task 2: Resolve runtime inputs from exactly one path

**Files:**

- Create: `services/api/src/run-runtime-inputs.ts`
- Modify: `services/api/src/formal-runtime-input-resolver.ts`
- Test: `tests/unit/run-runtime-inputs.test.ts`

**Interfaces:**

- Produces `resolveRunRuntimeInputs({ authorities?, bindingStore, legacyPorts, run, tenantId })`.
- Returns `LEGACY_ID_ONLY` with legacy runtime inputs when no binding exists.
- Returns `FORMAL_AUTHORITY_EXACT` with exact materialized inputs, binding digest, and resolution digest when a binding exists.

- [ ] **Step 1: Write failing resolution tests**

Cover a formal binding whose exact ScenarioPackage, ParameterSet, and PluginRelease values reach runtime materialization; cover a missing/invalid authority and legacy Run classification.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/unit/run-runtime-inputs.test.ts`

Expected: FAIL because no active Run resolver exists.

- [ ] **Step 3: Implement the shared resolver**

Use `resolveFormalRuntimeInputsForHistoricalRead` only for saved bindings. Convert validated formal content to the current simulation input shape without selecting latest values. Reject missing required runtime values before Settlement.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npx vitest run tests/unit/run-runtime-inputs.test.ts`

Expected: PASS.

### Task 3: Add the formal Run-create request branch

**Files:**

- Modify: `packages/shared-contracts/src/index.ts`
- Modify: `contracts/openapi/p0-api.openapi.yaml`
- Modify: `services/api/src/server.ts`
- Test: `tests/integration/formal-run-runtime-binding-activation.test.ts`

**Interfaces:**

- Optional request body contains all of `scenario_package_reference`, `parameter_set_reference`, and `seed`, or contains none.
- Formal requests require injected `FormalRunBindingAuthorityPorts`, verify course ID consistency, create the binding before Run/Round mutation, and append it before returning `201`.

- [ ] **Step 1: Write failing end-to-end tests**

Exercise exact formal creation, failed digest/partial input with zero Run/round/binding mutation, and legacy empty-body creation that remains `LEGACY_ID_ONLY`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/integration/formal-run-runtime-binding-activation.test.ts`

Expected: FAIL because the API ignores formal references and does not persist a binding.

- [ ] **Step 3: Implement the minimal request path**

Inject formal authority ports through `CreateApiServerOptions`; do not create a second registry or read formal values from the legacy Store.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npx vitest run tests/integration/formal-run-runtime-binding-activation.test.ts`

Expected: PASS.

### Task 4: Route Settlement and private Replay through the shared inputs

**Files:**

- Modify: `services/api/src/server.ts`
- Modify: `services/api/src/run-manifest-replay-evidence.ts`
- Modify: `packages/shared-contracts/src/index.ts`
- Test: `tests/integration/formal-run-runtime-binding-activation.test.ts`
- Test: `tests/integration/m1-run-manifest-replay-evidence.test.ts`

**Interfaces:**

- Settlement reads either legacy inputs or the exact frozen binding through `resolveRunRuntimeInputs`.
- Private manifest records formal classification and frozen binding/resolution digests only for formal Runs.
- Public/Student results omit formal binding metadata.

- [ ] **Step 1: Extend the failing integration test**

Settle and publish a formal Run, assert the private evidence records the exact binding and resolution digests, replay matches without formal writes, and Student output omits all private binding markers.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run tests/integration/formal-run-runtime-binding-activation.test.ts tests/integration/m1-run-manifest-replay-evidence.test.ts`

Expected: FAIL because Settlement and Replay still independently use ID-only facade reads.

- [ ] **Step 3: Implement the shared path**

Use the resolved inputs for `prepareSettlementOutcome` and `createM1RunReplayEvidence`; preserve legacy call behavior and legacy digest output when the classification is `LEGACY_ID_ONLY`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npx vitest run tests/integration/formal-run-runtime-binding-activation.test.ts tests/integration/m1-run-manifest-replay-evidence.test.ts`

Expected: PASS.

### Task 5: Validate, review impact, and close the PR

**Files:**

- Verify only the files above and their required tests.

- [ ] **Step 1: Run required local validation**

Run targeted tests, `npm run check:hidden-unicode`, `npm run check:direct-store-boundaries`, `npm run lint`, `npm run typecheck`, `npm run test:contract`, `npm test`, `npm run build`, `npm run security:audit`, `npm run format:check`, and `git diff --check`.

- [ ] **Step 2: Run CodeGraph impact analysis**

Sync the local CodeGraph index and inspect all callers of the changed RuntimeBinding, persistence, Settlement, and Replay symbols.

- [ ] **Step 3: Commit and publish the bounded PR**

Stage only reviewed allowlisted files; use a Conventional Commit; push once; create one non-draft PR with Summary, Validation, and Scope Notes.

- [ ] **Step 4: Perform independent exact-head review and ordinary merge closure**

Refresh base/head/file scope/checks/reviews, merge once only if all gates are green, and perform fresh-clone post-merge validation.
