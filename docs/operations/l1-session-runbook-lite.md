# L1 Session Runbook Lite

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

本 runbook 只覆盖 JSON runtime 下的 synthetic internal application validation。它不授权 `Pilot`、`Production`、PostgreSQL runtime、SQL、migration、durable settlement 或真实教师试跑。

## Evidence Package Boundary

```text
INTERNAL_ONLY_DRAFT_NOT_RELEASED
```

本 runbook 是 internal-only draft。它支持 synthetic application evidence collection，不授权 `Pilot`、`Production`，也不改变 PostgreSQL runtime `NOT_AUTHORIZED` 边界。

## REL-040 Release-Candidate Binding

```text
Current master anchor:
6f2ec0283a41eebc9bac49b408ebaba0a97559db

Phase 5 Gate:
L1_GATE_READY_FOR_R8_G1_INTERNAL_PACK

Phase 6 Entry:
PHASE6_ENTRY_READY_WITH_LIMITS_FOR_R8_G1_REL

R8-G1 Status:
RELEASE_CANDIDATE_PENDING_CLOSURE
```

This runbook is refreshed for the R8-G1 internal application pack release
candidate. It remains synthetic-only, JSON-runtime-only and internal-only.

## Preflight

| Check              | Required state                                                           |
| ------------------ | ------------------------------------------------------------------------ |
| data               | synthetic or cleanable only                                              |
| runtime            | JSON runtime only                                                        |
| PostgreSQL runtime | `NOT_AUTHORIZED`                                                         |
| issues             | #111 / #114 / #115 remain open unless separately disposed                |
| branch             | no protected main workspace use                                          |
| scope              | no runtime, service, route, schema, OpenAPI, database or lockfile change |

## Happy Path

1. Teacher signs into synthetic environment.
2. Teacher creates or selects the synthetic course/run.
3. Teacher opens round 1.
4. Student submits a valid decision for own team.
5. Teacher locks round 1.
6. Existing settlement path computes official JSON runtime result.
7. Teacher publishes the result.
8. Student confirms redacted result only.
9. Student reviews three-part feedback and learning report only as
   synthetic/internal evidence.
10. Teacher confirms authorized replay evidence.
11. Tenant Admin confirms current-tenant status or audit surface.
12. Operator records post-session evidence, known limits and expiry triggers.

## Abort Points

Abort immediately if:

- Student sees `state_true`, private replay metadata, other tenant data, other team data or private digests.
- Tenant Admin sees platform or other-tenant data.
- replay evidence overwrites official result.
- controlled failure leaks protected sentinel or private input.
- session requires PostgreSQL runtime, SQL, migration, service change, route change, schema change or lockfile change.
- protected marker appears in DOM or browser console.
- real teacher rehearsal, external customer, Pilot or Production pressure appears.
- workflow, dependency or supply-chain drift requires a human decision.

## Evidence Preservation

Preserve:

- command name and exit code
- request id or stable error code
- role identity
- tenant id
- run id and round number
- replay hash or statement that replay evidence was not created
- known limit classification

Do not preserve real customer data, secrets, passwords, tokens, payment data or production data.

## Non-Proofs

This runbook does not prove crash recovery, backup restore, distributed recovery, durable retention, `Pilot`, `Production` or PostgreSQL runtime readiness.

## REL-040 Evidence Handoff

| Field                | Value                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Evidence Type        | `R8_G1_REL_CANDIDATE_EVIDENCE / DOCS_ONLY`                                                                                      |
| Source SHA           | `6f2ec0283a41eebc9bac49b408ebaba0a97559db`                                                                                      |
| Result               | `UPDATED`                                                                                                                       |
| Scope of Proof       | Internal synthetic session runbook and evidence collection path                                                                 |
| Explicit Non-Proof   | Not operational rehearsal, not Pilot, not Production, not durable recovery                                                      |
| Owner                | Marshall                                                                                                                        |
| Expiry Trigger       | master SHA, product surface, DTO, auth, tenant boundary, replay or known-limit changes                                          |
| Revalidation Command | `npm test -- tests/integration/l1-internal-validation-rehearsal-gate.test.ts`                                                   |
| No-Go Trigger        | Student privacy leak, cross-tenant/team leak, replay overwrite, protected marker in DOM/console or forbidden runtime dependency |
