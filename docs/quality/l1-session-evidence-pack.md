# L1 Session Evidence Pack

## Status Boundary

```text
Current master anchor:
19d662f51e25301cd60fe9fa2965b3fd538e5fab

Prior merge:
PR #218 merged

G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

R8-G1 Status:
MERGED_AND_POSTMERGE_VALIDATED

Phase 7 Status:
SYNTHETIC_SESSION_EVIDENCE_PR_CREATED

PostgreSQL Runtime:
NOT_AUTHORIZED

Pilot / Production:
NOT_AUTHORIZED

Durable Settlement:
NOT_PROVEN
```

This pack records a Codex synthetic internal validation run. It is based on
current master, the R8-G1 internal application pack, the Phase 7 dry-run
harness, existing Teacher / Student product surfaces, existing integration
guards and existing browser evidence. It is not a human teacher rehearsal.

## Session Identity

| Field                           | Value                                          |
| ------------------------------- | ---------------------------------------------- |
| Session type                    | `CODEX_SYNTHETIC_INTERNAL_VALIDATION_RUN_ONLY` |
| Runtime                         | JSON / memory store only                       |
| real customer data:             | NOT_USED                                       |
| actual human teacher rehearsal: | NOT_RUN                                        |
| Human participant schedule      | NOT_AUTHORIZED                                 |
| PostgreSQL / SQL / migration    | NOT_AUTHORIZED                                 |
| Pilot / Production              | NOT_AUTHORIZED                                 |

## Role Path Coverage

| Path                           | Evidence source                                                                                                                         | Result                          | Scope of Proof                                                                                                | Explicit Non-Proof                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Teacher path                   | `tests/integration/l1-internal-validation-rehearsal-gate.test.ts`; `tests/e2e-ui/teacher-student-frontend-bff-dto-consumption.spec.ts`  | `PASS_ON_REVALIDATION_REQUIRED` | Teacher can drive existing course/run/round/lock/settle/publish/replay evidence path in synthetic test slices | Not real teacher rehearsal                        |
| Student path                   | `tests/integration/teacher-student-bff-dto-productization.test.ts`; `tests/e2e-ui/teacher-student-frontend-bff-dto-consumption.spec.ts` | `PASS_ON_REVALIDATION_REQUIRED` | Student result projection remains redacted and advisory-only                                                  | Not full UI security audit                        |
| Tenant Admin path              | `tests/integration/l1-internal-validation-rehearsal-gate.test.ts`                                                                       | `PASS_ON_REVALIDATION_REQUIRED` | Tenant scoped summary and audit evidence remain bounded                                                       | Not cross-tenant production proof                 |
| Platform Admin path            | `tests/integration/teacher-student-bff-dto-productization.test.ts`                                                                      | `PASS_ON_REVALIDATION_REQUIRED` | Explicit platform authority remains separate from tenant-scoped read                                          | Not implicit global access                        |
| Replay Evidence Review         | `docs/operations/l1-replay-evidence-review-checklist.md`; `tests/integration/l1-internal-validation-rehearsal-gate.test.ts`             | `PASS_ON_REVALIDATION_REQUIRED` | replay_writes_formal_results = false                                                                          | Replay Evidence Review Result != durable recovery |
| Abort / Recovery Result        | `tests/integration/l1-session-abort-reset-recovery.test.ts`                                                                             | `PASS_ON_REVALIDATION_REQUIRED` | Controlled abort keeps stable error and does not leak protected data                                          | Not durable rollback                              |
| Synthetic Data Cleanup Proof   | `docs/operations/l1-synthetic-cleanup-proof.md`                                                                                         | `DOCS_AND_TESTS_ONLY`           | Cleanup is fresh in-memory JSON runtime boundary                                                              | Cleanup Proof != durable backup / restore proof   |
| Known Limits Delta             | `docs/quality/l1-known-limits-delta.md`                                                                                                 | `DOCS_AND_TESTS_ONLY`           | Known limits are explicit before any next decision                                                            | Known limits are not operational rehearsal        |
| Issue Queue Candidate Register | `docs/quality/l1-validation-issue-candidate-register.md`                                                                                | `DOCS_AND_TESTS_ONLY`           | Issue candidates can be handed to Owner without Issue mutation                                                | Issue mutation remains not authorized             |

## Student Negative Visibility Markers

The synthetic validation run treats any Student-visible occurrence of these
markers as a no-go:

- `state_true`
- `private_replay`
- `private trace`
- `canonical_evidence_digest`
- `decision_batch_hash`
- `json_runtime_source_digest`
- other team data
- other tenant data

## Evidence Handoff

| Field                 | Value                                                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Evidence Type:        | `L1_SESSION_EVIDENCE_PACK`                                                                                                                           |
| Source SHA:           | `19d662f51e25301cd60fe9fa2965b3fd538e5fab`                                                                                                           |
| Branch / PR:          | `SIMWAR-P7-L1-VAL-MACRO-042A evidence branch`                                                                                                        |
| File / Command:       | `docs/quality/l1-session-evidence-pack.md`; `npm test -- tests/integration/l1-internal-validation-session-evidence.test.ts`                          |
| Result:               | `CREATED_PENDING_REVALIDATION`                                                                                                                       |
| Scope of Proof:       | Synthetic internal validation evidence package and role-path coverage                                                                                |
| Explicit Non-Proof:   | Synthetic validation evidence PR != human teacher rehearsal; Synthetic validation evidence PR != L1 READY; Session Evidence Pack != Controlled Pilot |
| Owner:                | Marshall                                                                                                                                             |
| Collected At:         | 2026-07-09                                                                                                                                           |
| Expiry Trigger:       | master SHA, product surface, DTO, auth, tenant boundary, replay, known limits or dependency change                                                   |
| Revalidation Command: | `npm test -- tests/integration/l1-internal-validation-session-evidence.test.ts`                                                                      |
| No-Go Trigger:        | Student visibility leak, replay overwrite, cleanup proof gap, runtime mutation requirement or validation failure                                     |

## Non-Proof Boundary

Synthetic validation evidence PR != human teacher rehearsal.
Synthetic validation evidence PR != L1 READY.
Session Evidence Pack != Controlled Pilot.
Integration test pass != real session success.
E2E pass != full UI security audit.
Security audit pass != complete security proof.
JSON runtime != durable settlement.
real customer data: NOT_USED.
actual human teacher rehearsal: NOT_RUN.

## Issue Relationship

Relates to #111
Relates to #114
Relates to #115
