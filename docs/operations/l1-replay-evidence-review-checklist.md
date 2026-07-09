# L1 Replay Evidence Review Checklist

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

本 checklist 用于 synthetic internal review。它不授权 `Pilot`、`Production`、PostgreSQL runtime、SQL、migration 或 durable settlement。

## Evidence Package Boundary

```text
INTERNAL_ONLY_DRAFT_NOT_RELEASED
```

本 checklist 是 internal-only draft evidence checklist。它不把 replay evidence、browser evidence 或 local tests 表述为 `G0 PASS`、`L1 READY`、`Pilot`、`Production` 或 PostgreSQL runtime readiness。

## REL-040 Release-Candidate Binding

```text
Current master anchor:
6f2ec0283a41eebc9bac49b408ebaba0a97559db

Phase 5 Gate:
L1_GATE_READY_FOR_R8_G1_INTERNAL_PACK

Phase 6 Entry:
PHASE6_ENTRY_READY_WITH_LIMITS_FOR_R8_G1_REL
```

This checklist is refreshed for the R8-G1 internal application pack release
candidate. It remains a review checklist only and is not durable recovery proof.

## Checklist

| Question                                                         | Expected evidence                                                                  |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Was replay evidence created from frozen synthetic input?         | `replay_status = matched`                                                          |
| Did replay evidence write formal result?                         | `replay_writes_formal_results = false`                                             |
| Did official result remain unchanged?                            | settlement and round snapshots unchanged                                           |
| Can Student read private replay evidence?                        | no `replay_evidence` in Student result                                             |
| Can Teacher read authorized replay evidence?                     | Teacher result includes public replay evidence                                     |
| Can Tenant Admin read only current-tenant replay/status surface? | no `tenant_other` in result/status                                                 |
| Is `replay_hash` treated as truth proof?                         | no, it is a result/reference hash                                                  |
| Is `manifest_hash` treated as truth proof?                       | no                                                                                 |
| Is `canonical_evidence_digest` treated as truth proof?           | no                                                                                 |
| Is `truth_hash` implemented?                                     | `NOT_IMPLEMENTED / FUTURE_RESERVED`                                                |
| Is historical result non-overwrite preserved?                    | yes, no formal result overwrite                                                    |
| Is shadow replay non-overwrite preserved?                        | yes where current harness supports it; no dedicated shadow replay HTTP route proof |
| Is replay evidence tied to a source SHA?                         | `6f2ec0283a41eebc9bac49b408ebaba0a97559db`                                         |

## Private Markers Forbidden to Student

- `state_true`
- `ReplayManifest`
- `replay_manifest`
- `decision_batch_hash`
- `json_runtime_source_digest`
- `canonical_evidence_digest`
- Teacher metadata
- Tenant Admin metadata
- private replay metadata
- other tenant data
- other team data

## Non-Proofs

This checklist does not prove durable replay, backup restore, `Pilot`, `Production`, PostgreSQL runtime, SQL migration, R4 Macro, R9 or R10.

## REL-040 Evidence Handoff

| Field                | Value                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Evidence Type        | `REPLAY_REVIEW_EVIDENCE / DOCS_ONLY`                                                                                                       |
| Source SHA           | `6f2ec0283a41eebc9bac49b408ebaba0a97559db`                                                                                                 |
| Result               | `UPDATED`                                                                                                                                  |
| Scope of Proof       | Replay evidence review checklist and Student forbidden marker boundary                                                                     |
| Explicit Non-Proof   | Not durable replay, not backup restore, not production replay guarantee                                                                    |
| Owner                | Marshall                                                                                                                                   |
| Expiry Trigger       | master SHA, replay route, replay evidence, DTO projection, Student visibility or hash semantics changes                                    |
| Revalidation Command | `npm test -- tests/integration/m1-run-manifest-replay-evidence.test.ts tests/integration/l1-internal-validation-rehearsal-gate.test.ts`    |
| No-Go Trigger        | Student sees private replay, replay writes formal result, official result overwritten, replay hash semantics changed without authorization |
