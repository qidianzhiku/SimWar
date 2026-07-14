# L1 Session Runbook Lite

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

本 runbook 只覆盖 JSON runtime 下的 synthetic internal application validation。它不授权 `Pilot`、`Production`、PostgreSQL runtime、SQL、migration、durable settlement 或真实教师试跑。

## Evidence Package Boundary

```text
INTERNAL_ONLY_DRAFT_NOT_RELEASED
```

本 runbook 是 internal-only draft。它支持 synthetic application evidence collection，不授权 `Pilot`、`Production`，也不改变 PostgreSQL runtime `NOT_AUTHORIZED` 边界。

## REL-040 Release-Candidate Binding

```text
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

This runbook is refreshed for a limited R8-G1 internal application pack
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
| evidence form      | `phase6-limited-internal-evidence-capture-template.md` ready             |
| exception          | active and not past `2026-07-21T23:59:59+08:00`                          |

## Happy Path

1. Teacher signs into synthetic environment.
2. Teacher creates or selects the synthetic course/run.
3. Teacher opens round 1.
4. Student submits a valid decision for own team.
5. Teacher locks round 1.
6. The service-kernel-only settlement boundary computes the official JSON runtime result. Do not call the internal settlement route from a frontend.
7. Teacher publishes the result.
8. Student confirms redacted result only.
9. Student reviews three-part feedback and learning report only as
   synthetic/internal evidence.
10. Teacher confirms authorized replay evidence.
11. Tenant Admin confirms current-tenant status or audit surface.
12. Operator records post-session evidence, known limits and expiry triggers.

The operator must not read `runtime.store`, edit the JSON snapshot, call an
internal settlement route from a frontend, or improvise a direct-store fallback.

## Operator Runbook Controls

1. Use only the current product surfaces and controlled service-kernel path.
2. Record role, tenant, run, round, request id and evidence label without private payloads.
3. Stop on the first no-go trigger; do not retry by changing source or configuration.
4. Preserve the official result identity before replay review.
5. Run the synthetic cleanup checklist after evidence capture.
6. Mark every unexecuted step `NOT_RUN`; never infer a pass from documentation.

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
- source SHA and exception-expiry check
- explicit non-proof and no-go disposition

Do not preserve real customer data, secrets, passwords, tokens, payment data or production data.

## Non-Proofs

This runbook does not prove crash recovery, backup restore, distributed recovery, durable retention, `Pilot`, `Production` or PostgreSQL runtime readiness.

## REL-040 Evidence Handoff

| Field                | Value                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Evidence Type        | `PHASE6_LIMITED_PACK_EVIDENCE / DOCS_ONLY`                                                                                      |
| Source SHA           | `695cf955b3c9ab1d96b7fb59ac92671cf82dfdcf`                                                                                      |
| Result               | `PHASE6_PACK_PR_CANDIDATE`                                                                                                      |
| Scope of Proof       | Internal synthetic session runbook and evidence collection path                                                                 |
| Explicit Non-Proof   | Not Phase 7, not operational rehearsal, not Pilot, not Production, not durable recovery                                         |
| Owner                | Marshall                                                                                                                        |
| Expiry Trigger       | 2026-07-21 23:59:59 +08:00 or earlier master, policy, product, auth, tenant, replay, reset or Known Limits change               |
| Revalidation Command | `npm test -- tests/integration/l1-internal-validation-rehearsal-gate.test.ts`                                                   |
| No-Go Trigger        | Student privacy leak, cross-tenant/team leak, replay overwrite, protected marker in DOM/console or forbidden runtime dependency |
