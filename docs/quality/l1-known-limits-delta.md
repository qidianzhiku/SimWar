# L1 Known Limits Delta

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

This delta records what changed after moving from a dry-run harness to a
synthetic internal validation evidence package. It does not erase the known
limits from `docs/quality/l1-known-limits-and-release-note.md`.

## Delta Matrix

| Limit                   | Current classification | Evidence                                 | Follow-up                                                   |
| ----------------------- | ---------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| Human teacher rehearsal | `NOT_RUN`              | This mission is Codex synthetic only     | Needs separate participant schedule and Owner authorization |
| Pilot / Production      | `NOT_AUTHORIZED`       | Status boundary preserved                | Do not start from this PR                                   |
| PostgreSQL runtime      | `NOT_AUTHORIZED`       | JSON runtime only                        | Separate explicit opt-in PR required                        |
| Durable recovery        | `NOT_PROVEN`           | Synthetic cleanup only                   | Requires future durability/recovery mission                 |
| UI session coverage     | `PASS_WITH_LIMITS`     | Existing targeted UI smoke can be reused | Full real-session UX remains future work                    |
| Replay recovery         | `PASS_WITH_LIMITS`     | replay_writes_formal_results = false     | Not durable recovery                                        |
| Issue queue             | `CANDIDATE_ONLY`       | No Issue mutation allowed                | Owner triage required                                       |

## Evidence Handoff

| Field                 | Value                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Evidence Type:        | `KNOWN_LIMITS_DELTA`                                                                                                     |
| Source SHA:           | `19d662f51e25301cd60fe9fa2965b3fd538e5fab`                                                                               |
| Branch / PR:          | `SIMWAR-P7-L1-VAL-MACRO-042A evidence branch`                                                                            |
| File / Command:       | `docs/quality/l1-known-limits-delta.md`; `npm test -- tests/integration/l1-internal-validation-session-evidence.test.ts` |
| Result:               | `CREATED_PENDING_REVALIDATION`                                                                                           |
| Scope of Proof:       | Known limit changes after synthetic evidence package creation                                                            |
| Explicit Non-Proof:   | Known Limits docs != operational rehearsal; Synthetic validation evidence PR != L1 READY                                 |
| Owner:                | Marshall                                                                                                                 |
| Collected At:         | 2026-07-09                                                                                                               |
| Expiry Trigger:       | known limits, product surface, runtime, auth, replay, dependency or Owner boundary change                                |
| Revalidation Command: | `npm test -- tests/integration/l1-internal-validation-session-evidence.test.ts`                                          |
| No-Go Trigger:        | Known limit removed, softened, or used to claim Pilot / Production / durable settlement                                  |

## Non-Proof Boundary

Known Limits docs != operational rehearsal.
Synthetic validation evidence PR != human teacher rehearsal.
Session Evidence Pack != Controlled Pilot.

## Issue Relationship

Relates to #111
Relates to #114
Relates to #115
