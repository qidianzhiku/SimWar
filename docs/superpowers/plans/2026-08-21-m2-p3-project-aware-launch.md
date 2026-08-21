# M2-P3 Project-Aware Course Launch — Implementation Plan

**Mission:** `SIMWAR-SH-M2-P3-PROJECT-AWARE-LAUNCH-V5.14-20260821`

**Worktree:** `D:\codex\SimWar-m2-p3-project-aware-launch-20260821`

**Baseline:** `origin/master` `cfd35ddd560dba2da4420f8a7586f234391423fa`

## Guardrails and ownership freeze

- Product scope is one Product PR and one ordinary merge; Governance is one docs-only PR and one ordinary merge.
- No force push, no auto-merge, no Production/Pilot/W6/AI provider/model/Human Validation.
- Only the existing Course/Run/Team/Role/ProjectLibrary/W4/Admin authority paths may write truth.
- High-risk writer ownership is serial: Sol owns shared contracts, `server.ts`/run helper and launch service; one named `luna_worker` may own a disjoint frontend or test slice only after contracts are stable.
- No worker edits `server.ts`, shared index, formal-run helper, or project launch service while Sol is editing them.
- Stage explicit files only; never use `git add -A`.
- The protected dirty workspace remains untouched.

## Phase 0 — Design and RED proof

1. Keep the design specification and this plan in the Product PR scope.
2. Add failing contract/unit/integration test files only. Import the not-yet-existing project-aware launch contracts/service and assert the acceptance matrix.
3. Run the focused tests and record the intentional RED result; ensure failures are missing implementation, not environment or baseline timeout noise.
4. Freeze the file list and worker boundaries in the mission receipt.

Expected new test files:

- `tests/unit/project-aware-course-launch.test.ts`
- `tests/contract/project-aware-course-launch-contract.test.ts`
- `tests/integration/project-aware-course-launch.test.ts`
- `tests/e2e-ui/m2-p3-project-aware-launch-fixture.ts`
- `tests/e2e-ui/m2-p3-project-aware-launch-journey.spec.ts`

## Phase 1 — P0 shared contract and launch authority

1. Add `packages/shared-contracts/src/project-aware-launch.ts` with exact-reference types, readiness/blocker/receipt schemas and forbidden-field-safe projections.
2. Export the module from `packages/shared-contracts/src/index.ts`.
3. Add a pure readiness evaluator and a `ProjectAwareCourseLaunchService` under `services/api/src/`.
4. Add narrowly scoped read methods to `ProjectLibraryService` if required; do not expose raw stores to routes or UI.
5. Extract the existing course-run creation logic into a shared application helper used by the current route and the new project-aware launch command. The helper must preserve existing synthetic/formal behavior and call `createFormalBoundRun` for formal runs.
6. Add a durable idempotency/receipt boundary through the existing repository/audit abstraction, without introducing a second Run, registry, or EnterpriseState authority.
7. Gate launch on aggregate `READY`; call existing W4 initialization once for each team; record per-team receipts and audit lineage.
8. Extend server route wiring for teacher readiness/launch, student safe context, and admin audit projection. Preserve existing auth, tenant and capability checks.

P0 validation:

- focused unit/contract/integration tests;
- existing project-library and course-run tests;
- direct-store boundary checks;
- typecheck and build.

## Phase 2 — P1 product surfaces

1. Extend `apps/teacher/src/ProjectLibraryPanel.tsx` or add a focused child component under the same feature boundary for the assignment matrix, readiness, blockers, launch and receipt readback.
2. Extend `apps/student/src/ProjectBriefPanel.tsx` or a focused child component to show only the current student’s exact project, role and run context.
3. Extend the existing Admin project-library/audit component or add a feature-local child for launch lineage.
4. Reuse existing CSS tokens and the Figma design receipt; do not modify shared UI packages or create a new design system.

P1 validation:

- frontend typecheck/build;
- relevant component tests;
- browser smoke only after the real-BFF fixture is ready.

## Phase 3 — P2 evidence and browser journey

1. Add schema/contract assertions for exact refs and forbidden fields.
2. Add negative-first tests for all readiness and scope gates.
3. Add matched-arena isolation and duplicate-command/concurrency tests using the existing memory store and controlled idempotency key.
4. Build an isolated real-BFF fixture with mocks disabled, a MarketWorld course, at least two teams, one initially blocked team, exact shared ProjectProfileRef, role assignments, and deterministic test ports/store.
5. Run the dedicated Playwright journey with mocks=0 and retain exact command/readback evidence.
6. Run the existing M2-P2 journey and all related regression tests.

## Phase 4 — Product PR and merge

1. Run pre-commit checks: status, diff/stat, changed-file allowlist, hidden Unicode, format, lint, typecheck, contract tests, unit/integration, build, relevant E2E.
2. Do not include the baseline `direct-store-boundary-check` timeout as a new failure; prove no new direct-store violations.
3. Commit one Product PR with Summary, Validation and Scope Notes, then push once non-force to the dedicated source branch.
4. Open the Product PR, wait for required checks/reviews, and merge ordinarily only if the prompt's exact conditions are satisfied. If any status mismatches, stop.
5. Read back the merged master SHA and PR state; do not call this M2-P3 complete yet.

## Phase 5 — Fresh detached validation and Governance Closure

1. Create a fresh detached validation worktree at the merged master SHA.
2. Run focused and relevant full local gates plus the dedicated real-BFF browser journey.
3. Create one docs-only Governance Closure with current SHA, exact Product PR/commit, evidence paths, known limits, no Human Validation claim, and issue #418 disposition.
4. Merge the Governance PR ordinarily only if checks/status are exact; then read back master, Product PR, Governance PR, checks and locks.
5. Release only mission-created locks/evidence leases. Do not close unrelated issue #418 unless the prompt criteria are actually met.
6. Final status is `COMPLETED` only if master SHA differs from mission start and all required readbacks pass; otherwise report the precise hard stop.

## Final output requirements

The final report must use the prompt's exact result structure and include:

- mission/target/status;
- start and final master/tree SHAs;
- Product PR and Governance PR links/statuses;
- exact changed-file list and commit SHAs;
- command/evidence receipts;
- current known limits, including the baseline timeout if still present;
- explicit statement that no Human Validation, Pilot, Production or provider/model activation was performed.
