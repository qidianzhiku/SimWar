# R3 Runtime Boundary Evidence and R4 Discovery Directory

## 文档目的

本文记录 `SIMWAR_PR196_FORMALIZATION_AND_R3_RUNTIME_BOUNDARY_CLOSURE_PROGRAM_010` 中新增 R3 Runtime Boundary Guard 的证据边界、R4 Discovery 只读目录和非证明项。

当前状态必须保持：

```text
G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY
```

本文不是 `G0 PASS`，不是 `L1 READY`，不是 Pilot 或 Production readiness，不证明 PostgreSQL runtime，不证明 durable settlement，不授权 R4 Macro、R9、R10、SQL、migration 或 ProviderSelector PostgreSQL mode。

## R3 Exact File Manifest

| 文件路径 | 风险域 | 修改原因 | R3 assertion | 测试 | Runtime code | UI code | Docs-only | 授权域 |
|---|---|---|---|---|---|---|---|---|
| `services/api/src/server.ts` | auth / tenant boundary | shared runtime 禁止 seeded demo login；tenant admin 对 body `tenant_id` 跨租户写入必须显式拒绝 | non-demo fail-fast、cross-tenant write denial | `tests/integration/r3-runtime-boundary.test.ts` | YES | NO | NO | YES |
| `tests/integration/r3-runtime-boundary.test.ts` | integration evidence | 汇总 runtime security、tenant binding、RBAC、Student projection、error projection、replay non-overwrite | R3 runtime boundary matrix | targeted integration test | NO | NO | NO | YES |
| `playwright.config.ts` | browser harness | 使用既有 Playwright 依赖和 webServer harness 启动 admin UI | Tenant Admin browser smoke | `npm run test:e2e:ui` | NO | YES | NO | YES |
| `tests/e2e-ui/student-smoke.spec.ts` | browser evidence | 在现有 smoke 中加入 Tenant Admin current-tenant UI scope | Tenant Admin UI projection | `npm run test:e2e:ui` | NO | YES | NO | YES |
| `docs/quality/r3-runtime-boundary-evidence.md` | evidence document | 记录 R3/R4 证据、限制和 handoff | evidence package | review artifact | NO | NO | YES | YES |

禁止触碰的相邻文件包括 `SettlementResult` shape、`state_true` authority、`truth_hash`、`replay_hash` semantics、`manifest_hash` semantics、`canonical_evidence_digest` semantics、`contracts/schemas/`、`contracts/openapi/`、PostgreSQL adapter、SQL、migration、workflow、package 和 lockfile。

## Runtime Security Matrix

| Assertion | 当前证据 | Evidence Label | 结论 |
|---|---|---|---|
| non-demo mode 缺少 `INTERNAL_SERVICE_TOKEN` fail-fast | `createApiServer` production env throws `runtime_internal_service_token_required` | INTEGRATION_TEST_EVIDENCE | PASS |
| shared runtime 拒绝 legacy internal token | production injected `service-kernel-token` throws `runtime_internal_service_token_unsafe_default` | INTEGRATION_TEST_EVIDENCE | PASS |
| shared runtime 不静默接受 seeded demo account | production security config 下 `admin/admin` returns `AUTH-401-003` | INTEGRATION_TEST_EVIDENCE | PASS |
| demo identity 与 non-demo identity 边界 | seeded demo users 仅在 non-shared runtime 可登录 | INTEGRATION_TEST_EVIDENCE | PASS |
| service-kernel credential 不泄露 token/stack | 既有 `runtime-credentials-security.test.ts` 覆盖 | INTEGRATION_TEST_EVIDENCE | PASS |

## RBAC / Tenant Isolation Matrix

| Assertion | 当前证据 | Evidence Label | 结论 |
|---|---|---|---|
| authenticated identity 绑定 tenant context | teacher token + `x-tenant-id=tenant_other` 被 `TENANT-403-001` 拒绝 | INTEGRATION_TEST_EVIDENCE | PASS |
| cross-tenant read denial | `GET /api/v1/courses` forged tenant header rejected | INTEGRATION_TEST_EVIDENCE | PASS |
| cross-tenant write denial | `POST /api/v1/courses/course_demo/runs` forged tenant header rejected | INTEGRATION_TEST_EVIDENCE | PASS |
| body-level tenant escalation denial | tenant admin `POST /api/v1/admin/users` with `tenant_id=tenant_other` rejected | INTEGRATION_TEST_EVIDENCE | PASS |
| Tenant Admin 不能获得 Platform Admin 权限 | tenant admin `/api/v1/admin/state` only returns `tenant_demo` | INTEGRATION_TEST_EVIDENCE | PASS |
| Platform Admin 必须显式拥有平台角色 | platform token without tenant header can see all seeded tenants | INTEGRATION_TEST_EVIDENCE | PASS |
| Student cross-team write denial | Student cannot submit for beta team | INTEGRATION_TEST_EVIDENCE | PASS |
| cross-classroom read/write | 当前 API 没有独立 classroom entity；以 course/run/team scope 作为 current boundary | SOURCE_ONLY_INFERENCE | NOT_AVAILABLE |

## Student Result / Error / Replay Visibility Matrix

| Surface | Forbidden data | 当前证据 | Evidence Label | 结论 |
|---|---|---|---|---|
| Student success result | `state_true`、replay evidence、manifest/private hashes、other team/user data | R3 integration asserts redacted result and no beta team/user/decision ids | INTEGRATION_TEST_EVIDENCE | PASS |
| Student structured truth error | protected truth value | `TRUTH-403-001` does not echo sentinel | INTEGRATION_TEST_EVIDENCE | PASS |
| Student validation/free-text error | free-text private artifact sentinel | `DEC-422-001` does not echo strategy sentinel | INTEGRATION_TEST_EVIDENCE | PASS |
| Student cross-tenant error | `tenant_other`、other tenant users | `TENANT-403-001` response omits private identifiers | INTEGRATION_TEST_EVIDENCE | PASS |
| Student replay surface | private replay metadata | Student result has no `replay_evidence` and no manifest/private hashes | INTEGRATION_TEST_EVIDENCE | PASS |

## Teacher Evidence Boundary Matrix

| Assertion | 当前证据 | Evidence Label | 结论 |
|---|---|---|---|
| Teacher can read classroom result rows | Teacher result returns two team rows for the current run | INTEGRATION_TEST_EVIDENCE | PASS |
| Teacher can read authorized replay evidence | Teacher result includes `replay_status=matched` and `replay_writes_formal_results=false` | INTEGRATION_TEST_EVIDENCE | PASS |
| Teacher cannot cross tenant via header spoofing | teacher token + `tenant_other` rejected before route logic | INTEGRATION_TEST_EVIDENCE | PASS |
| Teacher UI can publish M1 classroom result | Existing Playwright teacher smoke executes create run, open, lock, settle, publish | E2E_BROWSER | PASS |

## Tenant Admin Scope Matrix

| Assertion | 当前证据 | Evidence Label | 结论 |
|---|---|---|---|
| Tenant Admin API state remains current-tenant scoped | `/api/v1/admin/state` returns only `tenant_demo` tenants/users | INTEGRATION_TEST_EVIDENCE | PASS |
| Tenant Admin audit surface excludes other tenant | `/api/v1/audit/logs` omits `tenant_other` and `usr_other_teacher` | INTEGRATION_TEST_EVIDENCE | PASS |
| Tenant Admin browser scope remains current-tenant scoped | Playwright admin smoke shows Demo tenant/users and not platform/other tenant rows | E2E_BROWSER | PASS |

## Replay Evidence and Official Result Non-Overwrite

The R3 guard builds replay evidence from the same frozen run, round, scenario, parameter set, teams, decisions and settlement used by Shared Golden M1. It snapshots `store.settlementResults` and `store.rounds` before replay evidence generation and confirms both remain unchanged after `createM1RunReplayEvidence`.

```text
shadow replay writes formal result:
false

official result overwritten:
false
```

Evidence Label:

```text
INTEGRATION_TEST_EVIDENCE
```

## Browser Smoke Evidence

The repository already has:

```text
@playwright/test
playwright.config.ts
npm run test:e2e:ui
tests/e2e-ui/student-smoke.spec.ts
```

This PR uses the existing dependency and harness. It adds an admin web server entry and a Tenant Admin current-tenant smoke to the existing spec. It does not add browser dependencies, workflow changes, production config, or external services.

## R4 Discovery Parity Gap Directory

| Directory | Current source evidence | Gap | Status |
|---|---|---|---|
| Repository Port Matrix | `repository-ports.ts`, `repository-facade.ts`, `json-repository-adapter.ts`, `repository-provider.ts` | facade exists but API still has direct `store` paths for non-settlement surfaces | DISCOVERY_ONLY |
| JSON Provider Authority Matrix | `createJsonRepositoryProvider` is the current default provider | JSON/memory remains current active runtime | DISCOVERY_ONLY |
| Direct Store Access Inventory | `server.ts` still reads/writes `runtime.store` for auth/admin/course/team/run/demo-state; settlement reads use facade for core settlement path | Direct-store remediation is not authorized here | DISCOVERY_ONLY |
| PostgreSQL Adapter Presence Matrix | `postgres-repository-adapter.ts` and unit tests exist | Not active runtime, no ProviderSelector PostgreSQL mode | DISCOVERY_ONLY |
| ProviderSelector Inventory | `RepositoryProviderMode = "custom" \| "json"` | No runtime PostgreSQL selector in `server.ts` | DISCOVERY_ONLY |
| Migration / Rollback Risk Directory | snapshot migration/restore scripts exist; SQL migration work is outside this PR | no SQL / migration execution authorized | DISCOVERY_ONLY |
| RLS Evidence Gap Directory | no runtime RLS proof in current JSON runtime | PostgreSQL RLS not proven | NOT_PROVEN |
| Transaction Evidence Gap Directory | JSON settlement outcome rollback is local in-memory/file boundary | no DB transaction proof | NOT_PROVEN |
| Idempotency Evidence Gap Directory | settlement idempotency covered in Vitest; cross-process idempotency is not proven | PARTIAL |
| Concurrency Evidence Gap Directory | in-process settlement lock exists | no distributed lock / row lock proof | PARTIAL |
| Runtime Opt-In Evidence Gap Directory | `DATABASE_URL` is not wired to active API runtime | PostgreSQL runtime activation not authorized | NOT_AUTHORIZED |
| R4b versus R4 Macro Boundary Matrix | direct-store boundary scripts/docs exist | R4 Macro, Audit Read authority refactor and Postgres cutover are not authorized | NOT_AUTHORIZED |

## L1 G0-G7 Unified Evidence Matrix

| Gate | Capability | Current Evidence | Current Status |
|---|---|---|---|
| G0 | governance control | PR #195/#196 history, solo-maintainer policy, current branch protection history | EXCEPTION / NOT_GRANTED |
| G1 | runtime configuration boundary | non-demo secret fail-fast and seeded demo login rejection | PARTIAL |
| G2 | RBAC / tenant / scope boundary | R3 integration and P1 auth/RBAC tests | PARTIAL |
| G3 | visibility and projection boundary | R3 + Shared Golden M1 Student/Teacher/Tenant Admin assertions | PARTIAL |
| G4 | Shared Golden M1 main flow | PR #196 merged integration guard | PARTIAL |
| G5 | replay evidence and non-overwrite | Shared Golden M1 + R3 replay non-overwrite assertions | PARTIAL |
| G6 | recovery / reset / retention | memory cleanup and snapshot docs only | NOT_READY |
| G7 | teacher kit / operator readiness | quality docs and browser smoke | NOT_READY |

本矩阵中没有任何一行授予 `G0 PASS`、`L1 READY`、Pilot readiness 或 Production readiness。

## Validation Commands

```powershell
npm test -- tests/integration/r3-runtime-boundary.test.ts
npm test -- tests/integration/l1-shared-golden-m1-scenario.test.ts
npm test -- tests/integration/p0-flow.test.ts
npm test -- tests/integration/m1-teaching-loop.test.ts
npm test -- tests/integration/decision-submit-characterization.test.ts
npm test -- tests/integration/m1-run-manifest-replay-evidence.test.ts
npm run test:contract
npm run typecheck
npm run lint
npm run test:e2e:ui
npm test
npm run build
git diff --check
```

## 明确非证明项

本 PR 不证明：

```text
G0 PASS
L1 READY
PostgreSQL runtime
SQL
migration
ProviderSelector PostgreSQL mode
durable settlement
R4 Macro
R9
R10
Pilot
Production
full telemetry redaction
full export redaction
full backup / restore / retention
distributed recovery
```

本 PR 不关闭 #111、#114 或 #115。
