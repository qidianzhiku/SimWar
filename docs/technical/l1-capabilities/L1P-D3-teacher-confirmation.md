# L1P-D3 Teacher Confirmation

Status: CLOSED_AND_CURRENT_WITH_LIMITS

## Primary Outcome

A Teacher can select exact CoursePackageVersion, LearningGoalVersion and
RubricVersion references within a controlled Course/Run/Team/Role scope, claim
an exclusive confirmation work item, submit an explicit confirmation, and
inspect an immutable teacher-safe receipt with audit and revision context.

## Authority

`TeacherConfirmationCommandService` is the sole D3 writer. The JSON repository
remains the active runtime provider. D3 does not write Truth, SettlementResult,
Score, Rank, canonical Decision, Replay authority, Student state, or final
grade. D3 confirmation is separate learning evidence and is not a settlement
input.

## Product Surface

The Teacher Confirmation Workbench displays exact course, run, learning goal,
rubric, team and role references; work-claim state; draft, forbidden, stale,
conflict and submitted states; and a safe immutable receipt. It does not read a
store directly, expose arbitrary private payloads, create a Student route, or
provide a final-grade control.

## Contract and Implementation

- Contract: `contracts/schemas/teacher-confirmation.v1.json`
- Fixtures: `contracts/fixtures/teacher-confirmation.valid.json` and
  `contracts/fixtures/teacher-confirmation.invalid.json`
- OpenAPI: `contracts/openapi/p0-api.openapi.yaml`
- Shared types: `packages/shared-contracts/src/teacher-confirmation.ts`
- Command service: `services/api/src/teacher-confirmation.ts`
- Work claim service: `services/api/src/teacher-confirmation-work-claim.ts`
- Query and registry: `services/api/src/teacher-confirmation-query.ts` and
  `services/api/src/teacher-confirmation-registry.ts`
- Teacher route: `services/api/src/routes/teacher-confirmation-routes.ts`
- Product PR #325 merge: `3f9145f27700b484e0f6d5f90d5eb926448276da`
- Reviewed product head: `802a42fd9ae0b2d9ec6e5e97fcab5bf206bdc560`
- Candidate manifest SHA-256:
  `b4ace8b704cdf2b164e4333d7eac432d47742d169e8538f33b4a7d16117c5cfa`

## Evidence

- Focused D3 validation: 5 files / 19 tests PASS.
- Contract validation: 10 files / 26 tests PASS.
- Default post-merge full suite: 145 files / 988 tests PASS.
- D3 browser journey: 2 tests PASS.
- Direct-store boundary: zero new, stale, duplicate or broad findings.
- Typecheck, lint, build and hidden-Unicode checks PASS.
- Fresh clone: `D:/codex/simwar-w007-d3-postmerge-3f9145f2`.
- Post-merge receipt:
  `C:/Users/Marshall/AppData/Local/Temp/E-SIMWAR-W007-D3-20260803T163749Z/closure/post-merge-receipt-3f9145f.json`.

## Known Limits and Non-Proofs

The runtime remains `JSON_INTERNAL_ONLY`. Human Validation was not performed.
Issue #111 remains an open known limit. Durable settlement, backup, restore,
recovery, Pilot and Production are not proven or authorized. Rollback evidence
is bounded to in-memory transactional rollback and does not prove crash-safe
cross-process recovery. Browser evidence is a baseline journey check and not
a full accessibility audit. D3 does not authorize D4, AI, PostgreSQL, Pilot,
Production or automatic successor work.
