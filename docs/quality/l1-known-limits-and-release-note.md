# L1 Known Limits and Internal Release Note

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

本文是内部应用准备说明，不是 `Pilot`、`Production`、PostgreSQL runtime、SQL、migration、durable settlement 或真实教师试跑证明。

## Evidence Package Boundary

```text
INTERNAL_ONLY_DRAFT_NOT_RELEASED
```

本文可进入 synthetic internal application decision package，但该 package 仍是内部草案，不是 `G0 PASS`、`L1 READY`、`Pilot`、`Production` 或 PostgreSQL runtime 授权。

## Internal Release Note

Program 011 将 PR #197 的 R3 runtime boundary 合并到 master 后，建立了 L1 Internal Application Readiness Pack 的 test/docs-only 候选。Program 012 在 PR #198 合并后的 master 上追加 synthetic internal application decision evidence。该候选覆盖 synthetic JSON runtime 下的身份、RBAC、tenant scope、Student projection、Teacher evidence、Tenant Admin status、Platform Admin authority observation、Shared Golden M1、replay non-overwrite、abort/reset 和 internal operator package。

### Limited Phase 6 Internal Pack Candidate Note

```text
Mission:
SIMWAR-P6-R8G1-REL-040-LIMITED-INTERNAL-PACK

Current master anchor:
695cf955b3c9ab1d96b7fb59ac92671cf82dfdcf

Current mainline anchor:
PR #232 merged

Phase 5 Outcome:
L1_GATE_EXCEPTION_WITH_OWNER_AND_EXPIRY

Phase 6 Entry:
PHASE6_PACK_PR_CANDIDATE

Release-candidate status:
LIMITED_INTERNAL_PACK_CANDIDATE_UNDER_G0_EXCEPTION

G0 Exception Expiry:
2026-07-21T23:59:59+08:00

Postmerge requirement:
POSTMERGE_PHASE6_CLOSURE_REQUIRED
```

This is a limited internal-only pack candidate under an expiring G0 exception.
It is not an external release, not Phase 7, not a Pilot, not Production, not L1
completed and not a real Teacher rehearsal approval. A future exact-head review,
merge authorization and postmerge Phase 6 closure remain separate decisions.

## Known Limits

| Limit                           | Current statement                                                                |
| ------------------------------- | -------------------------------------------------------------------------------- |
| G0                              | solo-maintainer control is current evidence, but `G0 PASS` remains `NOT_GRANTED` |
| L1                              | current pack is internal readiness evidence, not `L1 READY`                      |
| Phase 7                         | `NOT_AUTHORIZED`                                                                 |
| runtime                         | JSON runtime only                                                                |
| PostgreSQL runtime              | `NOT_AUTHORIZED`                                                                 |
| SQL / migration                 | `NOT_AUTHORIZED`                                                                 |
| durable settlement              | not proven                                                                       |
| crash recovery                  | not proven                                                                       |
| backup restore                  | not proven                                                                       |
| distributed recovery            | not proven                                                                       |
| telemetry redaction             | surface not implemented                                                          |
| export redaction                | surface not implemented                                                          |
| real teacher rehearsal          | not run                                                                          |
| real users or customer data     | prohibited                                                                       |
| payment / billing / entitlement | not authorized                                                                   |
| Pilot                           | not authorized                                                                   |
| Production                      | not authorized                                                                   |
| browser smoke                   | not a full UI security audit                                                     |
| security audit                  | not a complete security proof                                                    |
| Replay evidence                 | not durable recovery or backup restore proof                                     |
| Shadow Replay HTTP route        | no dedicated route proof                                                         |
| reset / cleanup                 | synthetic in-memory only; no production cleanup proof                            |
| G0 exception                    | expires no later than `2026-07-21T23:59:59+08:00` and may expire earlier         |

## Release Boundary

The pack may support an independent exact-head review of a synthetic internal pack candidate only. It may not be used to approve Phase 7, real Teacher rehearsal, Controlled Pilot, Production, PostgreSQL runtime activation, SQL migration, durable settlement, R4 Macro, R9 or R10.

## Abort Rule

If a synthetic session exposes protected truth, private replay metadata, other-tenant data, other-team data, or browser console leakage, the session must stop and preserve evidence. Do not continue by editing runtime, services, routes, schemas, OpenAPI, PostgreSQL, SQL, migrations, package files or lockfiles.

## Issue Relationship

Relates to #111. Relates to #114. Relates to #115.

## Phase 6 Limited Pack Evidence Handoff

| Field                | Value                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Evidence Type        | `KNOWN_LIMITS_EVIDENCE / PHASE6_LIMITED_PACK_EVIDENCE / DOCS_ONLY`                                                 |
| Source SHA           | `695cf955b3c9ab1d96b7fb59ac92671cf82dfdcf`                                                                         |
| Result               | `PHASE6_PACK_PR_CANDIDATE`                                                                                         |
| Scope of Proof       | Known limits, exception notice and internal candidate note for the limited R8-G1 pack                              |
| Explicit Non-Proof   | Not Phase 7, not L1 ready, not R8-G1 released, not Pilot, not Production, not PostgreSQL runtime or durable proof  |
| Owner                | Marshall                                                                                                           |
| Expiry Trigger       | 2026-07-21 23:59:59 +08:00 or earlier source, policy, product, dependency, replay, reset or Known Limits change    |
| Revalidation Command | `npm run security:audit` and `npm audit --json`                                                                    |
| No-Go Trigger        | Missing known limits, dependency critical risk requiring human decision, or release note implying external release |
