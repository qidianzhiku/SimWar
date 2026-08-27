# M2P6-O1 Teacher Debrief and Learning Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one exact-tenant/course/run/team/round, cross-role, reload-recoverable Decision → Consequence → Debrief → Reflection → What-if → Transfer → Next Opening State journey on the existing M2P5 Role BFF.

**Architecture:** Use Option A from the approved mission: extend the existing `M2P5DecisionLearningCrossRoundService` with one nested, server-owned `m2p6-teacher-debrief-learning-transfer.v1` read-only projection. First correct existing W3 and Teaching Closure read models so D3/D4 data is selected by exact `round_id` and `round_no`, then derive role-safe learning-loop state from the existing W3, D3, D4, Project, W4, Round, receipt, and provenance authorities. Do not add a route, store, registry, writer, kernel, microservice, provider dependency, database migration, or formal-state mutation.

**Tech Stack:** TypeScript, npm workspaces, Node HTTP Role BFF, React, Vitest, JSON Schema/OpenAPI, Playwright.

**Spec:** `C:\Users\Marshall\.codex\attachments\b5ebd2d6-778f-46a3-92eb-f01935386a3d\pasted-text-1.txt`

## Global Constraints

- Exact base is `89d3c852f538dfe421a5c150113f182a96b2c770` on branch `codex/main-m2p6-o1-teacher-debrief-learning-transfer-20260826`.
- `DERIVED_CROSS_ROLE_LEARNING_LOOP_PROJECTION` is the implementation pattern.
- Formal writer mutation count must remain `0`; existing D3 and W3 command paths remain the only applicable writers.
- New truth writer, settlement authority, publication authority, learning authority, store, registry, kernel, microservice, provider dependency, database migration, PostgreSQL/RLS activation, Pilot, Production, and Human Validation claims are forbidden.
- Runtime authority remains `JSON_INTERNAL_ONLY`; AI Provider remains `OFF`.
- M2P5 remains the exact-round composition seam; do not independently reconstruct W3, D3, D4, W4, and M2P5 into a second authoritative state.
- Student output must exclude `state_true`, teacher-private evidence, private role information, pre-publication results, full manifests, `decision_batch_hash`, `json_runtime_source_digest`, `canonical_evidence_digest`, and internal authority diagnostics.
- Official result and counterfactual result remain structurally distinct; counterfactuals remain non-official and AI-off.
- Keep the existing paths `/api/v1/bff/{student|teacher}/m2p5/runs/{runId}/rounds/{roundNo}/decision-learning`; target-route mocks must remain `0`.
- Recovery remains full-page reload → explicit reauthentication → existing login → tenant/user/role/role-slot validation → exact course/run/team/round validation → restored state, or fail closed.
- All implementation tasks use strict TDD: focused RED, minimal implementation, focused GREEN, affected contract/integration validation, diff inspection.
- Implementation workers execute serially because `services/api/src/server.ts`, M2P5 contracts, and the P2B surfaces are shared critical-path files.
- Do not merge. The legal stop state is `PRODUCT_PR_READY_FOR_OWNER_MERGE_DECISION`.

---

### Task 1: Correct the exact-round D3/D4 read seam

**Files:**

- Modify: `services/api/src/w3-official-consequence-learning.ts`
- Modify: `services/api/src/teaching-closure-query.ts`
- Test: `tests/unit/w3-official-consequence-learning.test.ts`
- Test: `tests/unit/teaching-closure-query.test.ts`

**Interfaces:**

- Consumes: existing `W3OfficialConsequenceContext`, `TeacherConfirmationContext.round_id`, `TeacherConfirmationContext.round_no`, and `StudentLearningReport.context.round_id/round_no`.
- Produces: `TeachingClosureQueryService.getExact(actor, context)` where `context` is `TeachingClosureContext & { round_id: string; round_no: number }`; W3 confirmation/report lookup that requires both exact round fields.

- [ ] **Step 1: Write the W3 failing regression test**

Add a real-service test named `selects the confirmation and learning report for the requested exact round` with two confirmed D3 versions for the same course/run/team/role:

```ts
const roundOne = { round_id: "round_w3", round_no: 1 };
const roundTwo = { round_id: "round_w3_2", round_no: 2 };
// B has a lexically newer confirmation version and generated_at than A.
// Request roundOne and assert the W3 response uses A, not B.
expect(result.record.learning.teacher_confirmation_ref?.resource_id).toBe("confirmation_round_1");
expect(result.record.learning.student_learning_report_ref?.resource_id).toBe("report_round_1");
```

The fixture must use the real `W3OfficialConsequenceLearningService` and complete repository-shaped doubles; expected IDs are literals, not values computed by production helpers.

- [ ] **Step 2: Write the Teaching Closure failing regression tests**

Extend the test dependency factory so it accepts literal confirmation/report arrays. Add:

```ts
it("selects round-one confirmation A when newer confirmation B belongs to round two", async () => {
  const result = await exactService([confirmationA, confirmationB]).getExact(actor, {
    ...context,
    round_id: "round_001",
    round_no: 1
  });
  expect(result.queue_item.confirmation_status).toBe("CONFIRMED");
  expect(result.student_safe_preview.status).toBe("CONFIRMED");
});
```

Add table-driven mismatch cases for `round_id`, `round_no`, `team_id`, `run_id`, and tenant actor. Each mismatch must yield `confirmation_status: "MISSING"` and `student_safe_preview.status: "UNAVAILABLE"`, or reject with `W019_CONTEXT_INVALID`/scope error before returning source data.

- [ ] **Step 3: Run the focused tests and record RED**

Run:

```powershell
npx vitest run tests/unit/w3-official-consequence-learning.test.ts tests/unit/teaching-closure-query.test.ts
```

Expected: the new tests fail because current W3 `latestConfirmation`/`findReport` and Teaching Closure `latestConfirmation`/preview matching omit `round_id` and `round_no`, and `getExact` does not exist.

- [ ] **Step 4: Implement exact matching without changing writer semantics**

In W3, require these six fields for confirmation and report matching:

```ts
(course_id, run_id, team_id, role_key, round_id, round_no);
```

Do not change `TeacherConfirmationCommandService`, its repository port, its append behavior, or W3 audit writes.

In Teaching Closure, keep legacy `get(actor, TeachingClosureContext)` behavior available for W019, and add:

```ts
type TeachingClosureExactRoundContext = TeachingClosureContext & {
  readonly round_id: string;
  readonly round_no: number;
};

async getExact(
  actor: { readonly actor_id: string; readonly tenant_id: string },
  context: TeachingClosureExactRoundContext
): Promise<TeachingClosureDto>;
```

`getExact` validates both round fields and filters D3 confirmations and D4 reports by all six exact fields. It may reuse one private builder shared with `get`; it must not persist, confirm, publish, or widen the returned DTO.

- [ ] **Step 5: Run focused GREEN and affected baseline**

Run:

```powershell
npx vitest run tests/unit/w3-official-consequence-learning.test.ts tests/unit/teaching-closure-query.test.ts tests/unit/teacher-confirmation-service.test.ts tests/unit/student-learning-report-projection.test.ts
```

Expected: all pass, and `git diff -- services/api/src/w3-official-consequence-learning.ts services/api/src/teaching-closure-query.ts` contains query/read-model changes only.

- [ ] **Step 6: Commit the exact-round seam**

```powershell
git add services/api/src/w3-official-consequence-learning.ts services/api/src/teaching-closure-query.ts tests/unit/w3-official-consequence-learning.test.ts tests/unit/teaching-closure-query.test.ts
git commit -m "fix: bind learning reads to exact round"
```

### Task 2: Add the derived M2P6 learning-loop contract and service projection

**Files:**

- Modify: `packages/shared-contracts/src/m2p5-decision-learning-crossround.ts`
- Modify: `services/api/src/m2p5-decision-learning-crossround.ts`
- Modify: `services/api/src/server.ts`
- Modify: `contracts/schemas/m2p5-decision-learning-crossround.v1.json`
- Modify: `contracts/fixtures/m2p5-decision-learning-crossround.valid.json`
- Modify: `contracts/fixtures/m2p5-decision-learning-crossround.invalid.json`
- Modify: `contracts/openapi/p0-api.openapi.yaml`
- Test: `tests/unit/m2p5-decision-learning-crossround.test.ts`
- Test: `tests/contract/m2p5-decision-learning-crossround-contract.test.ts`
- Test: `tests/integration/m2p5-decision-learning-crossround-route.test.ts`

**Interfaces:**

- Consumes: Task 1 `TeachingClosureQueryService.getExact`, existing M2P5 exact round check, W3 response, D4 report, Project projection, W4 closing/opening lineage.
- Produces: required `learning_loop` field on `M2P5DecisionLearningResponse` with nested schema version `m2p6-teacher-debrief-learning-transfer.v1`.

- [ ] **Step 1: Write contract and service RED tests**

Define the expected TypeScript shape in tests before production types:

```ts
expect(result.learning_loop).toMatchObject({
  schema_version: "m2p6-teacher-debrief-learning-transfer.v1",
  status: "READY",
  exact_context: context,
  teacher_debrief_availability: "AVAILABLE",
  student_learning_report_status: "CONFIRMED",
  reflection_status: "SUBMITTED",
  what_if_availability: "AVAILABLE",
  transfer_status: "READY",
  next_opening_state_readiness: "ENTRY_READY",
  recovery_state: "EXACT_CONTEXT_RESTORED"
});
```

Add explicit unit cases for:

- missing reflection → `BLOCKED` with `REFLECTION_REQUIRED`;
- absent exact Teaching Closure → `UNKNOWN` with `TEACHING_CLOSURE_UNAVAILABLE` on teacher surface;
- inexact candidate D4 report → `CONFLICT` with `STUDENT_LEARNING_REPORT_EXACT_CONTEXT_CONFLICT`;
- W4 lineage conflict → `CONFLICT` with `W4_CLOSING_OPENING_LINEAGE_CONFLICT`;
- student surface omits `teacher_confirmation_ref` and teacher-only source/provenance references;
- response JSON excludes every forbidden field from Global Constraints.

Update the valid JSON fixture with a literal `learning_loop`; add an invalid fixture variant where `recovery_state` is not `EXACT_CONTEXT_RESTORED` or an internal digest field is injected.

- [ ] **Step 2: Run focused contract/service tests and record RED**

Run:

```powershell
npx vitest run tests/unit/m2p5-decision-learning-crossround.test.ts tests/contract/m2p5-decision-learning-crossround-contract.test.ts
```

Expected: fail because the response and schema do not yet expose `learning_loop`.

- [ ] **Step 3: Add the shared projection types**

Add exact unions and interface:

```ts
export type M2P6LearningLoopStatus = "READY" | "BLOCKED" | "CONFLICT" | "UNKNOWN";
export type M2P6DebriefAvailability = "AVAILABLE" | "BLOCKED" | "UNKNOWN";
export type M2P6WhatIfAvailability = "AVAILABLE" | "NOT_GENERATED" | "BLOCKED";
export type M2P6TransferStatus = "READY" | "BLOCKED";
export type M2P6NextOpeningReadiness = "ENTRY_READY" | "READY_TO_CONTINUE" | "BLOCKED";

export interface M2P6LearningLoopProjection {
  readonly schema_version: "m2p6-teacher-debrief-learning-transfer.v1";
  readonly status: M2P6LearningLoopStatus;
  readonly exact_context: M2P5DecisionLearningContext;
  readonly canonical_decision_ref: W3OfficialConsequenceResponse["record"]["source"]["canonical_decision_ref"];
  readonly published_consequence_ref: {
    readonly record_id: string;
    readonly round_ref: W3OfficialConsequenceResponse["record"]["source"]["round_ref"];
    readonly settlement_ref: W3OfficialConsequenceResponse["record"]["source"]["settlement_ref"];
  };
  readonly teacher_confirmation_status: "MISSING" | "DRAFT" | "CONFIRMED";
  readonly teacher_confirmation_ref?: M2P5LearningProjection["teacher_confirmation_ref"];
  readonly teacher_debrief_availability: M2P6DebriefAvailability;
  readonly student_learning_report_status: "MISSING" | "CONFIRMED";
  readonly reflection_status: "MISSING" | "SUBMITTED";
  readonly what_if_availability: M2P6WhatIfAvailability;
  readonly transfer_status: M2P6TransferStatus;
  readonly next_opening_state_readiness: M2P6NextOpeningReadiness;
  readonly blockers: readonly string[];
  readonly allowed_actions: readonly string[];
  readonly recovery_state: "EXACT_CONTEXT_RESTORED";
  readonly source_receipts: readonly W3ExactRef[];
  readonly provenance_refs: readonly W3ExactRef[];
}
```

Import `W3ExactRef` as a type and add `learning_loop: M2P6LearningLoopProjection` to `M2P5DecisionLearningResponse`.

- [ ] **Step 4: Derive the projection in the existing M2P5 service**

Extend dependencies with a read-only callback:

```ts
readonly getTeachingClosure: (
  actor: M2P5DecisionLearningActor,
  context: M2P5DecisionLearningContext
) => Promise<TeachingClosureDto>;
```

Call it only for the teacher surface and catch unavailability into explicit `UNKNOWN`; do not expose the Teaching Closure DTO. Derive all statuses from existing exact source states. Student `source_receipts` and `provenance_refs` may contain only refs already present on the student-safe W3/D4 projection. Build `allowed_actions` from literal role-safe action codes; for example teacher `REVIEW_EVIDENCE`, `USE_EXISTING_D3_CONFIRMATION`, `PREPARE_DEBRIEF`, `CREATE_NON_OFFICIAL_WHAT_IF`, `REVIEW_TRANSFER`, and student `SUBMIT_AI_OFF_REFLECTION`, `REVIEW_NON_OFFICIAL_WHAT_IF`, `REVIEW_TRANSFER`, `ENTER_NEXT_ROUND` when their gates permit.

Before returning, enforce exact equality between `official.record.context` and `input.context`. Keep the existing `state_true` firewall and add literal forbidden-key checks for the Global Constraints list.

- [ ] **Step 5: Wire the existing Teaching Closure read model**

In `createRuntime`, provide:

```ts
getTeachingClosure: (actor, context) =>
  teachingClosure.getExact({ actor_id: actor.user_id, tenant_id: actor.tenant_id }, context);
```

Do not add a route or instantiate another Teaching Closure service.

- [ ] **Step 6: Update JSON Schema, fixture, and OpenAPI description**

Add required `learning_loop` to the existing M2P5 schema. Its `additionalProperties` must be `false`; exact context reuses `#/$defs/context`; refs must reuse exact digest/identity shapes; student and teacher use the same structural contract but runtime redaction controls optional teacher references. Add explicit schema properties that reject `state_true`, the listed internal digests, full manifests, and authority diagnostics. Update the two path summaries to state that the exact response includes the derived M2P6 learning loop while retaining the existing path and root M2P5 schema version.

- [ ] **Step 7: Run focused GREEN and route checks**

Run:

```powershell
npx vitest run tests/unit/m2p5-decision-learning-crossround.test.ts tests/contract/m2p5-decision-learning-crossround-contract.test.ts tests/integration/m2p5-decision-learning-crossround-route.test.ts
```

Expected: all pass; route count is unchanged; no write method appears in the service dependency interface.

- [ ] **Step 8: Commit the derived backend contract**

```powershell
git add packages/shared-contracts/src/m2p5-decision-learning-crossround.ts services/api/src/m2p5-decision-learning-crossround.ts services/api/src/server.ts contracts/schemas/m2p5-decision-learning-crossround.v1.json contracts/fixtures/m2p5-decision-learning-crossround.valid.json contracts/fixtures/m2p5-decision-learning-crossround.invalid.json contracts/openapi/p0-api.openapi.yaml tests/unit/m2p5-decision-learning-crossround.test.ts tests/contract/m2p5-decision-learning-crossround-contract.test.ts tests/integration/m2p5-decision-learning-crossround-route.test.ts
git commit -m "feat: project exact-round learning loop"
```

### Task 3: Present the governed teacher and student learning-loop states

**Files:**

- Modify: `apps/teacher/src/P2BTeacherDebriefWorkspace.tsx`
- Modify: `apps/student/src/P2BDecisionLearningJourney.tsx`
- Modify: `apps/teacher/src/p2b-teacher-debrief.css`
- Modify: `apps/student/src/p2b-decision-learning.css`
- Test: `tests/unit/p2b-teacher-debrief.test.tsx`
- Test: `tests/unit/p2b-decision-learning.test.tsx`

**Interfaces:**

- Consumes: Task 2 `M2P5DecisionLearningResponse.learning_loop` from the existing M2P5 GET.
- Produces: role-safe UI states and stable test IDs `teacher-m2p6-learning-loop`, `student-m2p6-learning-loop`, `teacher-m2p6-recovery`, and `student-m2p6-recovery`.

- [ ] **Step 1: Write teacher and student RED component tests**

For teacher, assert the server projection renders the exact context, Published Consequence → Evidence → D3 → Debrief → Transfer chain, allowed action, blockers, receipt reference, and `EXACT_CONTEXT_RESTORED`. Assert no button in the projection performs confirmation.

For student, assert Published Consequence → D4 → mechanism → Reflection → What-if → Transfer → Next Opening readiness and that serialized/rendered output omits every forbidden key. Add state cases for loading, blocked, conflict, unknown, error, stale refresh, and recovered.

- [ ] **Step 2: Run focused component tests and record RED**

Run:

```powershell
npx vitest run tests/unit/p2b-teacher-debrief.test.tsx tests/unit/p2b-decision-learning.test.tsx
```

Expected: new M2P6 test IDs and state labels are absent.

- [ ] **Step 3: Implement the minimum UI projection**

Keep the existing six Student stages and five Teacher stages. Add one compact learning-loop status region inside each existing M2P5 cross-round card. Do not add another app or client-side outcome calculation.

Change each cross-round state union to retain the previous successful response during a same-identity refetch:

```ts
type CrossRoundState =
  | { phase: "idle" | "loading" }
  | { phase: "ready" | "stale"; data: M2P5DecisionLearningResponse }
  | { phase: "error"; message: string };
```

Map server `READY`, `BLOCKED`, `CONFLICT`, and `UNKNOWN` literally. Use `loading`, `stale`, and `error` for network state. Use `EXACT_CONTEXT_RESTORED` for recovered. Reauthentication remains the existing app login gate; no token persistence, refresh token, cookie authority, or new auth endpoint is added.

- [ ] **Step 4: Run component GREEN and frontend type/build checks**

Run:

```powershell
npx vitest run tests/unit/p2b-teacher-debrief.test.tsx tests/unit/p2b-decision-learning.test.tsx tests/unit/p2b-figma-token-contract.test.ts
npm run typecheck
npm run build -w @simwar/teacher
npm run build -w @simwar/student
```

Expected: all pass; no direct store access and no frontend writer is introduced.

- [ ] **Step 5: Commit the role-safe UI**

```powershell
git add apps/teacher/src/P2BTeacherDebriefWorkspace.tsx apps/student/src/P2BDecisionLearningJourney.tsx apps/teacher/src/p2b-teacher-debrief.css apps/student/src/p2b-decision-learning.css tests/unit/p2b-teacher-debrief.test.tsx tests/unit/p2b-decision-learning.test.tsx
git commit -m "feat: expose governed learning transfer journey"
```

### Task 4: Prove real-BFF security, recovery, and exact-head acceptance

**Files:**

- Modify: `tests/integration/m2p5-decision-learning-crossround-http.test.ts`
- Modify: `tests/e2e-ui/m2-p5-decision-learning-crossround-fixture.ts`
- Modify: `tests/e2e-ui/m2-p5-decision-learning-crossround.spec.ts`
- Create: `docs/evidence/m2p6-o1-teacher-debrief-learning-transfer/M2P6_O1_EVIDENCE_INDEX.md`

**Interfaces:**

- Consumes: Tasks 1–3 exact-round service, contract, Role BFF, and UI.
- Produces: real HTTP/browser evidence with no target-route interception, plus exact-head validation index.

- [ ] **Step 1: Write real HTTP RED cases**

Add literal tests for:

- newer Round 2 D3 confirmation cannot satisfy Round 1;
- wrong team and tenant are denied;
- learner token on teacher M2P5 route is denied;
- wrong `round_id`/`round_no` pair and missing/stale round fail closed;
- settled-unpublished round returns the existing publication denial;
- duplicate identical reflection is idempotent and a conflicting reuse is rejected;
- student JSON contains no teacher feedback, claim owner, private evidence body, forbidden digest, manifest, `state_true`, or authority diagnostics;
- AI Provider remains OFF and reflection remains `ai_used: false`.

- [ ] **Step 2: Run HTTP test and record RED**

Run:

```powershell
npx vitest run tests/integration/m2p5-decision-learning-crossround-http.test.ts
```

Expected: the new `learning_loop` assertions fail before Tasks 1–3 are integrated; security cases must expose any remaining gap rather than weakening assertions.

- [ ] **Step 3: Extend the real two-round fixture without adding a writer**

Seed a newer Round 2 confirmation/report alongside Round 1, preserving Round 1 as the request target. Reuse existing JSON repository/adapters and existing D3/W3 commands or immutable seeded records; do not add a fixture-only production route or store.

- [ ] **Step 4: Extend the dedicated real browser journey**

Do not use `page.route` for either target M2P5 endpoint. Verify:

1. Student signs in and sees exact Round 1 `BLOCKED` learning loop.
2. Real W3 reflection/evidence/hypothesis commands advance the existing state.
3. Full page reload shows existing `not signed in`/login requirement before reauthentication.
4. Existing login restores the same URL exact context and `student-m2p6-recovery` reports `EXACT_CONTEXT_RESTORED`.
5. Student sees D4/Reflection/What-if/Transfer/Next Opening without private teacher data.
6. Teacher signs in on the exact same context and sees D3/Debrief/Transfer readiness plus the Round 1 confirmation, not newer Round 2.
7. Wrong round, cross-tenant, and pre-publish API probes fail closed.

- [ ] **Step 5: Run the affected validation ladder**

Run once per final semantic candidate:

```powershell
npm run check:hidden-unicode
npm run format:check
npm run lint
npm run security:audit
npm run typecheck
npm test
npm run test:contract
npm run check:direct-store-boundaries
npm run build
npm run test:e2e:ui:m2-p5
```

Also record that `npm run quality` does not exist on this exact base; do not claim it ran. Expected: all real commands pass. Browser evidence must report target-route mock count `0`, Provider `OFF`, DB `JSON_INTERNAL_ONLY`, and Human Validation `NOT_PERFORMED`.

- [ ] **Step 6: Inspect scope and create the evidence index**

Record exact base/head/tree, changed files, source/contract digests, focused and full test fingerprints, browser result, writer/store/registry counts, CodeGraph/Graphify degraded receipts, Known Limits, and rollback by reverting this Product PR. Verify:

```powershell
git diff --check
git status --short
git diff --name-only 89d3c852f538dfe421a5c150113f182a96b2c770...HEAD
rg -n "state_true|decision_batch_hash|json_runtime_source_digest|canonical_evidence_digest|refresh_token|/auth/refresh" apps/student/src/P2BDecisionLearningJourney.tsx apps/teacher/src/P2BTeacherDebriefWorkspace.tsx services/api/src/m2p5-decision-learning-crossround.ts
```

The `rg` result may contain only explicit denylist/firewall checks and human-facing boundary copy, never projected values or new auth code.

- [ ] **Step 7: Commit acceptance evidence**

```powershell
git add tests/integration/m2p5-decision-learning-crossround-http.test.ts tests/e2e-ui/m2-p5-decision-learning-crossround-fixture.ts tests/e2e-ui/m2-p5-decision-learning-crossround.spec.ts docs/evidence/m2p6-o1-teacher-debrief-learning-transfer/M2P6_O1_EVIDENCE_INDEX.md
git commit -m "test: prove exact learning loop recovery"
```

### Task 5: Independent review, Product PR, and local handoff

**Files:**

- Create/update only external evidence under `C:\Temp\SIMWAR-MAIN-M2P6-O1-PRODUCT-EXECUTION-20260826`.
- Create archive under `D:\DcodexSimWar-reference\SimWar-Codex-Handoffs\MAIN-M2P6-O1-TEACHER-DEBRIEF-AND-LEARNING-TRANSFER-<timestamp>`.
- Update canonical Mission Memory through its existing CLI/mechanism under `D:\DcodexSimWar-reference\_mission-memory`; do not create a second root.

**Interfaces:**

- Consumes: final reviewed branch and exact validation receipts.
- Produces: one pushed Product branch, exactly one Product PR, H2 result, verified handoff archive, and `PRODUCT_PR_READY_FOR_OWNER_MERGE_DECISION` or same-mission rework.

- [ ] **Step 1: Run final whole-branch code review**

Review the complete diff from base `89d3c852f538dfe421a5c150113f182a96b2c770` for spec compliance, exact-round correctness, role redaction, writer/store delta, route mocks, auth recovery, hot-file boundaries, and test quality. Fix Critical/Important findings through the bounded reviewed fix loop; do not merge.

- [ ] **Step 2: Freeze the candidate**

Record `BASE`, `HEAD`, `TREE`, changed-file manifest, source digest, contract digest, Admission Card digest, and test fingerprint. No source mutation is permitted after exact-head claims without invalidating and rerunning the relevant freeze checks.

- [ ] **Step 3: Push and open exactly one Product PR**

Push the current branch non-force and create one PR to `master`. The PR body must include `Summary`, `Validation`, and `Scope Notes`, and explicitly state State A/B, reuse proof, exact-round seam, Option A, formal writer mutation `0`, DB `JSON_INTERNAL_ONLY`, Provider `OFF`, security negatives, recovery, Known Limits, and Human Validation `NOT_PERFORMED`.

- [ ] **Step 4: Validate exact PR head and required checks**

Read back the PR head SHA and tree. Wait for required checks `quality`, `browser-smoke`, and `Analyze JavaScript and TypeScript`. If any check fails, remain in same-mission REWORK. Do not create an R2 mission unless authority/scope materially changes.

- [ ] **Step 5: Run H2 from a fresh checkout**

Use the exact PR head, fresh install/fixtures/ports/browser context. Inspect changed files, contract/writer/direct-store deltas, hot-file boundary, tenant/role/prepublish/wrong-round/recovery/real-BFF behavior, and target route mocks. Allowed outcome is `JOIN`, `JOIN_WITH_LIMITS`, `REWORK`, `HOLD`, or `REJECT`; developer self-report is not H2.

- [ ] **Step 6: Archive and verify local knowledge handoff**

Write `HANDOFF.md`, `HANDOFF.json`, `RESULT_MANIFEST.json`, `sha256sums.txt`, `FINAL-REPORT.md`, and `ARCHIVE-VERIFICATION.json`; update `LATEST_HANDOFF.json` only after hashes verify. Record Product Mission lineage in the canonical Mission Memory mechanism without claiming merge/H3 closure. Set `automatic_next_start=false`.

- [ ] **Step 7: Stop before merge**

Report `PRODUCT_PR_READY_FOR_OWNER_MERGE_DECISION` only when exact-head checks and H2 support it. Otherwise report same-mission rework or H1 re-admission. `MERGE=0`, `HUMAN_VALIDATION=NOT_PERFORMED`, and `AUTOMATIC_NEXT_START=false` are invariant.
