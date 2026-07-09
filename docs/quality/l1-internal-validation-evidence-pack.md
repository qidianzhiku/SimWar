# L1 Internal Application Validation Evidence Pack

## Status Boundary

```text
Current master anchor:
26be81a7f89bcba883e20ab80894d5284e39e681

Prior merge:
PR #217 merged

G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

R8-G1 Status:
MERGED_AND_POSTMERGE_VALIDATED

PostgreSQL Runtime:
NOT_AUTHORIZED

Pilot / Production:
NOT_AUTHORIZED

Durable Settlement:
NOT_PROVEN
```

This evidence pack is an internal-only review package for the Phase 7 L1
Internal Application Validation dry-run harness. It does not execute actual L1
Internal Validation and does not authorize real teacher rehearsal, Pilot,
Production, PostgreSQL runtime, SQL, migration or durable settlement.

## Linked Inputs

- `docs/operations/l1-internal-validation-entry-package.md`
- `docs/operations/l1-internal-validation-dry-run-harness.md`
- `docs/operations/l1-teacher-kit-internal-only.md`
- `docs/operations/l1-session-runbook-lite.md`
- `docs/operations/l1-synthetic-data-reset-and-abort.md`
- `docs/operations/l1-replay-evidence-review-checklist.md`
- `docs/operations/l1-issue-escalation-procedure.md`
- `docs/operations/r8-g1-internal-application-pack-index.md`
- `docs/quality/l1-known-limits-and-release-note.md`
- `tests/integration/l1-internal-validation-rehearsal-gate.test.ts`
- `tests/integration/l1-session-abort-reset-recovery.test.ts`
- `tests/integration/teacher-student-bff-dto-productization.test.ts`

## Evidence Collection Matrix

| Evidence           | Required source                                                                                                        | Evidence label                  | Explicit Non-Proof          | Expiry Trigger              | No-Go Trigger                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------- | --------------------------- | ----------------------------------- |
| Source SHA         | `26be81a7f89bcba883e20ab80894d5284e39e681`                                                                             | `CURRENT_REMOTE_GIT_READBACK`   | not future master proof     | master SHA changed          | current fact drift                  |
| Phase 7 entry      | `docs/operations/l1-internal-validation-entry-package.md`                                                              | `PHASE7_ENTRY_PACKAGE_EVIDENCE` | not validation execution    | entry package changed       | missing status boundary             |
| Dry-run harness    | `docs/operations/l1-internal-validation-dry-run-harness.md`                                                            | `L1_DRY_RUN_HARNESS_EVIDENCE`   | not Teacher rehearsal       | dry-run harness changed     | missing no-go trigger               |
| R8-G1 pack         | `docs/operations/r8-g1-internal-application-pack-index.md`                                                             | `R8_G1_ON_MASTER_EVIDENCE`      | not R8-G1 release by itself | pack index changed          | pack component missing              |
| Teacher Kit        | `docs/operations/l1-teacher-kit-internal-only.md`                                                                      | `DOCS_ONLY`                     | not operational rehearsal   | Teacher surface changed     | Teacher formal truth write          |
| Known Limits       | `docs/quality/l1-known-limits-and-release-note.md`                                                                     | `DOCS_ONLY`                     | not Pilot readiness         | known limits changed        | release overclaim                   |
| Abort / Reset      | `docs/operations/l1-synthetic-data-reset-and-abort.md` and `tests/integration/l1-session-abort-reset-recovery.test.ts` | `ABORT_RESET_EVIDENCE`          | not durable recovery        | reset model changed         | cleanup claims durable recovery     |
| Replay Review      | `docs/operations/l1-replay-evidence-review-checklist.md`                                                               | `REPLAY_REVIEW_EVIDENCE`        | not durable replay          | replay evidence changed     | replay writes official result       |
| Issue Escalation   | `docs/operations/l1-issue-escalation-procedure.md`                                                                     | `ESCALATION_EVIDENCE`           | not issue mutation          | issue policy changed        | issue closeout or mutation required |
| Rehearsal gate     | `tests/integration/l1-internal-validation-rehearsal-gate.test.ts`                                                      | `INTEGRATION_TEST_EVIDENCE`     | not real session success    | test changed                | gate UNKNOWN or FAIL                |
| BFF DTO projection | `tests/integration/teacher-student-bff-dto-productization.test.ts`                                                     | `STUDENT_PROJECTION_EVIDENCE`   | not complete UI proof       | DTO/product surface changed | Student visibility leak             |

## Student Negative Visibility Evidence

The evidence pack must preserve a no-go check for these Student-forbidden
markers:

- `state_true`
- `private_replay`
- `private trace`
- `ReplayManifest`
- `replay_manifest`
- `decision_batch_hash`
- `json_runtime_source_digest`
- `canonical_evidence_digest`
- `tenant_other`
- other team data
- Teacher private evidence

Any Student-visible occurrence is a no-go trigger.

## Replay and Cleanup Evidence

- `replay_writes_formal_results = false` must remain true for replay review.
- Replay Review path must not overwrite official result identity.
- Abort / Reset path must remain synthetic JSON memory reset only.
- Cleanup path must not claim backup restore, durable recovery, PostgreSQL
  restore, SQL rollback or Production data cleanup.

## Required Commands

| Command                                                                                                                                      | Proof Scope                                     | Explicit Non-Proof               |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------- |
| `npm test -- tests/integration/l1-internal-validation-dry-run-harness.test.ts`                                                               | document and boundary package exists            | not runtime proof                |
| `npm test -- tests/integration/l1-internal-validation-rehearsal-gate.test.ts`                                                                | controlled HTTP rehearsal gate remains guarded  | not real teacher rehearsal       |
| `npm test -- tests/integration/teacher-student-bff-dto-productization.test.ts`                                                               | BFF DTO projection remains guarded              | not full frontend security audit |
| `npm test -- tests/integration/l1-session-abort-reset-recovery.test.ts`                                                                      | synthetic abort/reset remains guarded           | not durable recovery             |
| `npm run test:e2e:ui -- tests/e2e-ui/teacher-student-frontend-bff-dto-consumption.spec.ts tests/e2e-ui/l1-internal-validation-smoke.spec.ts` | existing UI/browser dry-run slice can be reused | not Pilot readiness              |

## Evidence Handoff

| Field                 | Value                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Evidence Type:        | `L1_EVIDENCE_PACK_EVIDENCE / DOCS_ONLY`                                                                                                   |
| Source SHA:           | `26be81a7f89bcba883e20ab80894d5284e39e681`                                                                                                |
| Result:               | `CREATED`                                                                                                                                 |
| Scope of Proof:       | Evidence collection rules, expiry triggers and no-go triggers for Phase 7 dry-run review                                                  |
| Explicit Non-Proof:   | Not L1 Internal Validation completed                                                                                                      |
| Owner:                | Marshall                                                                                                                                  |
| Expiry Trigger:       | master SHA, workflow, R8-G1 pack, Phase 7 harness, product surface, DTO, auth, tenant boundary, replay, known limits or dependency change |
| Revalidation Command: | `npm test -- tests/integration/l1-internal-validation-dry-run-harness.test.ts`                                                            |
| No-Go Trigger:        | Student visibility leak, replay overwrite, cleanup overclaim, issue closeout, forbidden runtime dependency or validation failure          |

## Issue Relationship

Relates to #111.
Relates to #114.
Relates to #115.
