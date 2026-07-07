# L1 Synthetic Application Decision Evidence

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

## Evidence Package Boundary

```text
INTERNAL_ONLY_DRAFT_NOT_RELEASED
```

本文记录 PR #198 合并之后的 synthetic internal application decision evidence。它不是 `G0 PASS`，不是 `L1 READY`，不授权 `Pilot`、`Production`、PostgreSQL runtime、SQL、migration、durable settlement、真实教师试跑、真实用户、真实 tenant 或真实支付。

## Purpose

本文用于把 G0 control evidence、post-merge baseline、G1-G7 synthetic coverage、operator pack、known limits 和 Owner Go/No-Go decision 输入收束到同一份内部证据。它支持 Marshall 后续判断是否进入 synthetic internal application validation，但不自动启动该 validation。

## Current Source Baseline

| Item                      | Current evidence                                                                              | Evidence label                |
| ------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------- |
| PR #198                   | ordinary merge completed                                                                      | `CURRENT_GITHUB_READBACK`     |
| PR #198 merge commit      | `ee1abb51ba9edf52faf1d0b0a00e3d080a96747c`                                                    | `CURRENT_REMOTE_GIT_READBACK` |
| master after merge        | `ee1abb51ba9edf52faf1d0b0a00e3d080a96747c`                                                    | `CURRENT_REMOTE_GIT_READBACK` |
| post-merge baseline clone | fresh detached clone, clean worktree                                                          | `CURRENT_LOCAL_RUN`           |
| post-merge validation     | targeted integrations, contract validation, typecheck, full test, build, lint, browser smoke  | `CURRENT_LOCAL_RUN`           |
| supply-chain audit        | `npm audit --json` reports 5 non-critical findings in tooling/development dependency surfaces | `CURRENT_LOCAL_RUN`           |

## Synthetic Internal Exercise Scope

The synthetic exercise is limited to JSON runtime and synthetic seeded data.

| Scenario element              | Required coverage                                                                      | Evidence                                    |
| ----------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------- |
| tenant                        | `tenant_demo` only, with cross-tenant denial                                           | integration test                            |
| Teacher                       | creates run, opens round, locks, settles, publishes                                    | integration and browser tests               |
| Student                       | submits own team decision and sees redacted result                                     | integration and browser tests               |
| Tenant Admin                  | sees current-tenant status/admin surface only                                          | integration and browser tests               |
| Platform Admin                | observed only to confirm explicit platform authority is not confused with Tenant Admin | integration test                            |
| course/team/run/round         | one course, at least two teams, one run, one round                                     | integration test                            |
| settlement                    | existing system settlement path only                                                   | integration test                            |
| replay evidence               | generated from frozen synthetic input                                                  | integration test                            |
| official result non-overwrite | replay helper and repeated settlement leave formal result unchanged                    | integration test                            |
| controlled failure            | truth-field injection and cross-team/cross-tenant attempts fail without protected leak | integration test                            |
| reset/abort boundary          | in-memory synthetic reset only                                                         | existing Program 011 test plus this package |

## G0-G7 Current Decision Evidence

| Gate | Current evidence                                                                                   | Current classification                  | Evidence label                                      |
| ---- | -------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------- |
| G0   | solo-maintainer control policy, required checks, ordinary merge discipline, no bypass semantics    | `EXCEPTION / CONTROL_POLICY_VERIFIABLE` | `CURRENT_GITHUB_READBACK / CURRENT_LOCAL_READ_ONLY` |
| G1   | runtime configuration rejects unsafe shared demo defaults and preserves JSON runtime boundary      | `PARTIAL_PASS_SYNTHETIC`                | `INTEGRATION_TEST_EVIDENCE`                         |
| G2   | RBAC, tenant scope, team scope and platform authority are exercised on synthetic identities        | `PARTIAL_PASS_SYNTHETIC`                | `INTEGRATION_TEST_EVIDENCE`                         |
| G3   | Student, Teacher, Tenant Admin and browser surfaces are tested for projection boundaries           | `PARTIAL_PASS_SYNTHETIC`                | `INTEGRATION_TEST_EVIDENCE / E2E_BROWSER`           |
| G4   | Shared Golden M1 and synthetic application decision main flow both execute on current JSON runtime | `PARTIAL_PASS_SYNTHETIC`                | `INTEGRATION_TEST_EVIDENCE`                         |
| G5   | replay evidence is produced and official result is not overwritten                                 | `PARTIAL_PASS_SYNTHETIC`                | `INTEGRATION_TEST_EVIDENCE`                         |
| G6   | controlled abort and in-memory reset boundaries are documented and tested                          | `INTERNAL_SYNTHETIC_ONLY`               | `INTEGRATION_TEST_EVIDENCE`                         |
| G7   | teacher kit, runbook, reset/abort, replay checklist, issue escalation and known limits are aligned | `DRAFT_INTERNAL_ONLY`                   | `CURRENT_LOCAL_READ_ONLY`                           |

## Student Visibility Boundary

Student-facing result and browser surfaces must not contain:

```text
state_true
replay_evidence
ReplayManifest
replay_manifest
manifest_hash
decision_batch_hash
json_runtime_source_digest
canonical_evidence_digest
Teacher private metadata
Tenant Admin private metadata
other tenant data
other team data
```

This is still a synthetic evidence claim only. It does not prove every future export, telemetry, server log, report, AI, plugin, billing, entitlement or production UI surface.

## Teacher Evidence Boundary

Teacher can read authorized result and replay evidence for the synthetic run after publish. Teacher evidence remains a review surface, not a truth writer. Teacher evidence does not authorize replay overwrite, durable settlement, SQL migration, PostgreSQL runtime or production release.

## Tenant Admin Boundary

Tenant Admin can read current-tenant status or admin surface only. Tenant Admin must not receive platform authority, other tenant records or other tenant user identities. Platform Admin evidence is only used to distinguish explicit platform authority from tenant-scoped administration.

## Replay and Official Result Non-Overwrite Boundary

The synthetic exercise asserts:

- replay evidence is created from frozen synthetic inputs
- `replay_status = matched`
- `replay_writes_formal_results = false`
- official settlement snapshots remain unchanged after replay evidence construction
- repeated settlement returns the same formal result hash without creating a divergent result

This is not a complete replay / shadow replay rehearsal and does not prove durable settlement, backup restore, distributed recovery or PostgreSQL runtime behavior.

## Controlled Failure and Abort Boundary

The exercise includes controlled failures for:

- protected truth injection returning `TRUTH-403-001`
- cross-team write returning `TEAM-403-001`
- cross-tenant read returning `TENANT-403-001`

The required response property is no protected sentinel, private replay metadata, other tenant data or other team data in the error envelope. If this fails, the session must stop and preserve evidence.

## Operator Package Consistency

The following documents carry the shared `INTERNAL_ONLY_DRAFT_NOT_RELEASED` marker and the same status boundary:

- `docs/governance/g0-solo-maintainer-control-policy.md`
- `docs/quality/l1-g0-g7-current-evidence-ledger.md`
- `docs/quality/l1-known-limits-and-release-note.md`
- `docs/operations/l1-teacher-kit-internal-only.md`
- `docs/operations/l1-session-runbook-lite.md`
- `docs/operations/l1-synthetic-data-reset-and-abort.md`
- `docs/operations/l1-replay-evidence-review-checklist.md`
- `docs/operations/l1-issue-escalation-procedure.md`
- `docs/architecture/r4-discovery-parity-gap-directory.md`

## Non-Proofs

This evidence package does not prove:

- `G0 PASS`
- `L1 READY`
- Controlled Pilot readiness
- Production readiness
- PostgreSQL runtime readiness
- SQL migration readiness
- durable settlement
- backup restore
- distributed recovery
- R4 Macro
- R9
- R10
- real teacher rehearsal
- real customer data handling
- real payment, billing or entitlement

## Owner Go / No-Go Decision Package

```text
Decision:
SIMWAR_L1_SYNTHETIC_INTERNAL_APPLICATION_GO_NO_GO_DECISION_001

Decision Owner:
Marshall

Decision Status:
PENDING_OWNER_SIGNATURE

Repository:
qidianzhiku/SimWar

Current Evidence Commit:
<current L1 synthetic evidence PR head after independent review>

G0 Status:
EXCEPTION

G0 PASS Status:
NOT_GRANTED

L1 Status:
NOT_READY

Evidence Package:
INTERNAL_ONLY_DRAFT_NOT_RELEASED

Owner Choice:
A. Authorize one synthetic internal application validation session.

B. Hold at evidence package stage.

C. Require separate remediation for a named evidence gap before any internal validation.

Explicitly Forbidden:
G0 PASS
L1 READY
Pilot
Production
PostgreSQL runtime
SQL
migration
durable settlement
R4 Macro
R9
R10
#111 / #114 / #115 closeout

Implementation Authorization:
NO

Repository Mutation Authorization:
NO

GitHub Mutation Authorization:
NO

Owner Signature:
<Marshall explicitly signs>

Signature Date:
<fill date>
```

## Issue Relationship

Relates to #111. Relates to #114. Relates to #115.
