# M2-P2 Project Library / Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable, tenant-scoped Project Library and exact ProjectAssignment flow on top of the existing Shanghai MarketWorldRef/Course/Run/Team path, while keeping W4 EnterpriseState as the only live opening-state writer.

**Architecture:** Add one append-only ProjectProfile/ProjectAssignment domain service backed by the existing `SimWarStore`, with closed-object validation, exact references, digest identity, lifecycle/readiness projection, and role-safe BFF projections. Teacher commands and Admin audit call that service; Student reads only the service's team-scoped brief. Assignment orchestration may invoke the existing W4 `createInitialState` service for a missing team opening state, but ProjectProfile never writes W4 state directly.

**Tech Stack:** TypeScript, npm workspaces, Node HTTP API, existing JSON adapter/memory store, shared-contract types, JSON Schema/AJV conventions, Vitest, React/Vite, Playwright real-BFF fixture.

**Spec:** `SimWar_M2P2_Autonomous_Codex_Execution_Prompt_V5.11_20260821.docx` and `SimWar_M2P2_Project_Library_Playable_Company_Assignment_Macro_Development_Plan_V1.0_20260821.docx`.

## Global Constraints

- `MarketWorldRef != ProjectProfile != ProjectAssignment != EnterpriseState != StrategicInitiative`.
- Existing Course/Run/Team/Role Seat orchestration and existing W4 EnterpriseState authority remain the only live-state path.
- No `ProjectProfileStore2`, `CourseWriter2`, `EnterpriseStateWriter2`, second settlement/truth authority, or Shanghai-only application shell.
- ProjectProfile versions are immutable; historical refs remain resolvable; no destructive rewrite or delete.
- Import accepts only normalized product-safe closed objects; reject unknown fields, aliases, PII, secrets, raw paths, executable content, invalid values, and implicit refs.
- Student projection excludes other-team data, raw source paths, private coefficients, hidden metadata, truth state, score, rank, and SettlementResult.
- No new dependency unless a current-repo gap is demonstrated; reuse current JSON/TypeScript/AJV/Vitest patterns.
- No PG/RLS activation, provider/model activation, Pilot, Production, Human Validation, W6, or automatic successor.

---

### Task 1: Freeze the current-reuse and contract boundaries

**Files:**

- Create: `docs/product/m2-p2-project-library-current-reuse-gap-map.md`
- Create: `docs/evidence/m2-p2-contract-receipt.md`
- Create: `docs/evidence/m2-p2-authority-design-reuse-receipt.md`

- [x] Record the exact start master/tree, the existing M2-P1 MarketWorld binding module, Course/Run/Team repository facade, W4 `createInitialState`, existing role-safe BFFs, existing UI components/tokens, and the explicit non-collision rules.
- [x] Record the file-ownership map: P0 shared contracts/domain/store/server; P1 role surfaces; P2 tests/fixture/evidence; no overlap with existing dirty worktrees.
- [x] Record CodeGraph/Graphify/Figma availability limits and the chosen fallback evidence before UI implementation.

### Task 2: Write RED domain tests

**Files:**

- Create: `tests/unit/project-library-service.test.ts`

- [x] Add tests for exact identity/digest and alias rejection.
- [x] Add tests for template creation, unique clone, closed-object safe import, duplicate idempotency, and conflicting assignment rejection.
- [x] Add tests for tenant/course/run/team scope, stale/retired/unknown references, matched-arena multi-team assignments, immutable history, successor resolution, and no direct W4 write.
- [x] Run only this focused test file and verify the failures are caused by the missing ProjectProfile/ProjectAssignment service.

### Task 3: Implement the P0 domain and shared contracts

**Files:**

- Create: `packages/shared-contracts/src/project-library.ts`
- Create: `services/api/src/project-library-service.ts`
- Modify: `packages/shared-contracts/src/index.ts`
- Modify: `services/api/src/store.ts`
- Modify: `tests/unit/project-library-service.test.ts`

- [x] Define `ProjectProfileRef`, immutable `ProjectProfile`, `ProjectAssignment`, readiness/status unions, role-safe brief/admin/teacher projections, and closed import/draft inputs.
- [x] Implement canonical SHA-256 digesting and exact-reference helpers; reject `latest/current/default/fallback/next` aliases.
- [x] Implement append-only lifecycle snapshots and store-backed commands for create, clone, import, validate, assign, successor, and safe future-retire.
- [x] Implement duplicate assignment idempotency and conflict fail-closed semantics.
- [x] Run the focused tests until GREEN, then refactor only while keeping them GREEN.

### Task 4: Integrate API routes with the existing authorities

**Files:**

- Modify: `services/api/src/server.ts`
- Create: `contracts/schemas/project-profile.v1.json`
- Create: `contracts/schemas/project-assignment.v1.json`
- Create: `contracts/fixtures/project-profile.valid.json`
- Create: `contracts/fixtures/project-profile.invalid.json`
- Create: `tests/integration/project-library-endpoint.test.ts`

- [x] Add Teacher library/list/create/clone/import/validate/successor/future-retire and Course/Run/Team assignment routes.
- [x] Add Student role-workspace `project_brief` and Admin tenant-scoped project audit projection.
- [x] After a valid assignment, resolve the exact existing Run/Team/Round and call the existing W4 service to create a missing opening state with profile-derived safe initial values; never add a ProjectProfile writer to W4 or settlement.
- [x] Add integration tests for role authorization, exact Shanghai binding, scope negatives, student privacy, admin audit, assignment idempotency/conflict, and W4 writer boundary.

### Task 5: Add role-safe Product Experience surfaces

**Files:**

- Create: `apps/teacher/src/ProjectLibraryPanel.tsx`
- Create: `apps/student/src/ProjectBriefPanel.tsx`
- Create: `apps/admin/src/ProjectLibraryAuditPanel.tsx`
- Modify: `apps/teacher/src/App.tsx`
- Modify: `apps/student/src/App.tsx`
- Modify: `apps/admin/src/App.tsx`
- Modify: `apps/teacher/src/styles.css`
- Modify: `apps/student/src/styles.css`
- Modify: `apps/admin/src/styles.css`

- [x] Reuse existing WorkbenchFrame/StatePanel/AuthorityBadge/panel tokens and existing role navigation.
- [x] Expose loading, empty, ready, draft, validation error, permission, stale, conflict, retired, successor, dependency-missing, error, and retry states.
- [x] Teacher can create/select/validate/assign the exact ref; Student sees only its assigned brief; Admin sees tenant-scoped audit.
- [x] Keep generic labels and generic core behavior; Shanghai is fixture/content, not a second shell.

### Task 6: Add real M2-P2 browser fixture and validation evidence

**Files:**

- Create: `tests/e2e-ui/m2-p2-project-library-assignment-journey.spec.ts`
- Create: `tests/e2e-ui/m2-p2-project-library-fixture.ts`
- Create: `scripts/run-m2-p2-browser.mjs`
- Modify: `package.json`
- Modify: `playwright.config.ts`
- Modify: `.github/workflows/ci.yml`

- [x] Implement a dedicated no-mocks real-BFF flow: Teacher exact MarketWorldRef, create/validate, assign, Student safe isolation, Admin audit, and W4 opening state.
- [x] Keep the generic browser lane independent and skip M2-P2 only when the dedicated fixture flag is absent.
- [x] Add focused unit/integration/browser commands and run the local dedicated lane before Product PR.

### Task 7: Candidate gates, Product PR, merge, and fresh detached validation

**Files:**

- No additional implementation files; use external evidence root for receipts.

- [ ] Run schema/contract, focused lifecycle/property/security, M2-P1, W4 boundary, direct-store, hidden-Unicode, typecheck, lint, build, generic browser, and dedicated M2-P2 browser.
- [ ] Review the diff and request code review before merge; fix Critical/Important findings.
- [ ] Create exactly one Product PR with Summary, Validation, Scope Notes; reauthenticate exact head and required checks, then ordinary-merge only at the expected head.
- [ ] Create one fresh detached checkout at the Product merge SHA and run the bounded post-merge lane, preserving inherited-failure fingerprints as limits.

### Task 8: Docs-only Governance Closure and final readback

**Files:**

- Create: `docs/governance/m2-p2-project-library-assignment-governance-closure-20260821.md`

- [ ] Record Product PR/head/merge/tree, exact MarketWorldRef, ProjectProfile/Assignment/W4 authority, history and matched-arena proofs, KG/Figma/OSS/competitor receipts, remote browser, detached validation, known limits, and HVB boundary.
- [ ] Create exactly one docs-only Governance PR from the exact Product merge head, run required checks/reviews, and ordinary-merge at the expected head.
- [ ] Fresh-read final master and merged PRs, confirm no force/admin/auto merge, release temporary locks, and report every final-format field from the prompt without claiming Human Validation/Pilot/Production/W6.
