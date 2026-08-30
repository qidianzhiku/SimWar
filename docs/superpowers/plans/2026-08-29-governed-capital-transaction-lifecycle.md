# Governed Capital Transaction Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one reproducible Teacher → Student → Admin governed capital-transaction journey on the existing W4 state and sole-writer path, with explicit eligibility, approval, execution, closed/withdrawn/defaulted outcomes, exact scope, and cross-round evidence.

**Architecture:** Extend the existing `W4EnterpriseStateStrategicEvolutionService` and W4 route/BFF projection rather than creating a second store, writer, registry, or truth engine. Capital lifecycle records remain governance/control-plane inputs until the existing canonical W4 decision is admitted; official cash, covenant, and settlement effects continue through `services/simulation-core` and the existing W4 enterprise-state persistence path.

**Tech Stack:** TypeScript, npm workspaces, Node HTTP API, Vitest, Playwright, JSON Schema/OpenAPI, JSON runtime store.

**Spec:** `C:/Users/Marshall/AppData/Local/Temp/simwar-closed-program-20260829/prompts/R1_MAIN-CTL-O1-GOVERNED-CAPITAL-TRANSACTION-LIFECYCLE.md`

## Global Constraints

- One existing W4 enterprise-state/project/capital sole-writer path; formal writer mutation remains 0 unless a typed extension is proven necessary.
- `WANT != CAN != REALIZED`, `Confirm != Lock`, `Lock != Settlement`, and `SETTLED != PUBLISHED` remain enforced.
- JSON runtime remains the default; Provider is OFF; PostgreSQL/RLS, banking integration, external execution, Pilot, and Production are out of scope.
- Only one dedicated branch, one Product PR, at most two non-force pushes, no force push, and Product PR remains unmerged until the machine merge gate authorizes ordinary merge.
- Every lifecycle command is exact tenant/course/run/team/round scoped, idempotent where retried, and rejects stale/conflicting/unauthorized input.
- Student receives only role-safe projections; Admin receives exact provenance/audit; no role draft or advisory can write official truth.

---

### Task 1: Freeze R1 source map and focused contract shape

**Files:**

- Create: `docs/superpowers/plans/2026-08-29-governed-capital-transaction-lifecycle.md` (this plan)
- Test: `tests/contract/governed-capital-lifecycle-contract.test.ts`
- Modify: `contracts/openapi/p0-api.openapi.yaml`
- Modify: `contracts/schemas/w4-enterprise-state.v1.json`
- Modify: `packages/shared-contracts/src/w4-enterprise-state.ts`

**Interfaces:**

- Consumes: existing `W4CapitalAction`, `W4PolicySeam`, `W4ProjectTransaction`, W4 BFF routes, and current `W4_ENTERPRISE_STATE_SERVICE` writer authority.
- Produces: typed `W4CapitalLifecycle` and `W4CapitalLifecycleReceipt` shapes, one lifecycle command envelope, and exact route/schema declarations for proposal, approval, execution and role projections.

- [ ] **Step 1: Write the failing contract test**

```ts
it("requires an exact scoped capital lifecycle contract and preserves the existing writer authority", () => {
  const schema = readJson("contracts/schemas/w4-enterprise-state.v1.json");
  expect(schema.$defs.capitalLifecycle.required).toEqual([
    "lifecycle_id",
    "tenant_id",
    "course_id",
    "run_id",
    "team_id",
    "round_id",
    "round_no",
    "instrument",
    "status",
    "principal",
    "cost_bps",
    "fee",
    "term_rounds",
    "covenant_min_cash",
    "decision_id",
    "source_digest"
  ]);
  expect(schema.$defs.capitalLifecycle.properties.status.enum).toEqual([
    "ELIGIBLE",
    "PROPOSED",
    "APPROVED",
    "EXECUTING",
    "CLOSED",
    "WITHDRAWN",
    "DEFAULTED"
  ]);
  const openapi = readText("contracts/openapi/p0-api.openapi.yaml");
  expect(openapi).toContain("W4_CAPITAL_LIFECYCLE");
  expect(openapi).toContain("SOLE_W4_ENTERPRISE_STATE_SERVICE");
});
```

- [ ] **Step 2: Run the contract test and observe the missing lifecycle contract**

Run: `npm.cmd exec -- vitest run tests/contract/governed-capital-lifecycle-contract.test.ts`

Expected: FAIL because `capitalLifecycle` and the lifecycle operation declarations do not yet exist.

- [ ] **Step 3: Add the minimal shared types and schema/OpenAPI declarations**

Add a finite `W4CapitalLifecycleStatus`, an explicit instrument union (`loan`, `refinancing`, `m_and_a`, `abs`, `ipo`), exact scope fields, deterministic source digest, and receipt fields for approval actor, transition history, cost, cycle, covenant, failure, rollback and writer authority. Keep the official effect reference optional until execution is accepted by the existing W4 path. Add only the corresponding operation IDs under the existing W4 route family.

- [ ] **Step 4: Run the focused contract test again**

Run: `npm.cmd exec -- vitest run tests/contract/governed-capital-lifecycle-contract.test.ts`

Expected: PASS with the new finite status, exact scope, and sole-writer declarations.

- [ ] **Step 5: Inspect the diff and commit the contract boundary**

Run: `git diff --check; git diff -- contracts/openapi/p0-api.openapi.yaml contracts/schemas/w4-enterprise-state.v1.json packages/shared-contracts/src/w4-enterprise-state.ts tests/contract/governed-capital-lifecycle-contract.test.ts`

Expected: only the R1 contract files and this focused contract test are changed.

### Task 2: Implement deterministic lifecycle state machine and receipts

**Files:**

- Test: `tests/unit/governed-capital-lifecycle.test.ts`
- Modify: `services/api/src/w4-enterprise-state.ts`
- Modify: `packages/shared-contracts/src/w4-enterprise-state.ts`

**Interfaces:**

- Consumes: `W4CapitalLifecycle` types and the existing repository snapshot/commit boundary.
- Produces: service methods `proposeCapitalLifecycle`, `approveCapitalLifecycle`, `executeCapitalLifecycle`, `withdrawCapitalLifecycle`, `recordCapitalDefault`, `getCapitalLifecycleReceipt`.

- [ ] **Step 1: Write RED tests for transitions and guards**

Cover: `ELIGIBLE → PROPOSED → APPROVED → EXECUTING → CLOSED`, approved withdrawal, covenant-driven default, duplicate command rejection, stale round rejection, wrong tenant/team rejection, and deterministic source digest. Assert that no lifecycle operation directly changes `states`, `outcomes`, or settlement fields before the existing W4 decision path runs.

- [ ] **Step 2: Run the unit test and verify it fails for missing service methods**

Run: `npm.cmd exec -- vitest run tests/unit/governed-capital-lifecycle.test.ts`

Expected: FAIL with missing lifecycle API or missing lifecycle state.

- [ ] **Step 3: Add the minimal repository-backed state and transition validator**

Store lifecycle records in the existing W4 store snapshot, validate exact scope and monotonic round, reject duplicate `command_id`, enforce the finite transition table, calculate cost/fee/cycle/covenant values from the typed payload, append an auditable transition receipt, and expose only a cloned result. Use the existing `commitW4Mutation`/repository commit path; do not add a writer or store.

- [ ] **Step 4: Run the unit test and verify GREEN**

Run: `npm.cmd exec -- vitest run tests/unit/governed-capital-lifecycle.test.ts`

Expected: PASS with all transition, idempotency, stale/conflict, failure and non-write assertions.

- [ ] **Step 5: Run affected existing W4 unit tests**

Run: `npm.cmd exec -- vitest run tests/unit/w4-capital-action.test.ts tests/unit/w4-enterprise-state.test.ts tests/unit/w4-project-portfolio.test.ts tests/unit/governed-capital-lifecycle.test.ts`

Expected: PASS; no existing W4 truth or replay behavior changes.

### Task 3: Add exact route/BFF and role-safe projections

**Files:**

- Test: `tests/integration/governed-capital-lifecycle-endpoint.test.ts`
- Modify: `services/api/src/routes/w4-enterprise-state-routes.ts`
- Modify: `services/api/src/server.ts`
- Modify: `services/api/src/store.ts` only if the existing snapshot normalization requires the new optional W4 field

**Interfaces:**

- Consumes: lifecycle service methods and current authentication/tenant/run/team/round resolvers.
- Produces: teacher lifecycle command routes under `/api/v1/w4/.../capital-lifecycles`, and role-safe BFF projections under the existing `bff/{teacher|student|admin}/w4` surface.

- [ ] **Step 1: Write RED integration tests**

Exercise Teacher proposal/approval/execution, Student read-only result and explanation, Admin receipt/audit, duplicate retry, stale round, cross-tenant/team access, malformed nested input, and pre-publish Student redaction. Assert all target responses are produced by the real API and contain `mocks=0`-compatible route data.

- [ ] **Step 2: Run the integration test to confirm the route is absent**

Run: `npm.cmd exec -- vitest run tests/integration/governed-capital-lifecycle-endpoint.test.ts`

Expected: FAIL with 404 or the expected lifecycle payload missing.

- [ ] **Step 3: Implement the minimal routes and DTO projections**

Reuse `routeScope`, `assertRuntimeScope`, `assertWritableRound`, `errorStatus`, and existing auth roles. Reject client-supplied tenant/role overrides. Teacher gets command responses; Student receives instrument/status/mechanism/limits without private approval or raw audit details; Admin receives exact transition receipt and provenance. No route calls `repository.commit` directly and no frontend calculates official effects.

- [ ] **Step 4: Run the integration test and existing route tests**

Run: `npm.cmd exec -- vitest run tests/integration/governed-capital-lifecycle-endpoint.test.ts tests/integration/w4-enterprise-state-endpoint.test.ts tests/integration/w4-project-portfolio-endpoint.test.ts`

Expected: PASS.

- [ ] **Step 5: Run contract and type checks**

Run: `npm.cmd run test:contract; npm.cmd run typecheck`

Expected: PASS; any pre-existing unrelated baseline failure is recorded separately and does not get hidden.

### Task 4: Complete the real-BFF Teacher → Student → Admin browser journey

**Files:**

- Test: `tests/e2e-ui/governed-capital-lifecycle.spec.ts`
- Modify: `apps/teacher/src/*` only where the existing Teacher W4 surface needs lifecycle controls
- Modify: `apps/student/src/*` only where the existing Student W4 surface needs the role-safe lifecycle projection
- Modify: `apps/admin/src/*` only where the existing Admin W4 surface needs the audit receipt

**Interfaces:**

- Consumes: real API/BFF lifecycle endpoints and existing W4 UI composition.
- Produces: one browser-verifiable product journey with real API calls, no route mocks, explicit recovery and role/privacy assertions.

- [ ] **Step 1: Add the browser RED journey**

Start the real API and three Vite apps using the repository Playwright configuration. Log in as Teacher, submit and approve a bounded action, execute it, verify Student sees only safe status/mechanism/limits, then verify Admin sees the exact receipt and audit chain. Add withdrawal/default recovery and responsive checks.

- [ ] **Step 2: Run the browser test and capture the first real failure**

Run: `npm.cmd exec -- playwright test tests/e2e-ui/governed-capital-lifecycle.spec.ts --config playwright.config.ts`

Expected: FAIL at the first missing UI journey step, with no route mocking.

- [ ] **Step 3: Implement the smallest UI composition**

Use existing surfaces/components and existing fetch/BFF patterns. Keep lifecycle controls on Teacher, never expose Teacher/Admin approval details to Student, and render official numeric effects only from API state/outcome projections. Do not add a new app or client-side truth calculation.

- [ ] **Step 4: Run the browser journey and focused W4 browser tests**

Run: `npm.cmd exec -- playwright test tests/e2e-ui/governed-capital-lifecycle.spec.ts tests/e2e-ui/w4-enterprise-state.spec.ts --config playwright.config.ts`

Expected: PASS with real API route count and no mocks in the target journey.

- [ ] **Step 5: Run UI builds**

Run: `npm.cmd run build`

Expected: PASS for shared contracts, services and all three apps.

### Task 5: Execute R1 validation and prepare the Product PR

**Files:**

- Create: external R1 evidence directory under `C:\Users\Marshall\AppData\Local\Temp\simwar-main-ctl-o1-r1-results`
- Create: the R1 FINAL-results ZIP outside the repository
- Modify: only R1 implementation/test/contract/UI files from Tasks 1–4

**Interfaces:**

- Consumes: exact R1 branch head and all implementation/test outputs.
- Produces: H2, L5, machine merge gate, PR body, round evidence ZIP and checkpoint capsule; Product PR remains unmerged until the authorized merge step.

- [ ] **Step 1: Run the complete local R1 gate**

Run the real commands selected from `package.json`: `npm.cmd run check:hidden-unicode; npm.cmd run format:check; npm.cmd run lint; npm.cmd run typecheck; npm.cmd run test:contract; npm.cmd test; npm.cmd run build; npm.cmd run test:e2e:ui`.

Expected: record exact results, baseline failures, limits, elapsed time and evidence path; do not relabel a partial pass as full green.

- [ ] **Step 2: Run independent H2 from a clean checkout**

Create a second clean worktree at the exact Product PR head, use isolated ports and fresh JSON fixtures, run the targeted API and browser journey, and record `JOIN` or `JOIN_WITH_LIMITS` with exact SHA/tree.

- [ ] **Step 3: Run exact-head L5 and machine merge gate**

Freeze the semantic head, verify diff scope, required checks, CodeQL, browser, bundle, security, role/privacy, no second writer/store/registry, and one PR only. Produce the PR body with Summary, Validation and Scope Notes.

- [ ] **Step 4: Perform only the authorized ordinary merge and detached H3/L6**

After fresh remote readback and machine gate, merge the one R1 Product PR normally, record the actual merge SHA, run detached post-merge H3/L6 on the exact protected master/tree, and do not start R2 until the checkpoint capsule and R1 ZIP verify.

- [ ] **Step 5: Independently verify the round ZIP**

Confirm every manifest entry exists physically, every checksum resolves, JSON parses, DOCX/ZIP members are portable, no secrets/tokens/private data exist, and report the archive SHA-256.

### Task 6: Fresh-admit R2, R3 and R4 using the same controlled loop

**Files:**

- Create: external per-round evidence directories and FINAL-results ZIPs
- Modify: only files frozen by each round's fresh source map, C10 and Admission Card

**Interfaces:**

- Consumes: the previous round's actual merge SHA/tree, detached H3/L6, fresh H0/capability register/admission/capsule, and the R2/R3/R4 prompts.
- Produces: exactly one Product PR per round, actual merge SHA per round, detached H3/L6 per round, and a complete program chain.

- [ ] **Step 1: Fresh-admit R2 only after verified R1 merge/H3**
- [ ] **Step 2: Complete R2 source-backed model qualification and teaching review**
- [ ] **Step 3: Fresh-admit R3 only after verified R2 merge/H3 and complete enterprise course factory/sponsor journey**
- [ ] **Step 4: Fresh-admit R4 only after verified R3 merge/H3 and complete AI-off governed intelligence journey**
- [ ] **Step 5: Run Program H3 and stop without R5, Human Validation, Pilot, Production or automatic successor**

Each step repeats the same exact current-source, dual-KG attempt, bounded Vault, TDD, H2, L5, required checks, machine merge gate, ordinary merge, detached H3/L6 and ZIP verification. Any identity, source, permission, remote-budget, nonwaivable platform, or truth-ownership mismatch stops the chain.
