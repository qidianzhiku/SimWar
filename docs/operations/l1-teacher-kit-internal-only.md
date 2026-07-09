# L1 Internal-Only Teacher Kit

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

本 Teacher Kit 仅用于 synthetic internal application validation 准备。它不是真实教师试跑批准，不是 `Pilot`，不是 `Production`，不证明 PostgreSQL runtime、SQL、migration 或 durable settlement。

## Evidence Package Boundary

```text
INTERNAL_ONLY_DRAFT_NOT_RELEASED
```

本 Teacher Kit 只能用于 synthetic internal application decision package。它不把任何 local validation、Owner authorization 或 PR 合并结果提升为 `G0 PASS`、`L1 READY`、`Pilot`、`Production`，且 PostgreSQL runtime 保持 `NOT_AUTHORIZED`。

## REL-040 Release-Candidate Binding

```text
Mission:
SIMWAR-P6-R8G1-REL-040

Current master anchor:
6f2ec0283a41eebc9bac49b408ebaba0a97559db

Phase 5 Gate:
L1_GATE_READY_FOR_R8_G1_INTERNAL_PACK

Phase 6 Entry:
PHASE6_ENTRY_READY_WITH_LIMITS_FOR_R8_G1_REL

R8-G1 Status:
RELEASE_CANDIDATE_PENDING_CLOSURE

Next audit:
SIMWAR-P6-R8G1-AUD-CLOSURE-040B
```

This Teacher Kit is refreshed as an internal-only release candidate package. It
does not release R8-G1, does not start Phase 7 L1 Internal Validation, and does
not authorize real teacher rehearsal, external customers, Pilot, Production,
PostgreSQL runtime, SQL, migration or durable settlement.

## Audience

| Role                  | Allowed use                                         |
| --------------------- | --------------------------------------------------- |
| Teacher operator      | run a synthetic M1 session with cleanable data only |
| Student participant   | use seeded or synthetic student identity only       |
| Tenant Admin observer | inspect current-tenant status only                  |
| Reviewer              | inspect evidence and non-proof boundaries           |

## Session Scope

Allowed:

- `tenant_demo` or isolated synthetic tenant only.
- One synthetic course/run/round path.
- At least one Student decision submit.
- Teacher lock, settle, publish path.
- Student redacted result review.
- Teacher authorized evidence review.
- Tenant Admin current-tenant status or audit review.
- Shadow replay evidence review where current harness supports it.

Forbidden:

- real user data
- real customer data
- real payment
- billing, entitlement or production data
- PostgreSQL runtime
- SQL
- migration
- durable settlement
- Pilot
- Production

## Operator Checklist

1. Confirm this kit is used only for internal synthetic validation.
2. Confirm `G0 PASS` remains `NOT_GRANTED`.
3. Confirm `L1 Status` remains `NOT_READY`.
4. Confirm JSON runtime is the only active default.
5. Confirm no PostgreSQL runtime, SQL or migration action is planned.
6. Confirm session has an abort point and evidence preservation rule.
7. Confirm issue references are `Relates to #111`, `Relates to #114`, and `Relates to #115` only.

## Teacher Operating Flow

1. Open the Teacher Workspace for the synthetic run.
2. Review course, run and round context before action.
3. Monitor team readiness and decision submission state.
4. Lock the round only through the authorized public Teacher route.
5. Use the authorized settlement and publish path; do not directly mutate
   `SettlementResult`, score, rank, `state_true`, replay artifacts or store
   state.
6. Review replay summary only after publish and only as authorized Teacher
   evidence.
7. Check Known Limits before any Go / No-Go discussion.
8. Follow the abort, reset and escalation procedures if any boundary fails.

## Evidence Handoff

| Field                | Value                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Evidence Type        | `R8_G1_REL_CANDIDATE_EVIDENCE / DOCS_ONLY`                                                                                      |
| Source SHA           | `6f2ec0283a41eebc9bac49b408ebaba0a97559db`                                                                                      |
| Result               | `UPDATED`                                                                                                                       |
| Scope of Proof       | Internal Teacher Kit release-candidate boundary and operator flow                                                               |
| Explicit Non-Proof   | Not R8-G1 release, not L1 validation, not real teacher rehearsal                                                                |
| Owner                | Marshall                                                                                                                        |
| Expiry Trigger       | master SHA, Phase 5 Gate, Phase 6 Entry, Teacher surface, DTO, auth, tenant boundary or replay evidence changes                 |
| Revalidation Command | `npm test -- tests/integration/l1-internal-validation-rehearsal-gate.test.ts`                                                   |
| No-Go Trigger        | Kit used with real users, external customers, Pilot, Production, PostgreSQL runtime, SQL, migration or durable settlement claim |

## Non-Proofs

Completing this kit does not prove Teacher rehearsal approval, `Pilot`, `Production`, PostgreSQL runtime, durable settlement, backup restore, distributed recovery, R4 Macro, R9 or R10.
