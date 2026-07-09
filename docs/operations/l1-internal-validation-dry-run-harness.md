# L1 Internal Application Validation Dry-run Harness

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

This internal-only dry-run harness describes how to run a synthetic Phase 7 L1
Internal Application Validation session in JSON runtime only. It must not be
used as a real teacher rehearsal, Pilot, Production, SQL, migration,
PostgreSQL runtime or durable settlement procedure.

## Linked Inputs

- `docs/operations/l1-internal-validation-entry-package.md`
- `docs/quality/l1-internal-validation-evidence-pack.md`
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

## Dry-run Paths

| Path                  | Required dry-run evidence                                                                                                                       | Stop rule                                                                                                                                                                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Teacher path          | Teacher can use existing runtime and BFF/product surface evidence to drive course, run, round, lock, settle, publish and replay review steps    | stop if Teacher must write formal truth, score, rank, SettlementResult, state_true or replay artifacts                                                                                                                                                   |
| Student path          | Student can submit only own-team decisions and inspect redacted result, state_obs/state_est, three-part feedback and advisory-only placeholders | stop if Student sees `state_true`, `private_replay`, `private trace`, `ReplayManifest`, `replay_manifest`, `decision_batch_hash`, `json_runtime_source_digest`, `canonical_evidence_digest`, `tenant_other`, other team data or Teacher private evidence |
| Tenant Admin path     | Tenant Admin can inspect current-tenant status or audit evidence                                                                                | stop if cross-tenant data appears                                                                                                                                                                                                                        |
| Platform Admin path   | Platform Admin must use explicit platform authority and explicit scope                                                                          | stop if platform authority becomes implicit through a missing tenant or scope                                                                                                                                                                            |
| Golden M1 path        | Existing Golden M1 and BFF DTO guards provide synthetic course/run/round/decision/result continuity                                             | stop if runtime mutation is required                                                                                                                                                                                                                     |
| Replay Review path    | Teacher-visible replay evidence remains read-only and `replay_writes_formal_results = false`                                                    | stop if replay overwrites official result or changes replay hash semantics                                                                                                                                                                               |
| Abort / Reset path    | Controlled abort preserves request id/error code and fresh in-memory store reset remains synthetic only                                         | stop if cleanup claims backup restore, durable recovery or real data cleanup                                                                                                                                                                             |
| Cleanup path          | Synthetic cleanup is a fresh JSON memory store only                                                                                             | stop if PostgreSQL, SQL, migration or production data is required                                                                                                                                                                                        |
| Issue Escalation path | Record role, tenant, run, round, stable error code and evidence label                                                                           | stop if issue mutation or issue closeout is required                                                                                                                                                                                                     |

## Pre-session Checklist

1. Confirm master is `26be81a7f89bcba883e20ab80894d5284e39e681`.
2. Confirm PR #217 is merged.
3. Confirm R8-G1 Status is `MERGED_AND_POSTMERGE_VALIDATED`.
4. Confirm `docs/operations/r8-g1-internal-application-pack-index.md` exists.
5. Confirm Known Limits are read before any Go / No-Go discussion.
6. Confirm the dry-run uses synthetic identities only.
7. Confirm Actual L1 Internal Validation: NOT_RUN.
8. Confirm real teacher rehearsal: NOT_AUTHORIZED.

## Post-session Classification

| Classification                                     | Meaning                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `READY_FOR_INTERNAL_VALIDATION_EXECUTION_DECISION` | Docs, tests, Student visibility, replay review, abort/reset and evidence pack are all reviewable |
| `READY_WITH_LIMITS`                                | Dry-run harness is reviewable but UI/browser or cleanup evidence remains limited                 |
| `BLOCKED_BY_VISIBILITY_RISK`                       | Student or tenant projection leaked protected markers                                            |
| `BLOCKED_BY_REPLAY_OR_RESET_GAP`                   | replay, reset or cleanup cannot be represented safely                                            |
| `BLOCKED_BY_SCOPE_ESCAPE`                          | runtime, frontend, schema, package, database or workflow mutation is required                    |

## Evidence Handoff

| Field                 | Value                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Evidence Type:        | `L1_DRY_RUN_HARNESS_EVIDENCE / DOCS_ONLY`                                                                             |
| Source SHA:           | `26be81a7f89bcba883e20ab80894d5284e39e681`                                                                            |
| Result:               | `CREATED`                                                                                                             |
| Scope of Proof:       | Internal synthetic dry-run sequence and no-go boundary                                                                |
| Explicit Non-Proof:   | Not real session success and not L1 READY                                                                             |
| Owner:                | Marshall                                                                                                              |
| Expiry Trigger:       | master SHA, product surface, DTO, auth, tenant boundary, replay, reset or known limits change                         |
| Revalidation Command: | `npm test -- tests/integration/l1-internal-validation-dry-run-harness.test.ts`                                        |
| No-Go Trigger:        | Student visibility leak, replay overwrite, cleanup overclaim, UI mutation requirement or forbidden runtime dependency |

## Issue Relationship

Relates to #111.
Relates to #114.
Relates to #115.
