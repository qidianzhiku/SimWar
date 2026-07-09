# L1 Known Limits and Internal Release Note

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

本文是内部应用准备说明，不是 `Pilot`、`Production`、PostgreSQL runtime、SQL、migration、durable settlement 或真实教师试跑证明。

## Evidence Package Boundary

```text
INTERNAL_ONLY_DRAFT_NOT_RELEASED
```

本文可进入 synthetic internal application decision package，但该 package 仍是内部草案，不是 `G0 PASS`、`L1 READY`、`Pilot`、`Production` 或 PostgreSQL runtime 授权。

## Internal Release Note

Program 011 将 PR #197 的 R3 runtime boundary 合并到 master 后，建立了 L1 Internal Application Readiness Pack 的 test/docs-only 候选。Program 012 在 PR #198 合并后的 master 上追加 synthetic internal application decision evidence。该候选覆盖 synthetic JSON runtime 下的身份、RBAC、tenant scope、Student projection、Teacher evidence、Tenant Admin status、Platform Admin authority observation、Shared Golden M1、replay non-overwrite、abort/reset 和 internal operator package。

### REL-040 Internal Release Candidate Note

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

Release-candidate status:
R8_G1_INTERNAL_PACK_CREATED_PENDING_AUD_CLOSURE

Next:
SIMWAR-P6-R8G1-AUD-CLOSURE-040B
```

This is an internal-only release candidate for the R8-G1 application pack. It is
not an external release, not a Pilot, not Production, not L1 completed and not a
real teacher rehearsal approval. It only prepares the package for independent
AUD-CLOSURE review.

## Known Limits

| Limit                           | Current statement                                                                |
| ------------------------------- | -------------------------------------------------------------------------------- |
| G0                              | solo-maintainer control is current evidence, but `G0 PASS` remains `NOT_GRANTED` |
| L1                              | current pack is internal readiness evidence, not `L1 READY`                      |
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

## Release Boundary

The pack may support an Owner go/no-go decision for synthetic internal application validation only. It may not be used to approve real teacher rehearsal, Controlled Pilot, Production, PostgreSQL runtime activation, SQL migration, durable settlement, R4 Macro, R9 or R10.

## Abort Rule

If a synthetic session exposes protected truth, private replay metadata, other-tenant data, other-team data, or browser console leakage, the session must stop and preserve evidence. Do not continue by editing runtime, services, routes, schemas, OpenAPI, PostgreSQL, SQL, migrations, package files or lockfiles.

## Issue Relationship

Relates to #111. Relates to #114. Relates to #115.

## REL-040 Evidence Handoff

| Field                | Value                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Evidence Type        | `KNOWN_LIMITS_EVIDENCE / L1_RELEASE_NOTE_EVIDENCE / DOCS_ONLY`                                                     |
| Source SHA           | `6f2ec0283a41eebc9bac49b408ebaba0a97559db`                                                                         |
| Result               | `UPDATED`                                                                                                          |
| Scope of Proof       | Known limits and internal release-candidate note for R8-G1 pack                                                    |
| Explicit Non-Proof   | Not L1 ready, not R8-G1 released, not Pilot, not Production, not PostgreSQL runtime, not durable settlement        |
| Owner                | Marshall                                                                                                           |
| Expiry Trigger       | master SHA, Phase 5 Gate, Phase 6 Entry, product surface, dependency, security policy or known-limit changes       |
| Revalidation Command | `npm run security:audit` and `npm audit --json`                                                                    |
| No-Go Trigger        | Missing known limits, dependency critical risk requiring human decision, or release note implying external release |
