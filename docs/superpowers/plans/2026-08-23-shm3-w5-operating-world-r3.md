# SimWar SH-M3 W5 Operating World Consequence and Replay Integrity R3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carry the verified R2 Operating World candidate into the existing W4/W3 official consequence path so an exact Operating World binding is auditable through W4 admission, official state outcome, replay evidence, publication, and a role-safe deterministic consequence trace.

**Architecture:** Operating World remains a W5 governed input and never writes SettlementResult, replay_hash, EnterpriseState, score, rank, or publication truth. The existing W4 strategic decision/action and W4 replay manifest remain the sole official state/replay authority; R3 adds only an optional exact binding digest to the existing W4 manifest and a derived W3 `OperatingWorldConsequenceTrace` projection after official settlement/publication. Student, Teacher, and Admin surfaces consume role-safe projections from the existing BFF paths.

**Tech Stack:** TypeScript, npm workspaces, shared TypeScript contracts, JSON Schema Draft 2020-12, OpenAPI, Vitest, existing JSON repository adapter, existing W3/W4 services, and Playwright real-BFF tests.

**Spec:** `C:/Users/Marshall/Downloads/SimWar_SHM3_W5_OperatingWorld_Consequence_Replay_R3_Codex产品级宏任务提示词_V1.0_20260823.docx` plus `C:/Users/Marshall/Downloads/SimWar_SHM3_W5_OperatingWorld_Consequence_Replay_R3_产品级宏任务开发方案_V1.0_20260823 (2).docx`.

## Global Constraints

- Preserve the JSON runtime as the active authority.
- Do not change `SettlementResult` shape, `replay_hash` generation, `buildReplayHash` inputs, or canonical/latest Decision selection.
- Do not create a second Truth, Settlement, W4/EnterpriseState, Replay, Publication, W5 lifecycle, or Model Governance writer.
- Operating World lifecycle remains `DRAFT → VALIDATED → FROZEN → BOUND`; Preview remains receipt-only and non-official.
- Only an exact current W4 capital action admitted through the existing bridge may receive `OFFICIAL_CONSUMER_ELIGIBLE`; unsupported, stale, preview, shadow, information, and blocked inputs remain non-official.
- Student projections exclude raw source paths, private coefficients, hidden calibration, future hidden shock timing, private manifests, state_true, and other-team data.
- Trace fields are deterministic system facts; `writes_official_state=false` and `ai_generated=false` are mandatory.
- No raw Shanghai data is copied into the repository.
- Stage only explicitly scoped files; never use `git add -A`.
- Remote Push, Product PR, required-check readback, Merge, and post-merge verification remain `NOT_AUTHORIZED` until a current user message supplies the required top-level Owner Envelope.

---

### Task 1: R2 candidate port map and control-plane characterization

**Files:**

- Create: `docs/evidence/shm3-w5-operating-world-r3/R2_CANDIDATE_PORT_MAP.md`
- Create: `docs/evidence/shm3-w5-operating-world-r3/CONTROL_PLANE_RECONCILIATION.md`
- Test: `tests/unit/operating-world-r3-control-plane.test.ts`

**Interfaces:**

- Consumes: R2 commit `5e378cb6707ba033e5d9e0552b3a2c53287f6dc2`, current R2 source, current W5/W4/W3 contracts, and exact file status.
- Produces: explicit `PORT_AS_IS`, `PORT_PATCH`, `NESTED_VALUE_OBJECT`, `PROJECTION_ONLY`, `DROP_DUPLICATE`, and `NOT_PROVEN` classifications with no second lifecycle/store/registry claim.

- [ ] **Step 1: Write the characterization test** asserting that the R2 Operating World service/store remains the single lifecycle for its draft and that R3 trace code is projection-only.
- [ ] **Step 2: Run the characterization test** with `npx vitest run tests/unit/operating-world-r3-control-plane.test.ts`; record the current expected failure for the not-yet-created R3 evidence artifacts.
- [ ] **Step 3: Write the source-backed port map and reconciliation receipt** with exact commit, changed files, allowed carry-forward, R3 patch points, and unresolved structural limits.
- [ ] **Step 4: Run the characterization test again** and commit only the evidence and test files.

### Task 2: Exact Operating World binding in the existing W4 replay manifest

**Files:**

- Modify: `packages/shared-contracts/src/w4-enterprise-state.ts`
- Modify: `contracts/schemas/w4-enterprise-state.v1.json`
- Modify: `contracts/openapi/p0-api.openapi.yaml`
- Modify: `services/api/src/routes/w4-enterprise-state-routes.ts`
- Modify: `services/api/src/server.ts`
- Test: `tests/unit/operating-world-w4-replay-manifest.test.ts`
- Test: `tests/contract/w4-enterprise-state-contract.test.ts`

**Interfaces:**

- Consumes: existing `W4ReplayInputManifest`, `assertSettlementReady`, W4 canonical capital action, and existing `resolveOperatingWorldConsumer` bridge.
- Produces: optional `operating_world_binding_digest?: string` on the existing W4 manifest; the field is populated only when the existing W4 capital action has `cost_source=operating-world:<digest>` and remains absent for non-Operating-World, Preview, Shadow, Information, stale, or blocked inputs.

- [ ] **Step 1: Write failing tests** for exact digest propagation, stale/unsupported omission, and no mutation of `SettlementResult` or `replay_hash`.
- [ ] **Step 2: Run the focused tests** and confirm they fail because the manifest has no Operating World digest seam.
- [ ] **Step 3: Add the optional shared-contract/schema/OpenAPI field** without changing required fields or historical normalization bytes.
- [ ] **Step 4: Extend the existing W4 `assertSettlementReady` dependency seam** to resolve the exact digest from the existing W4 action/manifest authority; do not create a new store or writer.
- [ ] **Step 5: Run focused unit/contract tests** and verify all existing W4 replay tests remain green.

### Task 3: Deterministic role-safe Operating World Consequence Trace

**Files:**

- Create: `packages/shared-contracts/src/operating-world-consequence-trace.ts`
- Modify: `packages/shared-contracts/src/index.ts`
- Create: `contracts/schemas/operating-world-consequence-trace.v1.json`
- Modify: `contracts/schemas/w3-official-consequence-learning.v1.json`
- Modify: `contracts/openapi/p0-api.openapi.yaml`
- Create: `services/api/src/operating-world-consequence-trace.ts`
- Modify: `services/api/src/w3-official-consequence-learning.ts`
- Test: `tests/unit/operating-world-consequence-trace.test.ts`
- Test: `tests/unit/w3-official-consequence-learning.test.ts`
- Test: `tests/contract/operating-world-consequence-trace-contract.test.ts`

**Interfaces:**

- Consumes: exact W4 manifest/action, canonical Decision ref, settlement/result ref, publication timestamp/status, and the R2 Operating World binding digest.
- Produces: optional `operating_world_consequence_trace` with safe scope, binding digest/ref, canonical/W4/settlement/replay refs, allowed effect list, constraints, known limits, safe classification, `writes_official_state:false`, `causal_authority:"DETERMINISTIC_SYSTEM_FACTS"`, and `ai_generated:false`.

- [ ] **Step 1: Write failing pure-function tests** for the official SH-17 capital-cost path, shadow/information/blocked zero-delta paths, deterministic same-input parity, and forbidden-field rejection.
- [ ] **Step 2: Run the focused tests** and confirm the trace helper/type is absent or the W3 record lacks the new projection.
- [ ] **Step 3: Implement the minimal pure deterministic trace builder**; expose only bounded input buckets and public effect direction, never private coefficients or raw source paths.
- [ ] **Step 4: Extend W3 record validation and JSON Schema** with an optional strict trace object, preserving the existing W3 record schema version and existing authority fields.
- [ ] **Step 5: Wire W3 `buildRecord` through a read-only dependency** that resolves the already-committed W4/Operating World evidence; Student receives the safe projection only after publication, Teacher receives governed detail, and missing official evidence fails closed rather than fabricating a trace.
- [ ] **Step 6: Run unit and contract tests** for the trace and existing W3 behavior.

### Task 4: W3/M2-P5/Teacher/Student/Admin product projections

**Files:**

- Modify: `services/api/src/server.ts`
- Modify: `services/api/src/m2p5-decision-learning-crossround.ts`
- Modify: `apps/student/src/W3OfficialConsequenceLearningPanel.tsx`
- Modify: `apps/student/src/P2BDecisionLearningJourney.tsx`
- Modify: `apps/teacher/src/W3OfficialConsequenceLearningWorkbench.tsx`
- Modify: `apps/teacher/src/P2BTeacherDebriefWorkspace.tsx`
- Modify: `apps/admin/src/OperatingWorldAuditPanel.tsx`
- Test: `tests/unit/w3-official-consequence-learning.test.ts`
- Test: `tests/unit/m2p5-decision-learning-crossround.test.ts`
- Test: `tests/e2e-ui/operating-world.spec.ts`
- Test: `tests/e2e-ui/pr4-p2b-decision-learning-teacher-debrief.spec.ts`

**Interfaces:**

- Consumes: the shared W3 trace projection and existing role/context routes.
- Produces: Student post-publish safe trace and reflection handoff, Teacher exact governed trace/debrief, and Admin read-only exact binding → W4 manifest → official result/replay audit; pre-publish Student trace remains unavailable.

- [ ] **Step 1: Write failing projection/browser assertions** for publication firewall, Student forbidden fields, Teacher governed effect visibility, Admin exact digest visibility, and reflection/business-truth separation.
- [ ] **Step 2: Run focused tests** and confirm the current projections do not expose the R3 trace.
- [ ] **Step 3: Add only projection rendering and server wiring**; do not add frontend authority, direct settle routes, or local truth calculations.
- [ ] **Step 4: Run focused UI/unit tests** and verify stale context clears the trace.

### Task 5: Security, metamorphic, recovery, and real-BFF corridor

**Files:**

- Modify: `tests/integration/operating-world-endpoint.test.ts`
- Modify: `tests/integration/round-lock-publish-characterization.test.ts`
- Modify: `tests/integration/r7b-golden-m1-replay-compatibility.test.ts`
- Create: `tests/integration/operating-world-consequence-corridor.test.ts`
- Modify: `tests/e2e-ui/operating-world.spec.ts`
- Modify: `tests/e2e-ui/m2-p5-decision-learning-crossround.spec.ts`

**Interfaces:**

- Consumes: real API/BFF routes, existing fixtures, existing JSON runtime, and the Task 2–4 contracts.
- Produces: evidence for exact bind → W4 action/admission → W4 official state/replay manifest → existing Settlement → Publish → W3 trace; cross-tenant/course/run/round/team/role denial; duplicate/conflict/stale/cache/restart handling; and route mocks count zero for the new corridor.

- [ ] **Step 1: Add failing integration cases** for M1–M7 metamorphic properties and cross-scope/recovery matrix.
- [ ] **Step 2: Run the failing cases** and capture the first failure fingerprint.
- [ ] **Step 3: Implement only missing fail-closed guards or deterministic projection joins.**
- [ ] **Step 4: Run focused integration tests and real-BFF Playwright** with no mocked target routes.

### Task 6: Local verification, review, and bounded handoff

**Files:**

- Modify: relevant touched files only
- Create: `docs/evidence/shm3-w5-operating-world-r3/LOCAL_VALIDATION_RECEIPT.md`

**Interfaces:**

- Consumes: all prior task artifacts, exact worktree/branch state, and repository quality commands.
- Produces: local evidence with `VERIFIED`, `NOT_PROVEN`, `NOT_AUTHORIZED`, and `BLOCKED` classifications; explicit files/tests/commands; no remote claim.

- [ ] **Step 1: Run focused tests, contract gate, typecheck, lint, build, hidden-unicode, direct-store boundary, and applicable full local suite once.**
- [ ] **Step 2: Run exact-head local review and inspect `git diff --check`, status, and changed-file allowlist.**
- [ ] **Step 3: Run the verification-before-completion checklist and request a read-only code review when callable.**
- [ ] **Step 4: Create one explicit-scope local Conventional Commit only after all local gates pass.**
- [ ] **Step 5: Record remote Product PR/required checks/merge/post-merge as `NOT_AUTHORIZED` unless the current user message supplies the required Owner Envelope; do not invent a successor task.**
