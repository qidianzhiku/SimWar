# R8-G1 Internal Application Pack Index

## Status Boundary

```text
Mission:
SIMWAR-P6-R8G1-REL-040

Current master anchor:
6f2ec0283a41eebc9bac49b408ebaba0a97559db

Current mainline anchor:
PR #216 merged

Phase 5 Gate:
L1_GATE_READY_FOR_R8_G1_INTERNAL_PACK

Phase 6 Entry:
PHASE6_ENTRY_READY_WITH_LIMITS_FOR_R8_G1_REL

G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

R8-G1 Status:
RELEASE_CANDIDATE_PENDING_CLOSURE

PostgreSQL runtime:
NOT_AUTHORIZED

Pilot / Production:
NOT_AUTHORIZED

Durable Settlement:
NOT_PROVEN
```

This index is the R8-G1 internal-only application pack release-candidate handoff.
It is prepared for `SIMWAR-P6-R8G1-AUD-CLOSURE-040B`.

It does not release R8-G1, does not complete L1 Internal Validation, does not
authorize real teacher rehearsal, and does not authorize Pilot, Production,
PostgreSQL runtime, SQL, migration or durable settlement work.

## Pack Component Matrix

| Component                   | File                                                                   | Source SHA                                 | Evidence Type                                                  | Proof Scope                                                                      | Explicit Non-Proof                                                           | Expiry Trigger                                                                             | Revalidation Command                                                                                                                    | No-Go Trigger                                                                                                                   | Owner                                   | Status                                                             |
| --------------------------- | ---------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------ | -------- | --------- |
| Teacher Kit                 | `docs/operations/l1-teacher-kit-internal-only.md`                      | `6f2ec0283a41eebc9bac49b408ebaba0a97559db` | `R8_G1_REL_CANDIDATE_EVIDENCE / DOCS_ONLY`                     | Internal teacher/operator flow and forbidden action boundary                     | Not R8-G1 release, not real teacher rehearsal, not L1 validation             | master SHA, Teacher surface, DTO, auth, tenant or replay change                            | `npm test -- tests/integration/l1-internal-validation-rehearsal-gate.test.ts`                                                           | Kit used with real users, external customers, Pilot, Production, PostgreSQL runtime, SQL, migration or durable settlement claim | Marshall                                | `UPDATED`                                                          |
| Known Limits / Release Note | `docs/quality/l1-known-limits-and-release-note.md`                     | `6f2ec0283a41eebc9bac49b408ebaba0a97559db` | `KNOWN_LIMITS_EVIDENCE / L1_RELEASE_NOTE_EVIDENCE / DOCS_ONLY` | Current non-proofs, internal release-candidate note and dependency risk boundary | Not external release, not Pilot, not Production, not complete security proof | master SHA, known limits, dependency, security or Phase Gate change                        | `npm run security:audit` and `npm audit --json`                                                                                         | Critical dependency risk or release note implies external readiness                                                             | Marshall                                | `UPDATED`                                                          |
| Session Runbook Lite        | `docs/operations/l1-session-runbook-lite.md`                           | `6f2ec0283a41eebc9bac49b408ebaba0a97559db` | `R8_G1_REL_CANDIDATE_EVIDENCE / DOCS_ONLY`                     | Synthetic session steps, evidence collection and abort triggers                  | Not operational rehearsal, not Pilot, not Production                         | product surface, role path, DTO, tenant boundary or browser evidence change                | `npm test -- tests/integration/l1-internal-validation-rehearsal-gate.test.ts`                                                           | Protected marker in DOM/console, Student leak, cross-tenant/team leak or forbidden runtime dependency                           | Marshall                                | `UPDATED`                                                          |
| Synthetic Reset / Abort     | `docs/operations/l1-synthetic-data-reset-and-abort.md`                 | `6f2ec0283a41eebc9bac49b408ebaba0a97559db` | `ABORT_RESET_EVIDENCE / DOCS_ONLY`                             | Synthetic reset model and hard abort classification                              | Not durable recovery, not backup restore, not cross-process recovery         | reset model, store boundary, replay or privacy boundary change                             | `npm test -- tests/integration/l1-session-abort-reset-recovery.test.ts`                                                                 | Real data cleanup claim, durable recovery claim or forbidden runtime requirement                                                | Marshall                                | `UPDATED`                                                          |
| Replay Evidence Review      | `docs/operations/l1-replay-evidence-review-checklist.md`               | `6f2ec0283a41eebc9bac49b408ebaba0a97559db` | `REPLAY_REVIEW_EVIDENCE / DOCS_ONLY`                           | Replay review questions, Student forbidden markers and non-overwrite checks      | Not durable replay, not backup restore, not production replay guarantee      | replay route, replay evidence, DTO projection, Student visibility or hash semantics change | `npm test -- tests/integration/m1-run-manifest-replay-evidence.test.ts tests/integration/l1-internal-validation-rehearsal-gate.test.ts` | Student sees private replay, replay writes formal result or official result overwritten                                         | Marshall                                | `UPDATED`                                                          |
| Issue Escalation            | `docs/operations/l1-issue-escalation-procedure.md`                     | `6f2ec0283a41eebc9bac49b408ebaba0a97559db` | `ESCALATION_EVIDENCE / DOCS_ONLY`                              | Escalation categories, issue relation boundary and closeout keyword prohibition  | Not Issue mutation, not closeout, not release authorization                  | issue state, PR body policy, governance or escalation procedure change                     | `rg -n "Closes                                                                                                                          | Fixes                                                                                                                           | Resolves" docs/operations docs/quality` | Closeout wording for #111/#114/#115 without separate authorization | Marshall | `UPDATED` |
| Rehearsal Gate Draft        | `docs/operations/r8-g1-l1-internal-validation-rehearsal-gate-draft.md` | `6f2ec0283a41eebc9bac49b408ebaba0a97559db` | `R8_G1_REL_CANDIDATE_EVIDENCE / DOCS_ONLY`                     | Internal rehearsal gate checklist and Go / No-Go boundary                        | Not R8-G1 release, not L1 validation, not Pilot, not Production              | master SHA, Phase Gate, product surface, DTO, auth, tenant boundary or replay change       | `npm test -- tests/integration/l1-internal-validation-rehearsal-gate.test.ts`                                                           | Draft used as real rehearsal, Pilot, Production, PostgreSQL or durable settlement proof                                         | Marshall                                | `UPDATED`                                                          |
| Current Evidence Ledger     | `docs/quality/l1-g0-g7-current-evidence-ledger.md`                     | `6f2ec0283a41eebc9bac49b408ebaba0a97559db` | `EVIDENCE_HANDOFF / R8_G1_REL_CANDIDATE_EVIDENCE`              | Cross-pack evidence ledger and Program 040 addendum                              | Not G0 PASS, not L1 READY, not complete architecture proof                   | master SHA, new PR, new product surface, evidence package or status boundary change        | `npm test`                                                                                                                              | Ledger claims readiness beyond evidence or omits mandatory non-proofs                                                           | Marshall                                | `UPDATED`                                                          |

## Phase 6 AUD-CLOSURE Handoff

`SIMWAR-P6-R8G1-AUD-CLOSURE-040B` should verify:

1. the pack PR contains docs-only changes;
2. current master or PR base still descends from
   `6f2ec0283a41eebc9bac49b408ebaba0a97559db`;
3. the PR body uses only `Relates to #111`, `Relates to #114` and
   `Relates to #115`;
4. validation commands pass or any failure is classified before merge;
5. no runtime, API, BFF, frontend, package, lockfile, workflow, schema, OpenAPI,
   database, SQL or migration files are modified;
6. no pack component claims R8-G1 release, L1 readiness, real teacher rehearsal,
   Pilot, Production, PostgreSQL runtime or durable settlement.

## Non-Proofs

```text
R8-G1 REL pack PR created != R8-G1 released
R8-G1 REL pack PR created != L1 Internal Validation completed
R8-G1 REL pack PR created != Teacher rehearsal
R8-G1 REL pack PR created != Pilot
R8-G1 REL pack PR created != Production
Phase 5 Gate pass != Teacher rehearsal
Known Limits docs != operational rehearsal
Abort / Reset docs != durable recovery
Replay Review checklist != durable recovery
JSON runtime != durable settlement
Security audit pass != complete security proof
Direct-store boundary guard pass != all architecture proof
local validation pass != future remote checks
No Pilot / Production wording found != external communication safety
```

## Issue Relationship

Relates to #111.
Relates to #114.
Relates to #115.
