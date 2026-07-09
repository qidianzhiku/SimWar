# L1 Observed Failure Log

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

This log records observed and expected failure handling for the synthetic
internal validation run. No runtime failure was hidden or converted into a
success claim.

## Failure Register

| Area                              | Expected / observed result                                                         | Severity | No-Go Trigger                       | Remediation Owner                      |
| --------------------------------- | ---------------------------------------------------------------------------------- | -------- | ----------------------------------- | -------------------------------------- |
| Student protected truth payload   | Existing integration guard expects `TRUTH-403-001` and no protected payload leak   | P0       | Student sees protected truth marker | Owner decision before next validation  |
| Student private replay visibility | Existing BFF and E2E evidence expect no `private_replay` or private trace exposure | P0       | Student sees private replay marker  | Runtime/projection remediation         |
| Cross-tenant access               | Existing tenant guard expects scoped access only                                   | P0       | Tenant Admin sees other tenant data | Tenant boundary remediation            |
| Replay overwrite                  | Replay review remains read-only; replay_writes_formal_results = false              | P0       | Replay writes official result       | Replay remediation                     |
| Cleanup proof                     | Fresh in-memory JSON runtime cleanup only                                          | P1       | Cleanup claims durable recovery     | Known limits update and Owner decision |
| Browser support                   | Existing UI smoke slice is reusable without frontend mutation                      | P1       | UI requires source mutation         | UI gap decision                        |

## Evidence Handoff

| Field                 | Value                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Evidence Type:        | `OBSERVED_FAILURE_LOG`                                                                                             |
| Source SHA:           | `19d662f51e25301cd60fe9fa2965b3fd538e5fab`                                                                         |
| Branch / PR:          | `SIMWAR-P7-L1-VAL-MACRO-042A evidence branch`                                                                      |
| File / Command:       | `docs/quality/l1-observed-failure-log.md`; `npm test -- tests/integration/l1-session-abort-reset-recovery.test.ts` |
| Result:               | `CREATED_PENDING_REVALIDATION`                                                                                     |
| Scope of Proof:       | Expected no-go failures and remediation ownership for synthetic validation                                         |
| Explicit Non-Proof:   | Observed Failure Log != production incident log; Synthetic validation evidence PR != human teacher rehearsal       |
| Owner:                | Marshall                                                                                                           |
| Collected At:         | 2026-07-09                                                                                                         |
| Expiry Trigger:       | error handling, auth, projection, replay, cleanup or product surface change                                        |
| Revalidation Command: | `npm test -- tests/integration/l1-session-abort-reset-recovery.test.ts`                                            |
| No-Go Trigger:        | Hidden failure, missing stable error code, protected data leak or forbidden mutation requirement                   |

## Non-Proof Boundary

Synthetic validation evidence PR != L1 READY.
Observed Failure Log != production incident log.
Security audit pass != complete security proof.

## Issue Relationship

Relates to #111
Relates to #114
Relates to #115
