# Eldercare Shanghai Golden M1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Materialize the existing synthetic Shanghai Eldercare R7 assets through formal authority APIs and prove a deterministic, tenant-isolated Golden M1 course journey ready for a later human validation operator.

**Architecture:** Keep the simulation kernel and existing formal command services unchanged. Add one pure API-side adapter that produces deterministic draft inputs from R7A/R7B/R7C evidence, then exercise the existing HTTP authority and course-delivery chain. Browser verification consumes existing Admin/Teacher/Student surfaces and only asserts visibility/redaction.

**Tech Stack:** TypeScript, shared contracts, Node HTTP API, Vitest, Playwright, JSON_INTERNAL_ONLY runtime, existing Graph Companion evidence.

## Global Constraints

- `JSON_INTERNAL_ONLY` remains the active runtime authority; PostgreSQL is not activated.
- `services/simulation-core` remains the sole formal truth computation/write boundary.
- No changes to settlement logic, SettlementResult shape, replay hash inputs, canonical/latest decision selection, or W020 advisory semantics.
- R7 evidence remains `L0_SYNTHETIC`, `SYNTHETIC_TEACHING_BASELINE`, `REALITY_CALIBRATION_NOT_PROVEN`.
- No new registry, second Truth/Settlement engine, external AI provider, secrets, Pilot, Production, C2, or automatic successor.
- Exactly one product branch and one primary PR are allowed; ordinary merge only after all gates and independent challenge pass.

---

### Task 1: Lock current reality and evidence contract

**Files:**

- Create external only: `C:\Users\Marshall\AppData\Local\Temp\E-SIMWAR-ELDERCARE-SHANGHAI-GOLDEN-M1-20260809T084954Z\01-current-reality.json`
- Create external only: `...\03-eldercare-asset-map.json`
- Create external only: `...\04-codegraph-query-pack.json`
- Reference: `...\E-SIMWAR-ELDERCARE-SHANGHAI-GOLDEN-M1-REBUILD-20260809T084518Z\graph-companion\graph-state.json`

**Interfaces:**

- Consumes exact `origin/master=140085558cfa49e27f7dc512beb2867c4c5e81e4`, Graph Companion rebuild receipts, and Q1–Q9 CodeGraph output.
- Produces an evidence-bound asset map and query pack with `automatic_next_start=false`.

- [x] Record current SHA, graph freshness, Graphify/CodeGraph health, runtime authority, synthetic reality level and known planning drift.
- [x] Record R7A/R7B/R7C paths, symbols, authority status, tenant semantics and test coverage.
- [x] Record Q1–Q9 query strings, external workspace and source-readback anchors.

### Task 2: Add the pure Golden M1 asset adapter

**Files:**

- Create: `services/api/src/eldercare-golden-m1.ts`
- Test: `tests/unit/eldercare-golden-m1.test.ts`

**Interfaces:**

- Consumes `compileShanghaiEldercareScenarioAsset()` and explicit `source_tenant_id`, `target_tenant_id`, and stable artifact IDs.
- Produces `createEldercareGoldenM1ParameterDraft`, `createEldercareGoldenM1ScenarioDraft`, `createEldercareGoldenM1PluginDraft`, `createEldercareGoldenM1BlueprintDraft`, and `createEldercareGoldenM1CoursePackageDraft` inputs with no persistence side effect.

- [x] Write failing tests for deterministic output, exact plugin dependency, six-round metadata, synthetic labels, and rejection of blank/mismatched tenant IDs.
- [x] Run `npx vitest run tests/unit/eldercare-golden-m1.test.ts`; initial missing-module failure was recorded externally.
- [x] Implement the pure adapter; formal content digests are calculated by existing command services, while R7 `asset_hash`/`compile_hash` remain provenance metadata only.
- [x] Assert no truth-protected, `SettlementResult`, score, rank, replay authority or private assumption data enters draft inputs.
- [x] Re-run focused unit tests and scoped Prettier.

### Task 3: Prove formal materialization and the HTTP Golden M1 chain

**Files:**

- Create: `tests/integration/eldercare-shanghai-golden-m1-productization.test.ts`
- Modify only if required for test seams: `services/api/src/eldercare-golden-m1.ts`

**Interfaces:**

- Consumes adapter draft inputs and existing HTTP endpoints for plugin release, formal authorities, tenant baseline, CoursePackage, Course, Run, Round, Decision, Settlement, publish, debrief and export.
- Produces E3 evidence: `CREATED`, `AVAILABLE`, canonical decision, official settlement, student-safe result, teacher artifact/export, replay/determinism digest, no-write conflict and cross-tenant denial.

- [x] Copy existing W018 request helpers and replace generic values with adapter-produced Eldercare IDs/content.
- [x] Add RED assertions for missing, mixed/foreign-reference source scope and incomplete approval returning governed errors and unchanged formal counts.
- [x] Materialize PluginRelease `plugin_wellness_eldercare_v1@1.0.0` through its formal lifecycle before ScenarioPackage binding.
- [x] Run two fresh tenants with the same source and deterministic seed; assert different tenant-local identities but equal normalized official result digests.
- [x] Assert Student response excludes `state_true`, `replay_hash`, private replay fields and other-tenant data; HTTP Teacher evidence asserts matched replay, debrief and report/export.
- [x] Run focused integration files and retain the actual receipt.

### Task 4: Browser/Admin/Teacher/Student readiness

**Files:**

- Create: `tests/e2e-ui/eldercare-shanghai-golden-m1-browser-smoke.spec.ts`
- Create: `tests/e2e-ui/eldercare-shanghai-golden-m1-fixture.ts` only if the existing store-isolation fixture cannot seed formal references.
- Modify only if required: existing Admin/Teacher/Student component/client files, with no truth writes.

**Interfaces:**

- Consumes the E3-seeded JSON runtime and existing frontend routes.
- Produces E4 evidence for Admin selection/provisioning, Teacher course/run/result/debrief/report, and Student decision/result/advisory-safe views.

- [x] Add browser assertions for exact Eldercare title, synthetic-data label, target tenant scope and baseline outcome.
- [x] Verify Teacher sees only AVAILABLE CoursePackage plus bounded M1 result/debrief controls; HTTP coverage verifies published report/export.
- [x] Verify Student can submit the structured decision and sees safe projection without truth/private replay fields.
- [x] Verify no browser request writes R7 shadow evidence or formal truth outside canonical decision/settlement endpoints.
- [x] Run the focused Playwright spec with the repository’s existing API/store-isolation setup; mark the fresh-formal-course learner assignment limitation `E4_PARTIAL_ONLY`.

### Task 5: Determinism, Truth matrix and Human Validation readiness

**Files:**

- Create: `docs/architecture/eldercare-shanghai-golden-m1.md`
- Create external only: `05-golden-m1-contract.md`, `06-reuse-decision.md`, `07-red-tests.json`, `08-formal-binding.json`, `09-e3-golden-journey.json`, `10-e4-browser-journey.md`, `11-determinism-replay.json`, `12-truth-authority-matrix.json`, `13-test-impact.json`, `14-test-ledger.json`, `15-human-validation-readiness.md`, `final-report.md`, `99-digests.sha256`

**Interfaces:**

- Consumes test outputs, Graph Companion receipts, source asset map and current master SHA.
- Produces an executable readiness package with `HUMAN_VALIDATION_NOT_PERFORMED`, known limits, rollback/no-write checks and recommended next mission.

- [x] Record formal refs/digests and synthetic reality labels.
- [x] Compare two-tenant determinism, matched replay evidence and official result identities.
- [x] Record Truth/Settlement/Replay/Finance/Score/Rank matrix and explicit non-interference evidence.
- [x] Record all required local gates and environment-only limitations without classifying failures away.
- [x] Generate SHA-256 manifest and verify every external receipt has `automatic_next_start=false`.

### Task 6: Review, PR, merge, detached postmerge and adoption

**Files:**

- Create external only: `16-independent-challenge.md`, `17-pr-merge-receipt.json`, `18-postmerge-graph.json`
- Modify: PR body only through GitHub after final evidence is complete.

**Interfaces:**

- Consumes final worktree, exact allowlist, all receipts and three read-only reviews.
- Produces exactly one ordinary merged product PR, detached postmerge validation, Graph Companion postmerge receipt and external owner-adoption record.

- [x] Run three independent read-only reviewers: security/data-flow, authority/tenant/replay, tests/evidence/scope; repair stale findings before final review.
- [x] Stop on any `BLOCKING>0` or `MUST_FIX>0`; bounded repairs remain within the mission and did not exceed three iterations.
- [ ] Confirm the final changed-file manifest and required checks immediately before ordinary merge.
- [ ] Merge once with ordinary two-parent topology; create a fresh detached clone and rerun source/readback, Graph Companion and postmerge semantics.
- [ ] Record `ELDERCARE_SHANGHAI_GOLDEN_M1_MERGED_AND_HUMAN_VALIDATION_READY`, adoption scope and `automatic_next_start=false`; do not execute Human Validation.
