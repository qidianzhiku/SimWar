# L1 Internal-Only Teacher Kit

## Status Boundary

```text
G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

Phase 7:
NOT_AUTHORIZED

Controlled Pilot:
NOT_AUTHORIZED

Production:
NOT_AUTHORIZED

PostgreSQL runtime:
NOT_AUTHORIZED
```

本 Teacher Kit 仅用于 synthetic internal application validation 准备。它不是真实教师试跑批准，不是 `Pilot`，不是 `Production`，不证明 PostgreSQL runtime、SQL、migration 或 durable settlement。

## Evidence Package Boundary

```text
INTERNAL_ONLY_DRAFT_NOT_RELEASED
```

本 Teacher Kit 只能用于 source-locked synthetic internal application pack preparation。它不把任何 local validation、Owner exception 或 PR creation 提升为 `G0 PASS`、`L1 READY`、Phase 7、`Pilot` 或 `Production`。

## REL-040 Release-Candidate Binding

```text
Mission:
SIMWAR-P6-R8G1-REL-040-LIMITED-INTERNAL-PACK

Current master anchor:
695cf955b3c9ab1d96b7fb59ac92671cf82dfdcf

Phase 5 Outcome:
L1_GATE_EXCEPTION_WITH_OWNER_AND_EXPIRY

Phase 6 Entry:
PHASE6_PACK_PR_CANDIDATE

R8-G1 Status:
LIMITED_INTERNAL_PACK_CANDIDATE_UNDER_G0_EXCEPTION

G0 Exception Expiry:
2026-07-21T23:59:59+08:00
```

This Teacher Kit is a limited internal pack candidate under an expiring Owner
exception. It does not release R8-G1, start Phase 7, or authorize a real Teacher
rehearsal, external customer, Pilot, Production, PostgreSQL runtime, SQL,
migration or durable settlement.

## Audience

| Role                  | Allowed use                                             |
| --------------------- | ------------------------------------------------------- |
| Teacher operator      | prepare a synthetic M1 session with cleanable data only |
| Student participant   | use seeded or synthetic student identity only           |
| Tenant Admin observer | inspect current-tenant status only                      |
| Reviewer              | inspect evidence and non-proof boundaries               |
| Internal operator     | apply stop conditions and preserve bounded evidence     |

## Session Scope

Allowed:

- `tenant_demo` or isolated synthetic tenant only.
- One synthetic course/run/round path.
- At least one Student decision submit.
- Teacher lock and publish path, with settlement remaining service-kernel-only.
- Student redacted result review.
- Teacher authorized evidence review.
- Tenant Admin current-tenant status or audit review.
- Existing replay evidence review where current harness supports it.

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

## Session Preparation Checklist

1. Record source SHA `695cf955b3c9ab1d96b7fb59ac92671cf82dfdcf`.
2. Confirm the G0 exception has not expired or been invalidated by an event trigger.
3. Confirm `G0 PASS` remains `NOT_GRANTED`, `L1 Status` remains `NOT_READY`, and Phase 7 remains `NOT_AUTHORIZED`.
4. Confirm every identity and tenant is synthetic and isolated.
5. Confirm JSON runtime is the only active default and no direct-store access is planned.
6. Confirm no PostgreSQL runtime, SQL, migration, backend, frontend, BFF, fixture, package, lockfile or workflow change is needed.
7. Name the abort owner and evidence recorder before any action.
8. Open `docs/operations/phase6-limited-internal-evidence-capture-template.md`.
9. Confirm issue references remain `Relates to #111`, `Relates to #114`, and `Relates to #115` only.

## Teacher Operating Flow

1. Open the Teacher Workspace for the synthetic run.
2. Review course, run and round context before action.
3. Monitor team readiness and decision submission state.
4. Lock the round only through the authorized public Teacher route.
5. Observe the service-kernel-only settlement boundary; the Teacher and frontend
   must not call the internal settlement route or directly mutate
   `SettlementResult`, score, rank, `state_true`, replay artifacts or store state.
6. Review replay summary only after publish and only as authorized Teacher
   evidence.
7. Check Known Limits before any Go / No-Go discussion.
8. Follow the abort, reset and escalation procedures if any boundary fails.
9. Complete the evidence capture template without recording protected payloads.

## Accepted Limits

- G5 remains `PASS_WITH_LIMITS`: there is no dedicated Shadow Replay HTTP route,
  and replay is not backup or durable recovery.
- G6 remains `PASS_WITH_LIMITS`: reset is synthetic in-memory reset only, with no
  crash, cross-process, backup/restore, retention or production cleanup proof.

## Evidence Handoff

| Field                | Value                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Evidence Type        | `PHASE6_LIMITED_PACK_EVIDENCE / DOCS_ONLY`                                                                                      |
| Source SHA           | `695cf955b3c9ab1d96b7fb59ac92671cf82dfdcf`                                                                                      |
| Result               | `PHASE6_PACK_PR_CANDIDATE`                                                                                                      |
| Scope of Proof       | Internal Teacher Kit preparation boundary and operator flow                                                                     |
| Explicit Non-Proof   | Not R8-G1 release, not Phase 7, not L1 validation, not real Teacher rehearsal                                                   |
| Owner                | Marshall                                                                                                                        |
| Expiry Trigger       | 2026-07-21 23:59:59 +08:00 or earlier master, policy, Teacher surface, auth, tenant, replay, reset or Known Limits change       |
| Revalidation Command | `npm test -- tests/integration/l1-internal-validation-rehearsal-gate.test.ts`                                                   |
| No-Go Trigger        | Kit used with real users, external customers, Pilot, Production, PostgreSQL runtime, SQL, migration or durable settlement claim |

## Non-Proofs

Completing this kit does not prove Teacher rehearsal approval, Phase 7 authorization, `Pilot`, `Production`, PostgreSQL runtime, durable settlement, backup restore, distributed recovery, R4 Macro, R9 or R10.
