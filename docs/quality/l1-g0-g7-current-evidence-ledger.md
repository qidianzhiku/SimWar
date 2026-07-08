# L1 G0-G7 Current Evidence Ledger

## Status Boundary

```text
G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

PostgreSQL runtime:
NOT_AUTHORIZED
```

本文是 `SIMWAR_G0_SOLO_MAINTAINER_CONSOLIDATION_PR197_R3_CLOSEOUT_TO_L1_G0_G7_R8_G1_PROGRAM_011` 的 current evidence ledger。它只记录 synthetic JSON runtime、integration、browser smoke、source-only 和 documentation evidence。它不代表 `Pilot`、`Production`、PostgreSQL runtime、SQL、migration、durable settlement、R4 Macro、R9 或 R10 ready。

## Evidence Package Boundary

```text
INTERNAL_ONLY_DRAFT_NOT_RELEASED
```

Program 012 在 PR #198 合并后追加 synthetic internal application decision evidence。该追加仍是内部草案证据，不是 `G0 PASS`、`L1 READY`、`Pilot`、`Production` 或 PostgreSQL runtime 授权。

## Evidence Label Rules

| Label                         | Meaning                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `CURRENT_GITHUB_READBACK`     | GitHub current readback, including branch protection, PR, checks, issue state |
| `CURRENT_REMOTE_GIT_READBACK` | remote Git ref readback                                                       |
| `CURRENT_LOCAL_RUN`           | local command result from isolated clone                                      |
| `INTEGRATION_TEST_EVIDENCE`   | Vitest integration response / repository-state assertion                      |
| `E2E_BROWSER`                 | Playwright browser smoke evidence                                             |
| `SOURCE_ONLY_INFERENCE`       | source inspection only, not runtime proof                                     |
| `NOT_IMPLEMENTED`             | surface not present in current runtime                                        |
| `UNKNOWN`                     | evidence not sufficient                                                       |

## G0-G7 Ledger

| Gate | Capability                                                     | Current evidence                                                                                                     | Evidence label                            | Current status                          |
| ---- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------- |
| G0   | solo-maintainer control, PR checks, force-push/deletion denial | PR #197 current readback, branch protection readback, no ruleset conflict observed                                   | `CURRENT_GITHUB_READBACK`                 | `EXCEPTION / CONTROL_POLICY_VERIFIABLE` |
| G1   | identity and runtime configuration boundary                    | `r3-runtime-boundary.test.ts`; seeded demo login rejected in shared runtime config                                   | `INTEGRATION_TEST_EVIDENCE`               | `PARTIAL_PASS_SYNTHETIC`                |
| G2   | RBAC, tenant, team, platform authority                         | R3 and L1 readiness integration tests                                                                                | `INTEGRATION_TEST_EVIDENCE`               | `PARTIAL_PASS_SYNTHETIC`                |
| G3   | projection and reachable surfaces                              | Student result, structured error, free-text error, Teacher result, Tenant Admin status, browser smoke                | `INTEGRATION_TEST_EVIDENCE / E2E_BROWSER` | `PARTIAL_PASS_SYNTHETIC`                |
| G4   | Shared Golden M1 main flow                                     | `l1-shared-golden-m1-scenario.test.ts`                                                                               | `INTEGRATION_TEST_EVIDENCE`               | `PARTIAL_PASS_SYNTHETIC`                |
| G5   | replay evidence and official-result non-overwrite              | Shared Golden M1 and R3 replay evidence assertions                                                                   | `INTEGRATION_TEST_EVIDENCE`               | `PARTIAL_PASS_SYNTHETIC`                |
| G6   | abort, reset, recovery, cleanup                                | `l1-session-abort-reset-recovery.test.ts`; synthetic exercise fresh-store boundary; in-memory reset only             | `INTEGRATION_TEST_EVIDENCE`               | `INTERNAL_SYNTHETIC_ONLY`               |
| G7   | internal operator pack                                         | Teacher Kit, runbook, reset/abort procedure, replay checklist, issue escalation, synthetic application evidence note | `CURRENT_LOCAL_READ_ONLY`                 | `DRAFT_INTERNAL_ONLY`                   |

## Program 012 Evidence Addendum

| Evidence                                   | Current result                                                                                                                                                                                                                                     | Evidence label                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| PR #198 merge closure                      | ordinary merge completed; current master contains `ee1abb51ba9edf52faf1d0b0a00e3d080a96747c`                                                                                                                                                       | `CURRENT_GITHUB_READBACK / CURRENT_REMOTE_GIT_READBACK` |
| Post-merge baseline                        | targeted integrations, contract validation, typecheck, full test, build, lint and e2e gate passed in fresh detached clone                                                                                                                          | `CURRENT_LOCAL_RUN`                                     |
| L1 synthetic application integration guard | `tests/integration/l1-synthetic-internal-application-exercise.test.ts` covers Teacher, Student, Tenant Admin, Platform Admin, two teams, run, round, decision submit, lock, settle, publish, replay evidence, non-overwrite and controlled failure | `INTEGRATION_TEST_EVIDENCE`                             |
| L1 synthetic browser guard                 | `tests/e2e-ui/l1-synthetic-internal-application-exercise.spec.ts` checks Student redaction, Teacher replay evidence and Tenant Admin current-tenant scope                                                                                          | `E2E_BROWSER`                                           |
| G7 package consistency                     | all internal operator and governance documents carry `INTERNAL_ONLY_DRAFT_NOT_RELEASED`                                                                                                                                                            | `CURRENT_LOCAL_READ_ONLY`                               |

## Program 019 Course Delivery Addendum

| Evidence                               | Current result                                                                                                                                                                                                                                                                                                                                    | Evidence label                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| PR #203 quality baseline formalization | ordinary merge completed; post-merge detached clone baseline validation restored `format:check`, `lint`, `typecheck`, `npm test`, `build`, `test:e2e:ui`, `test:contract`, hidden Unicode, security audit and direct-store boundary gates                                                                                                         | `POSTMERGE_MASTER_EVIDENCE / CURRENT_LOCAL_RUN`     |
| R5/R6/R7-C Course Delivery guard       | `tests/integration/r5-r6-course-delivery-learning-evidence.test.ts` verifies Scenario Asset binding, course publish gate, two-team decision flow, lock / settlement / publish, Student redacted feedback, Teacher replay evidence, Tenant Admin scope, Platform Admin authority, shadow arena non-overwrite and Learning Evidence truth isolation | `INTEGRATION_TEST_EVIDENCE / SHADOW_ARENA_EVIDENCE` |
| Course Delivery fixture                | `contracts/fixtures/r5-r6-course-delivery-learning-evidence.valid.json` records synthetic-only Course Blueprint and Learning Evidence Ledger constraints                                                                                                                                                                                          | `CONTRACT_BACKED_EVIDENCE`                          |
| Course Delivery documentation          | `docs/quality/r5-r6-course-delivery-learning-evidence.md` records purpose, non-goals, known limits and validation commands                                                                                                                                                                                                                        | `CURRENT_LOCAL_READ_ONLY`                           |

## Program 020 Course Delivery Productization Addendum

| Evidence                                 | Current result                                                                                                                                                                                                                                                                                          | Evidence label                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| PR #204 source integrity formalization   | PR #204 was ordinary-merged to master; post-merge detached baseline validation passed format, hidden Unicode, lint, typecheck, full test, build, E2E UI, contract, security audit and direct-store boundary gates                                                                                       | `CURRENT_GITHUB_READBACK / POSTMERGE_MASTER_EVIDENCE`               |
| Course Delivery Productization helper    | `services/api/src/course-delivery-productization.ts` records Course Blueprint V1, approved scenario/parameter/plugin/seed binding, run-binding evidence, three-part feedback, Learning Evidence Ledger and state transition evidence without formal truth writes                                        | `CONTRACT_BACKED_EVIDENCE / SOURCE_ONLY_INFERENCE`                  |
| Course / Round idempotency strengthening | `services/api/src/server.ts` returns already-published courses, already-locked rounds and already-published rounds without duplicate audit side effects                                                                                                                                                 | `STATE_MACHINE_EVIDENCE / IDEMPOTENCY_EVIDENCE / AUDIT_EVIDENCE`    |
| Course Delivery Productization guard     | `tests/integration/course-delivery-productization.test.ts` verifies approved asset binding, non-approved ParameterSet rejection, course publish idempotency, two-team decision flow, round lock/publish idempotency, repeated settlement reuse, redacted feedback and Learning Evidence truth isolation | `INTEGRATION_TEST_EVIDENCE / REPLAY_GOLDEN / SHADOW_ARENA_EVIDENCE` |
| Productization documentation             | `docs/quality/course-delivery-productization-v1.md` records the Course Blueprint contract, API / permission / idempotency / audit matrix, state transition guard, known limits and validation commands                                                                                                  | `CURRENT_LOCAL_READ_ONLY`                                           |

## Program 021 Course Delivery Runtime V2 Addendum

| Evidence                                     | Current result                                                                                                                                                                                                                                                                                      | Evidence label                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| PR #205 course delivery productization merge | PR #205 was ordinary-merged to master; post-merge detached baseline validation passed format, hidden Unicode, lint, typecheck, full test, build, E2E UI, contract, security audit and direct-store boundary gates                                                                                   | `CURRENT_GITHUB_READBACK / POSTMERGE_MASTER_EVIDENCE`               |
| Course Delivery Runtime V2 evidence helper   | `services/api/src/course-delivery-runtime-v2.ts` converges Course, Run, Round, two-team decisions, Replay evidence, Shadow Arena non-overwrite, role projections, Tenant Admin scope and Learning Evidence truth isolation without store mutation                                                   | `CONTRACT_BACKED_EVIDENCE / SOURCE_ONLY_INFERENCE`                  |
| Runtime V2 integration guard                 | `tests/integration/course-delivery-runtime-v2.test.ts` verifies the synthetic course execution chain from course publish through decision submit, lock, repeated settlement, publish, Student redaction, Teacher replay, Tenant Admin scope, Platform authority, Shadow Arena and Learning Evidence | `INTEGRATION_TEST_EVIDENCE / REPLAY_GOLDEN / SHADOW_ARENA_EVIDENCE` |
| Runtime V2 browser smoke                     | `tests/e2e-ui/course-delivery-runtime-v2-smoke.spec.ts` renders Teacher, Student and Tenant Admin evidence surfaces and checks Student-visible content for protected marker absence                                                                                                                 | `E2E_BROWSER`                                                       |
| Runtime V2 documentation                     | `docs/quality/course-delivery-runtime-v2.md` and `docs/operations/r8-g1-course-delivery-runtime-v2-internal-draft.md` record status boundaries, non-goals, internal handling and independent-review expectations                                                                                    | `CURRENT_LOCAL_READ_ONLY`                                           |

## Program 022 Course Runtime V3 Addendum

| Evidence                                 | Current result                                                                                                                                                                                                                                                                                                                                              | Evidence label                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| PR #206 Course Delivery Runtime V2 merge | PR #206 was ordinary-merged to master; post-merge detached baseline validation passed format, hidden Unicode, lint, typecheck, full test, build, E2E UI, contract, security audit and direct-store boundary gates                                                                                                                                           | `CURRENT_GITHUB_READBACK / POSTMERGE_MASTER_EVIDENCE`               |
| Course Runtime V3 evidence helper        | `services/api/src/course-runtime-v3.ts` records Course Blueprint provenance, request-id idempotency evidence, audit integrity, Student negative visibility, Replay and Shadow Arena non-overwrite, Tenant Admin scope and Learning Evidence truth isolation without store mutation                                                                          | `CONTRACT_BACKED_EVIDENCE / SOURCE_ONLY_INFERENCE`                  |
| Decision submit idempotency guard        | `services/api/src/server.ts` returns an existing decision for the same tenant, actor, request id, run, round, team and payload, and rejects conflicting request-id reuse                                                                                                                                                                                    | `IDEMPOTENCY_EVIDENCE / AUDIT_EVIDENCE`                             |
| Runtime V3 integration guard             | `tests/integration/course-runtime-v3-synthetic-execution.test.ts` verifies synthetic course execution from blueprint through decision submit idempotency, lock, settlement, publish, Student redaction, Teacher evidence, Tenant Admin scope, Platform authority, denied operations, Replay, Shadow Arena, Learning Evidence and audit request-id integrity | `INTEGRATION_TEST_EVIDENCE / REPLAY_GOLDEN / SHADOW_ARENA_EVIDENCE` |
| Runtime V3 browser smoke                 | `tests/e2e-ui/course-runtime-v3-smoke.spec.ts` renders Teacher, Student and Tenant Admin evidence surfaces and checks Student-visible content for protected marker absence                                                                                                                                                                                  | `E2E_BROWSER`                                                       |
| Runtime V3 documentation                 | `docs/quality/course-runtime-v3-productization.md` and `docs/operations/r8-g1-course-runtime-v3-internal-draft.md` record status boundaries, non-goals, internal handling and independent-review expectations                                                                                                                                               | `CURRENT_LOCAL_READ_ONLY`                                           |

## Program 023 L1 Synthetic Internal Application Readiness Addendum

| Evidence                                   | Current result                                                                                                                                                                                                                                                              | Evidence label                                               |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| PR #207 Course Runtime V3 merge            | PR #207 was ordinary-merged to master; post-merge detached baseline validation passed format, hidden Unicode, lint, typecheck, full test, build, E2E UI, contract, security audit and direct-store boundary gates                                                           | `CURRENT_GITHUB_READBACK / POSTMERGE_MASTER_EVIDENCE`        |
| L1 readiness evidence helper               | `services/api/src/l1-synthetic-internal-application-readiness.ts` derives a synthetic internal-only readiness report from Course Runtime V3 evidence without changing truth, Replay hash, SettlementResult shape, Student visibility or direct-store behavior               | `CONTRACT_BACKED_EVIDENCE / SOURCE_ONLY_INFERENCE`           |
| Runtime-backed readiness integration       | `tests/integration/course-runtime-v3-synthetic-execution.test.ts` now creates the L1 readiness report from the real Course Runtime V3 execution evidence and asserts all required capabilities, non-proofs, direct-store neutrality and independent review requirement      | `INTEGRATION_TEST_EVIDENCE / REPLAY_GOLDEN`                  |
| L1 readiness documentation and R8-G1 draft | `docs/quality/l1-synthetic-internal-application-readiness.md` and `docs/operations/r8-g1-l1-synthetic-internal-application-readiness-draft.md` record status boundaries, known limits, operator hold points and validation evidence while preserving `L1 Status: NOT_READY` | `CURRENT_LOCAL_READ_ONLY / INTERNAL_ONLY_DRAFT_NOT_RELEASED` |

## Program 024 L1 Golden M1 Course Runtime Consolidation Addendum

| Evidence                                  | Current result                                                                                                                                                                                                                                                                                   | Evidence label                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| PR #208 L1 readiness merge                | PR #208 was ordinary-merged to master; post-merge detached baseline validation passed format, hidden Unicode, lint, typecheck, full test, build, E2E UI, contract, security audit and direct-store boundary gates                                                                                | `CURRENT_GITHUB_READBACK / POSTMERGE_MASTER_EVIDENCE`              |
| Golden M1 runtime consolidation helper    | `services/api/src/l1-golden-m1-course-runtime-consolidation.ts` consumes Course Runtime V3 and L1 readiness evidence and validates teacher course operations, Student redaction, Tenant Admin scope, replay / shadow replay non-overwrite, idempotency, R8-G1 draft state and R4 read-only scope | `CONTRACT_BACKED_EVIDENCE / SOURCE_ONLY_INFERENCE`                 |
| Golden M1 consolidation integration guard | `tests/integration/l1-golden-m1-course-runtime-consolidation.test.ts` asserts the consolidated runtime chain, G0-G7 evidence entries, non-proofs, direct-store neutrality, Student negative visibility failure, R8-G1 draft state and R4 Discovery read-only boundary                            | `INTEGRATION_TEST_EVIDENCE / REPLAY_GOLDEN / IDEMPOTENCY_EVIDENCE` |
| Golden M1 consolidation browser smoke     | `tests/e2e-ui/l1-golden-m1-course-runtime-consolidation.spec.ts` renders Teacher, Student and Tenant Admin evidence summaries and checks Student-visible content for protected marker absence                                                                                                    | `E2E_BROWSER`                                                      |
| Golden M1 consolidation documentation     | `docs/quality/l1-golden-m1-course-runtime-consolidation.md` and `docs/operations/r8-g1-l1-golden-m1-course-runtime-consolidation-draft.md` record status boundaries, internal-only handling, known limits and independent-review expectations while preserving `L1 Status: NOT_READY`            | `CURRENT_LOCAL_READ_ONLY / INTERNAL_ONLY_DRAFT_NOT_RELEASED`       |

## Reachable Surface Matrix

| Surface                   | Current classification | Evidence                                                        |
| ------------------------- | ---------------------- | --------------------------------------------------------------- |
| result envelope           | `REACHABLE_AND_TESTED` | Student redaction and Teacher evidence tests                    |
| structured error envelope | `REACHABLE_AND_TESTED` | `TRUTH-403-001`, `TENANT-403-001` tests                         |
| free-text error           | `REACHABLE_AND_TESTED` | R3 free-text sentinel test                                      |
| replay artifact           | `REACHABLE_AND_TESTED` | Teacher/Tenant Admin authorized replay evidence; Student denied |
| audit/status surface      | `REACHABLE_AND_TESTED` | Tenant Admin audit/status scope tests                           |
| Teacher UI                | `REACHABLE_AND_TESTED` | Playwright teacher publish smoke                                |
| Student UI                | `REACHABLE_AND_TESTED` | Playwright student redaction smoke                              |
| Tenant Admin UI           | `REACHABLE_AND_TESTED` | Playwright admin current-tenant smoke                           |
| browser console           | `REACHABLE_AND_TESTED` | L1 browser smoke checks forbidden markers                       |
| server log                | `NOT_IMPLEMENTED`      | no structured runtime log export in current app                 |
| telemetry                 | `NOT_IMPLEMENTED`      | no telemetry adapter in current app                             |
| export                    | `NOT_IMPLEMENTED`      | no result export adapter in current app                         |

`NOT_IMPLEMENTED` surfaces are not counted as safe runtime proof. They remain future evidence gaps if implemented.

## Non-Proofs

This ledger does not prove `G0 PASS`, `L1 READY`, real Teacher rehearsal, `Pilot`, `Production`, PostgreSQL runtime, SQL, migration, durable settlement, backup restore, distributed recovery, R4 Macro, R9, or R10.

## Issue Relationship

Relates to #111. Relates to #114. Relates to #115.
