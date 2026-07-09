# L1 Internal Application Validation Entry Package

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

This Phase 7 package is an internal-only entry package for L1 Internal
Application Validation dry-run preparation. In short, this is the L1 Internal
Application Validation entry package. It is not actual validation
execution, not a real teacher rehearsal, not Pilot, not Production and not
PostgreSQL runtime activation.

## Phase 7 Objective

The entry objective is to turn the merged R8-G1 internal application pack into a
reviewable dry-run plan for one synthetic 30-60 minute internal validation
session. The plan connects Teacher, Student, Tenant Admin and Platform Admin
paths with Golden M1, BFF/frontend product surfaces, Replay Review, Abort /
Reset, Cleanup, Issue Escalation evidence and the Phase 7 evidence pack.

## Current Evidence Anchor

| Item                 | Evidence                                                           |
| -------------------- | ------------------------------------------------------------------ |
| Master SHA           | `26be81a7f89bcba883e20ab80894d5284e39e681`                         |
| Prior PR             | PR #217                                                            |
| R8-G1 pack index     | `docs/operations/r8-g1-internal-application-pack-index.md`         |
| Teacher Kit          | `docs/operations/l1-teacher-kit-internal-only.md`                  |
| Session Runbook      | `docs/operations/l1-session-runbook-lite.md`                       |
| Abort / Reset        | `docs/operations/l1-synthetic-data-reset-and-abort.md`             |
| Replay Review        | `docs/operations/l1-replay-evidence-review-checklist.md`           |
| Issue Escalation     | `docs/operations/l1-issue-escalation-procedure.md`                 |
| Known Limits         | `docs/quality/l1-known-limits-and-release-note.md`                 |
| Rehearsal gate guard | `tests/integration/l1-internal-validation-rehearsal-gate.test.ts`  |
| Abort/reset guard    | `tests/integration/l1-session-abort-reset-recovery.test.ts`        |
| BFF DTO guard        | `tests/integration/teacher-student-bff-dto-productization.test.ts` |

## Participant Matrix

| Role                | Dry-run purpose                                                | Boundary                                             |
| ------------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| Teacher path        | Open, lock, settle, publish and review authorized evidence     | no formal truth write                                |
| Student path        | Submit own-team decision and inspect redacted result           | no state_true, no private replay, no other team data |
| Tenant Admin path   | Review current-tenant status and audit evidence                | no cross-tenant access                               |
| Platform Admin path | Review only explicitly scoped platform authority evidence      | no implicit global read                              |
| Internal Operator   | Preserve evidence, classify no-go triggers and stop conditions | no issue mutation                                    |

## Entry Criteria

1. Current remote master remains
   `26be81a7f89bcba883e20ab80894d5284e39e681`.
2. PR #217 remains merged.
3. R8-G1 pack files remain on master.
4. Required local validation commands for this dry-run harness pass.
5. Student projection and tenant boundary evidence remain current.
6. `Relates to #111`, `Relates to #114` and `Relates to #115` remain
   relationship-only governance references.

## No-Go Trigger Matrix

| Area               | No-Go Trigger                                                                                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Student projection | Student sees `state_true`, `private_replay`, `private trace`, `ReplayManifest`, `replay_manifest`, `decision_batch_hash`, `json_runtime_source_digest`, `canonical_evidence_digest`, `tenant_other`, other team data or Teacher private evidence |
| Replay             | Replay evidence writes formal results, or `replay_writes_formal_results = false` cannot be verified                                                                                                                                              |
| Reset              | Cleanup requires real data, SQL, migration, PostgreSQL runtime or durable recovery                                                                                                                                                               |
| Issue escalation   | The dry-run requires issue mutation or closeout wording                                                                                                                                                                                          |
| Product surface    | UI requires source mutation to support the dry-run                                                                                                                                                                                               |
| Governance         | Any claim upgrades G0 PASS, L1 READY, Pilot, Production or durable settlement                                                                                                                                                                    |

## Explicit Non-Proof

This package does not prove L1 READY, Teacher rehearsal, Pilot readiness,
Production readiness, PostgreSQL runtime readiness, backup restore, durable
recovery or durable settlement.

## Evidence Handoff

| Field                 | Value                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Evidence Type:        | `PHASE7_ENTRY_PACKAGE_EVIDENCE / DOCS_ONLY`                                                                              |
| Source SHA:           | `26be81a7f89bcba883e20ab80894d5284e39e681`                                                                               |
| Result:               | `CREATED`                                                                                                                |
| Scope of Proof:       | Phase 7 entry criteria and dry-run input freeze                                                                          |
| Explicit Non-Proof:   | Not actual L1 Internal Validation execution                                                                              |
| Owner:                | Marshall                                                                                                                 |
| Expiry Trigger:       | master SHA, PR #217 merge evidence, R8-G1 pack, BFF DTO, product surface, tenant boundary, replay or known limits change |
| Revalidation Command: | `npm test -- tests/integration/l1-internal-validation-dry-run-harness.test.ts`                                           |
| No-Go Trigger:        | Current anchor drift, Student visibility leak, replay overwrite, cleanup overclaim or forbidden runtime dependency       |

## Issue Relationship

Relates to #111.
Relates to #114.
Relates to #115.
