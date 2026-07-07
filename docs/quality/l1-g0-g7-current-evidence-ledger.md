# L1 G0-G7 Current Evidence Ledger

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

本文是 `SIMWAR_G0_SOLO_MAINTAINER_CONSOLIDATION_PR197_R3_CLOSEOUT_TO_L1_G0_G7_R8_G1_PROGRAM_011` 的 current evidence ledger。它只记录 synthetic JSON runtime、integration、browser smoke、source-only 和 documentation evidence。它不代表 `Pilot`、`Production`、PostgreSQL runtime、SQL、migration、durable settlement、R4 Macro、R9 或 R10 ready。

## Evidence Label Rules

| Label | Meaning |
|---|---|
| `CURRENT_GITHUB_READBACK` | GitHub current readback, including branch protection, PR, checks, issue state |
| `CURRENT_REMOTE_GIT_READBACK` | remote Git ref readback |
| `CURRENT_LOCAL_RUN` | local command result from isolated clone |
| `INTEGRATION_TEST_EVIDENCE` | Vitest integration response / repository-state assertion |
| `E2E_BROWSER` | Playwright browser smoke evidence |
| `SOURCE_ONLY_INFERENCE` | source inspection only, not runtime proof |
| `NOT_IMPLEMENTED` | surface not present in current runtime |
| `UNKNOWN` | evidence not sufficient |

## G0-G7 Ledger

| Gate | Capability | Current evidence | Evidence label | Current status |
|---|---|---|---|---|
| G0 | solo-maintainer control, PR checks, force-push/deletion denial | PR #197 current readback, branch protection readback, no ruleset conflict observed | `CURRENT_GITHUB_READBACK` | `EXCEPTION / CONTROL_POLICY_VERIFIABLE` |
| G1 | identity and runtime configuration boundary | `r3-runtime-boundary.test.ts`; seeded demo login rejected in shared runtime config | `INTEGRATION_TEST_EVIDENCE` | `PARTIAL_PASS_SYNTHETIC` |
| G2 | RBAC, tenant, team, platform authority | R3 and L1 readiness integration tests | `INTEGRATION_TEST_EVIDENCE` | `PARTIAL_PASS_SYNTHETIC` |
| G3 | projection and reachable surfaces | Student result, structured error, free-text error, Teacher result, Tenant Admin status, browser smoke | `INTEGRATION_TEST_EVIDENCE / E2E_BROWSER` | `PARTIAL_PASS_SYNTHETIC` |
| G4 | Shared Golden M1 main flow | `l1-shared-golden-m1-scenario.test.ts` | `INTEGRATION_TEST_EVIDENCE` | `PARTIAL_PASS_SYNTHETIC` |
| G5 | replay evidence and official-result non-overwrite | Shared Golden M1 and R3 replay evidence assertions | `INTEGRATION_TEST_EVIDENCE` | `PARTIAL_PASS_SYNTHETIC` |
| G6 | abort, reset, recovery, cleanup | `l1-session-abort-reset-recovery.test.ts`; in-memory reset only | `INTEGRATION_TEST_EVIDENCE` | `INTERNAL_SYNTHETIC_ONLY` |
| G7 | internal operator pack | Teacher Kit, runbook, reset/abort procedure, replay checklist, issue escalation | `CURRENT_LOCAL_READ_ONLY` | `DRAFT_INTERNAL_ONLY` |

## Reachable Surface Matrix

| Surface | Current classification | Evidence |
|---|---|---|
| result envelope | `REACHABLE_AND_TESTED` | Student redaction and Teacher evidence tests |
| structured error envelope | `REACHABLE_AND_TESTED` | `TRUTH-403-001`, `TENANT-403-001` tests |
| free-text error | `REACHABLE_AND_TESTED` | R3 free-text sentinel test |
| replay artifact | `REACHABLE_AND_TESTED` | Teacher/Tenant Admin authorized replay evidence; Student denied |
| audit/status surface | `REACHABLE_AND_TESTED` | Tenant Admin audit/status scope tests |
| Teacher UI | `REACHABLE_AND_TESTED` | Playwright teacher publish smoke |
| Student UI | `REACHABLE_AND_TESTED` | Playwright student redaction smoke |
| Tenant Admin UI | `REACHABLE_AND_TESTED` | Playwright admin current-tenant smoke |
| browser console | `REACHABLE_AND_TESTED` | L1 browser smoke checks forbidden markers |
| server log | `NOT_IMPLEMENTED` | no structured runtime log export in current app |
| telemetry | `NOT_IMPLEMENTED` | no telemetry adapter in current app |
| export | `NOT_IMPLEMENTED` | no result export adapter in current app |

`NOT_IMPLEMENTED` surfaces are not counted as safe runtime proof. They remain future evidence gaps if implemented.

## Non-Proofs

This ledger does not prove `G0 PASS`, `L1 READY`, real Teacher rehearsal, `Pilot`, `Production`, PostgreSQL runtime, SQL, migration, durable settlement, backup restore, distributed recovery, R4 Macro, R9, or R10.

## Issue Relationship

Relates to #111. Relates to #114. Relates to #115.
