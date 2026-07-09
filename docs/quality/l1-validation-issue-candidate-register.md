# L1 Validation Issue Candidate Register

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

This register captures issue candidates only. Issue mutation is not authorized.
Issue closeout is not authorized.

## Candidate Register

| Candidate               | Trigger                                                                                                                                                                            | Severity | Current owner            | Action                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------ | ------------------------------------------------ |
| Student visibility leak | Student sees `state_true`, `private_replay`, private trace, `canonical_evidence_digest`, `decision_batch_hash`, `json_runtime_source_digest`, other team data or other tenant data | P0       | Owner / runtime owner    | Stop validation and authorize remediation        |
| Replay overwrite        | Replay Review writes official result or changes official replay hash semantics                                                                                                     | P0       | Owner / replay owner     | Stop validation and authorize replay remediation |
| Cleanup proof gap       | Synthetic cleanup cannot be proven without durable recovery language                                                                                                               | P1       | Owner / operations owner | Classify known limit or split remediation        |
| UI validation gap       | Existing UI cannot support the synthetic session slice without frontend mutation                                                                                                   | P1       | Owner / frontend owner   | Separate UI scope decision                       |
| PostgreSQL pressure     | Validation requires SQL, migration, PostgreSQL runtime or ProviderSelector mode                                                                                                    | P0       | Owner                    | Stop and reject scope escape                     |
| Issue governance drift  | Any path requires Issue mutation or closeout                                                                                                                                       | P0       | Owner                    | Stop and re-authorize governance separately      |

## Governance Boundary

```text
Issue mutation: NOT_AUTHORIZED
Issue closeout: NOT_AUTHORIZED
Workflow rerun: NOT_AUTHORIZED
Pilot / Production: NOT_AUTHORIZED
```

## Evidence Handoff

| Field                 | Value                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Evidence Type:        | `ISSUE_QUEUE_CANDIDATE_REGISTER`                                                                                                          |
| Source SHA:           | `19d662f51e25301cd60fe9fa2965b3fd538e5fab`                                                                                                |
| Branch / PR:          | `SIMWAR-P7-L1-VAL-MACRO-042A evidence branch`                                                                                             |
| File / Command:       | `docs/quality/l1-validation-issue-candidate-register.md`; `npm test -- tests/integration/l1-internal-validation-session-evidence.test.ts` |
| Result:               | `CREATED_PENDING_REVALIDATION`                                                                                                            |
| Scope of Proof:       | Issue candidate classification without mutating Issues                                                                                    |
| Explicit Non-Proof:   | Issue Queue Candidate Register != Issue mutation; Synthetic validation evidence PR != L1 READY                                            |
| Owner:                | Marshall                                                                                                                                  |
| Collected At:         | 2026-07-09                                                                                                                                |
| Expiry Trigger:       | issue policy, known limits, validation result, student projection or replay behavior change                                               |
| Revalidation Command: | `npm test -- tests/integration/l1-internal-validation-session-evidence.test.ts`                                                           |
| No-Go Trigger:        | Candidate requires immediate mutation, closeout, workflow rerun or forbidden runtime change                                               |

## Non-Proof Boundary

Synthetic validation evidence PR != human teacher rehearsal.
Synthetic validation evidence PR != L1 READY.
Security audit pass != complete security proof.

## Issue Relationship

Relates to #111
Relates to #114
Relates to #115
