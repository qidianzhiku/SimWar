# L1 Shared Golden M1 Scenario Readiness Guard

## 文档目的与非目标

本文记录 `l1-shared-golden-m1-scenario.test.ts` 的 post-merge formalization 证据边界。该 Guard 用一个 synthetic、isolated、local integration M1 场景，把 R2 truth authority、R6 replay / visibility artifact semantics、R3 tenant / role boundary、R5 teaching loop 收束为同一个可复核的测试与 fixture package。

本 Guard 不是 `G0 PASS`，不是 `L1 READY`，不是 Pilot 或 Production readiness，不证明 PostgreSQL runtime，不证明 durable settlement，不实现 `truth_hash`，不改变 `SettlementResult`、`state_true` authority、`replay_hash`、`manifest_hash` 或 `canonical_evidence_digest` 语义。

## G0 与 Post-Merge 边界

当前状态必须保持：

```text
G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY
```

PR #195 已进入 master 后，本 Guard 只表示 Shared Golden M1 的 test-only / fixture-only / readiness-document-only formalization。它不替代 G0 readback，不替代 independent evidence review，不替代 Pilot / Production readiness，也不授予 L1 READY。

## Synthetic Scenario 身份与资源模型

| 资源 | Synthetic identity | 证据边界 |
|---|---|---|
| Tenant | `tenant_demo` | current JSON active runtime |
| Teacher | `teacher` | authorized course/run/round/result evidence |
| Student | `student` | own-team redacted result only |
| Tenant Admin | `admin` | current tenant status / audit surface |
| Course | `course_demo` | existing fixture-backed course |
| Teams | `team_alpha` + generated beta team | real API-created second team |
| Run / Round | generated run + round 1 | real HTTP integration path |

## Flow 顺序

1. Tenant Admin creates a beta learner through `POST /api/v1/admin/users`.
2. Teacher creates a beta team through `POST /api/v1/courses/course_demo/teams`.
3. Teacher creates a run and starts round 1.
4. Student controlled failure attempts truth-protected payload.
5. Alpha and beta students submit one decision each.
6. Teacher locks the round.
7. Teacher runs existing settlement path.
8. Teacher publishes the round.
9. Student reads redacted result.
10. Teacher reads approved evidence.
11. Tenant Admin reads tenant-scoped result/status.
12. Replay evidence is generated and verified not to overwrite formal result.

## Truth Authority Matrix

| Artifact | Authority | Guard assertion | Evidence |
|---|---|---|---|
| Core Simulation Engine L1-L3 | formal truth writer | settlement path creates `SettlementResult` | INTEGRATION_TEST_EVIDENCE |
| `SettlementResult` | core settlement path | shape unchanged | SOURCE_ONLY_INFERENCE |
| `state_true` | core result only | Student cannot read it | INTEGRATION_TEST_EVIDENCE |
| Score / Rank | core settlement path | exposed to Student only through `state_obs` | INTEGRATION_TEST_EVIDENCE |
| ParameterSet | bound run input | no hot replacement | SOURCE_ONLY_INFERENCE |
| official result | formal settlement store | shadow replay does not write it | INTEGRATION_TEST_EVIDENCE |
| Replay / shadow replay | evidence only | `replay_writes_formal_results=false` | INTEGRATION_TEST_EVIDENCE |
| AI / Plugin / Billing / Payment / Entitlement | no truth authority | must not write formal truth | SOURCE_ONLY_INFERENCE |

## Artifact Semantics Matrix

| Artifact | Semantics | Explicit non-proof |
|---|---|---|
| `truth_hash` | NOT_IMPLEMENTED / FUTURE_RESERVED | not implemented by this Guard |
| `replay_hash` | result/reference hash | not a truth proof |
| `manifest_hash` | replay evidence identity | not a truth proof |
| `canonical_evidence_digest` | integrity metadata | not a truth proof |
| `decision_batch_hash` | replay frozen-input metadata | not visible to Student |
| `json_runtime_source_digest` | runtime-source evidence metadata | not visible to Student |
| `ReplayManifest` | full replay input manifest | not visible to Student |

## Visibility Contract Matrix

| Role | Surface | Allowed | Forbidden |
|---|---|---|---|
| Student | result envelope | own-team `state_obs`, `state_est`, `replay_hash` | `state_true`, `replay_evidence`, private replay metadata, other team data |
| Teacher | result envelope | classroom results and public replay evidence | cross-tenant data |
| Tenant Admin | result/status/audit surface | current tenant data | `tenant_other`, other tenant users |
| Platform Admin | not exercised | future governance surface | not proven |
| Internal Core | settlement path | formal result write | public visibility authority |

## Audit Correlation Matrix

| Action | Surface | Guard evidence |
|---|---|---|
| user create | admin API + audit append | INTEGRATION_TEST_EVIDENCE |
| team create | course team API + audit append | INTEGRATION_TEST_EVIDENCE |
| decision submit | decision API + audit append | INTEGRATION_TEST_EVIDENCE |
| round publish | publish API + audit append | INTEGRATION_TEST_EVIDENCE |
| tenant admin status | `/api/v1/demo-state` | INTEGRATION_TEST_EVIDENCE |

## L1 G0-G7 Evidence Matrix

| Gate | Capability | Evidence status | No-Go |
|---|---|---|---|
| G0 | PR #195 governance | EXCEPTION | merge success is not G0 PASS |
| G1 | JSON runtime boundary | local integration evidence | not PostgreSQL proof |
| G2 | Teacher / Student / Tenant Admin roles | integration evidence | no UI proof |
| G3 | visibility and failure safety | integration evidence | no telemetry/export proof |
| G4 | M1 main flow | integration evidence | not L1 READY |
| G5 | replay evidence non-overwrite | integration evidence | not durable replay |
| G6 | cleanup / retention boundary | memory server lifecycle + known limits | not backup/restore proof |
| G7 | operator readiness document | this document | not independent review |

## Cleanup、Retention 与 Recovery Known Limits

本 Guard 使用 in-memory test server。`stopServer` 结束 synthetic scenario，未写入真实 tenant、真实用户、真实课程、真实支付或 production data。该 cleanup 不证明 cloud restore、backup retention、multi-team restore、distributed recovery 或 durable settlement。

## 本 Guard 已证明的内容

- Existing real HTTP integration path can create a two-team M1 synthetic scenario.
- Student success projection excludes protected truth and private replay evidence.
- Controlled truth-protected failure does not echo protected values.
- Teacher can read authorized public replay evidence.
- Tenant Admin is scoped to current tenant status/result surface.
- Shadow replay evidence generation does not overwrite formal result in the JSON runtime test harness.

## 本 Guard 未证明的内容

- `G0 PASS`
- `L1 READY`
- PostgreSQL runtime
- durable settlement
- `truth_hash`
- Pilot readiness
- Production readiness
- UI projection, export adapter, telemetry adapter, server log redaction
- full recovery, backup, retention, or multi-team restore verification

## 本地验证命令

```powershell
npm test -- tests/integration/l1-shared-golden-m1-scenario.test.ts
npm test -- tests/integration/p0-flow.test.ts
npm test -- tests/integration/m1-teaching-loop.test.ts
npm test -- tests/integration/decision-submit-characterization.test.ts
npm test -- tests/integration/m1-run-manifest-replay-evidence.test.ts
npm run test:contract
npm run typecheck
npm test
npm run build
npm run lint
```

## 与 #111、#114、#115 的关系

Relates to #111: this Guard exercises settlement idempotency and replay non-overwrite at scenario level.

Relates to #114: this Guard does not remediate direct-store bypasses and expects `Direct-store delta: NONE`.

Relates to #115: this Guard reinforces schema/fixture/runtime projection parity without modifying schemas or OpenAPI.
