# MAIN-SH-FV-O1 Governed Shanghai Full Vertical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compose the existing W5 governed-model and R7 Shanghai authorities into one exact, reproducible Teacher/Student/Admin vertical product journey.

**Architecture:** Add one read-only composition service and three role-specific BFF projections over the existing W5 service and repository facade. Extend the existing app surfaces with small role panels; retain existing W5 mutations and all formal truth authorities.

**Tech Stack:** TypeScript, Node HTTP server, npm workspaces, Vitest, React/Vite, Playwright, JSON Schema, OpenAPI.

**Spec:** `docs/superpowers/specs/2026-08-28-main-sh-fv-o1-design.md`

## Global Constraints

- `formal_writer_mutations: 0`.
- `settlement_logic_change: false`.
- `settlement_result_shape_change: false`.
- `replay_hash_change: false`.
- `canonical_decision_selection_change: false`.
- `provider: OFF`.
- `postgresql_runtime: NOT_ACTIVATED`.
- Product PR count is one and the Product PR remains unmerged.
- The primary dirty worktree is untouched; all code changes occur in the dedicated clean worktree.
- Shanghai data remains synthetic/bounded and is not presented as calibrated production truth.

---

### Task 1: Freeze the exact source map and contract shape

**Files:**
- Create: `docs/superpowers/specs/2026-08-28-main-sh-fv-o1-design.md`
- Create: `docs/superpowers/plans/2026-08-28-main-sh-fv-o1-governed-shanghai-full-vertical.md`
- Create: external evidence receipts after implementation; no primary-worktree files are modified.

**Interfaces:**
- Consumes: exact `origin/master` SHA/tree, existing W5 service, repository facade, R7 Shanghai assets, and Owner authorization.
- Produces: frozen O1 source map, file-scope ledger, and admission card used by later tasks.

- [x] Verify `origin/master`, tree, branch/worktree cleanliness, PR state, and authority constraints.
- [x] Attempt CodeGraph, Graphify, and Local Reference Vault; record unavailable/stale results truthfully.
- [x] Confirm existing W5 mutations, Simulation Core ownership, JSON runtime, and R7 synthetic-only boundaries by exact source readback.

### Task 2: Define shared Shanghai full-vertical DTOs

**Files:**
- Create: `packages/shared-contracts/src/shanghai-full-vertical.ts`
- Modify: `packages/shared-contracts/src/index.ts`
- Create: `contracts/schemas/shanghai-full-vertical.v1.json`
- Create: `contracts/fixtures/shanghai-full-vertical.valid.json`
- Test: `tests/contract/shanghai-full-vertical-contract.test.ts`

**Interfaces:**
- Produces `ShanghaiFullVerticalTeacherProjection`, `ShanghaiFullVerticalStudentProjection`, `ShanghaiFullVerticalAdminProjection`, `ShanghaiFullVerticalBinding`, and `ShanghaiFullVerticalStatus`.
- Teacher projection contains W5 catalog, exact binding when selected, and optional W5 preview.
- Student projection contains a `ROLE_SAFE_STUDENT` W5 projection and only non-sensitive exact context.
- Admin projection contains tenant-scoped exact provenance and W5 admin audit projection.

- [ ] **Step 1: Write the failing contract test.** Assert schema version, mission id, required exact identifiers, role-specific visibility, and forbidden Student fields.
- [ ] **Step 2: Run the contract test to verify RED.** Run `npx vitest run tests/contract/shanghai-full-vertical-contract.test.ts`; expected failure because the DTO/schema/fixture do not exist.
- [ ] **Step 3: Add the shared DTOs, schema, fixture, and barrel exports.** Keep the Student shape free of `parameter_values`, `content_digest`, and private scenario data.
- [ ] **Step 4: Run the focused contract test to verify GREEN.** Run the same Vitest command and require zero failures.

### Task 3: Implement the exact-binding composition service

**Files:**
- Create: `services/api/src/shanghai-full-vertical-service.ts`
- Test: `tests/unit/shanghai-full-vertical-service.test.ts`

**Interfaces:**
- Consumes: `W5GovernedModelService`, exact `Run`/`Round` context, and existing repository reads.
- Produces: `getTeacher`, `getStudent`, and `getAdmin` methods with fail-closed exact binding verification.

- [ ] **Step 1: Write unit RED tests.** Cover unbound teacher catalog, exact bound preview, Student redaction, same candidate digest across teams, and mismatch rejection.
- [ ] **Step 2: Run unit RED.** Run `npx vitest run tests/unit/shanghai-full-vertical-service.test.ts`; expected failure because the service does not exist.
- [ ] **Step 3: Implement the smallest composition service.** Reuse W5 `getTeacherProjection`, `projectStudent`, `getAdminProjection`, and `getDraft`; do not duplicate demand, settlement, writer, or persistence logic.
- [ ] **Step 4: Run unit GREEN.** Re-run the focused test and then the existing W5 service unit test.

### Task 4: Expose role-specific real BFF routes

**Files:**
- Create: `services/api/src/routes/shanghai-full-vertical-routes.ts`
- Modify: `services/api/src/server.ts`
- Modify: `contracts/openapi/p0-api.openapi.yaml`
- Test: `tests/integration/shanghai-full-vertical-endpoint.test.ts`

**Interfaces:**
- Routes: the three GET paths specified by the design.
- Reads: `RepositoryFacade` course/run/round/team/scenario/parameter records and `ShanghaiFullVerticalService`.
- Returns: standard `ApiEnvelope` with status 200; invalid exact context fails closed with the repository's existing HTTP error envelope.

- [ ] **Step 1: Write integration RED tests.** Start the real API server, create an exact run and W5 draft lifecycle, then call Teacher/Student/Admin routes; assert route registration and negative tenant/team behavior.
- [ ] **Step 2: Run integration RED.** Run `npx vitest run tests/integration/shanghai-full-vertical-endpoint.test.ts`; expected 404 or missing service failure.
- [ ] **Step 3: Add route parser, role guards, exact context resolution, and server registration.** No route writes; existing W5 endpoints remain the only mutation path.
- [ ] **Step 4: Add OpenAPI paths and run integration GREEN.** Run the focused integration test and the contract checker.

### Task 5: Add visible role panels to the three existing applications

**Files:**
- Create: `apps/teacher/src/ShanghaiFullVerticalPanel.tsx`
- Create: `apps/student/src/ShanghaiFullVerticalPanel.tsx`
- Create: `apps/admin/src/ShanghaiFullVerticalPanel.tsx`
- Modify: `apps/teacher/src/App.tsx`
- Modify: `apps/student/src/App.tsx`
- Modify: `apps/admin/src/App.tsx`
- Test: `tests/unit/shanghai-full-vertical-panels.test.tsx`

**Interfaces:**
- Each panel receives existing `apiBase`, `tenantId`, `token`, and exact course/run/round context.
- Teacher panel accepts an explicit `draftId`, never infers a latest draft, and links its status to the existing W5 Studio.
- Student panel accepts the explicit selected draft from current W5 state and displays only role-safe fields.
- Admin panel accepts the existing admin query context and displays tenant-safe authority/provenance.

- [ ] **Step 1: Write UI RED tests.** Assert each role panel renders its own heading, exact context state, and Student does not render private binding fields.
- [ ] **Step 2: Run UI RED.** Run `npx vitest run tests/unit/shanghai-full-vertical-panels.test.tsx`; expected failure because components do not exist.
- [ ] **Step 3: Implement panels and mount them next to existing W5 surfaces.** Keep data fetching read-only and preserve existing loading/error conventions.
- [ ] **Step 4: Run UI GREEN and all three app builds.** Run the focused test, `npm run build -w @simwar/teacher`, `npm run build -w @simwar/student`, and `npm run build -w @simwar/admin`.

### Task 6: Add end-to-end and exact-head verification

**Files:**
- Create: `tests/e2e-ui/shanghai-full-vertical.spec.ts`
- Create: external O1 evidence receipts and final report; no unrelated repository files.

**Interfaces:**
- Consumes: the real API and three Vite app servers with route mocks disabled.
- Produces: browser evidence for Teacher preview, Student role-safe projection, and Admin audit projection.

- [ ] **Step 1: Write the browser journey test and run it against the current exact head.** Require real BFF requests, no route mocks, exact context labels, and no full accessibility claim.
- [ ] **Step 2: Run focused browser verification.** Use the repository's existing browser harness command discovered from `package.json`; record exact command/result/limits.
- [ ] **Step 3: Run final validation once at the Product PR candidate head.** Run relevant typecheck/build/contract/unit/integration/browser/security checks; inspect full diff and mutation counts.
- [ ] **Step 4: Create one conventional commit, perform one non-force push, and create one unmerged Product PR.** Stop immediately after PR readback reaches `PRODUCT_PR_READY_FOR_OWNER_MERGE_DECISION`.

## Self-review checklist

- No placeholder text or unowned file scope remains.
- All new production functions have tests and each test was observed RED before implementation.
- Student DTO and UI do not expose `parameter_values`, content digests, private scenario assumptions, or other-team records.
- No mutation method is added to the composition route.
- The final PR is not merged; post-merge validation, governance closure, Human Validation, Pilot, Production, and automatic successor remain unperformed.

