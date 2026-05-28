# 学员端角色化决策体系测试策略地图

建议保存路径：`docs/architecture/student-role-based-decision-test-strategy.md`

| 项目     | 内容                                                                                                                                                                                                                                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 文档定位 | 学员端角色化决策体系的测试分层、门禁和文件映射总览                                                                                                                                                                                                                                 |
| 适用范围 | `apps/student`、`apps/teacher`、`apps/admin`、`packages/shared-contracts`、`services/api`、`services/simulation-core`、`db/migrations`、`plugins`、`tests`                                                                                                                         |
| 依据     | 当前已生成的 apps / packages / services / db / plugins / docs 知识图谱，以及 `docs/architecture/student-role-based-decision-refactor.md`、`docs/architecture/student-role-based-decision-implementation-plan.md`、`docs/architecture/student-role-based-decision-phase-0-audit.md` |
| 约束     | 不修改业务代码，只定义测试策略和门禁映射                                                                                                                                                                                                                                           |
| 最后更新 | 2026-05-26                                                                                                                                                                                                                                                                         |

## 1. 测试策略总则

学员端角色化决策体系的测试必须围绕一条核心链路展开：

```text
RoleDecisionSection -> DecisionMergeCommit -> TeamConfirmation -> canonical Decision -> SettlementResult
```

测试不只验证页面是否可点，还要验证以下系统属性：

- 角色草稿、ready、merge、confirm、submit 的状态机是否稳定。
- canonical decision 是否只从已确认的 merge chain 进入正式结算。
- 正式结算是否幂等，且不会被重复 settle 覆盖。
- Replay / Shadow Replay 是否可复现、可比较、可审计。
- 插件 hook 是否只在白名单边界内影响真值计算。
- AI advisory 是否始终只读建议，不进入正式真值链。
- migration、schema、fixture 与 repository adapter 是否保持一致。

## 2. 测试分层总览

| 测试类别                     | 主要目标                                                                 | 当前仓库落点                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| unit tests                   | 验证最小纯函数、schema 解析、引擎 deterministic 行为、边界拒绝           | `tests/unit/*`、`services/simulation-core/src/*`、`packages/shared-contracts/src/index.ts`                                                    |
| contract tests               | 验证 shared-contracts、OpenAPI、JSON Schema、fixture 和 adapter 契约一致 | `tests/contract/repository-adapter-contract.ts`、`scripts/check-contracts.mjs`、`contracts/*`                                                 |
| API integration tests        | 验证 route / service / repository 的完整命令链                           | `tests/integration/*`、`services/api/src/routes/*`、`services/api/src/*service.ts`                                                            |
| E2E tests                    | 验证 student / teacher / admin 的真实工作流                              | `tests/e2e/*`、`tests/e2e-ui/*`、`apps/*`                                                                                                     |
| migration tests              | 验证 SQL migration、RLS、唯一约束、表结构和 adapter 映射                 | `db/migrations/*`、`scripts/check-migrations.mjs`、`tests/integration/postgres-repository-adapter.test.ts`                                    |
| replay golden tests          | 验证正式结果和 replay hash 的稳定性                                      | `tests/unit/simulation-core.test.ts`、`tests/integration/p2-engineering-foundation.test.ts`、`tests/e2e/p1-frontdoor-smoke.test.ts`           |
| settlement idempotency tests | 验证重复 settle 不产生重复副作用                                         | `services/api/src/settlement-service.ts`、`tests/integration/p2-engineering-foundation.test.ts`、`tests/e2e/p1-frontdoor-smoke.test.ts`       |
| plugin boundary tests        | 验证插件只在受控 hook 内改变结果                                         | `services/simulation-core/src/*`、`plugins/wellness/*`、`tests/unit/simulation-core.test.ts`、`tests/contract/repository-adapter-contract.ts` |

## 3. Unit Tests

### 测试目标

验证最小业务单元在无外部依赖或最少依赖下的正确性，重点覆盖：

- `DecisionPayload` / `Decision` 解析与未知字段拒绝。
- `RoleDecisionSection`、`DecisionMergeCommit`、`TeamConfirmation` 的状态转换语义。
- simulation-core 的 deterministic 计算、plugin trace、权限裁剪和稳定输出。
- repository adapter 的自然键 upsert、JSON 往返、结算结果持久化。
- AI advisory-only 字段白名单和越权输出阻断。

### 涉及目录

- `tests/unit`
- `packages/shared-contracts/src`
- `services/simulation-core/src`
- `services/api/src`

### 关键文件

- `tests/unit/decision-schema.test.ts`
- `tests/unit/simulation-core.test.ts`
- `tests/unit/json-repository-adapter.test.ts`
- `tests/unit/auth-token.test.ts`
- `tests/unit/health.test.ts`
- `packages/shared-contracts/src/index.ts`
- `services/simulation-core/src/market.ts`
- `services/simulation-core/src/operations.ts`
- `services/simulation-core/src/finance.ts`
- `services/simulation-core/src/scoring.ts`
- `services/simulation-core/src/toy-logit-engine.ts`
- `services/api/src/simulation.ts`

### 失败风险

- 解析器放宽未知字段，导致客户端脏数据进入正式链路。
- deterministic 结果漂移，Replay golden 失效。
- plugin trace 丢失或 hook 顺序变化。
- repository adapter 写入字段和 shared-contracts 不一致。
- AI advisory 输出越权写入真值字段。

### 建议命令

```powershell
npm test
```

```powershell
npm run test:coverage
```

```powershell
npm run typecheck
```

### 验收标准

- `DecisionPayload`、`Decision`、`RoleDecisionSection`、`DecisionMergeCommit`、`TeamConfirmation` 关键字段解析稳定。
- unknown fields 被拒绝或被显式裁剪，不会静默进入正式 payload。
- same input 下 `simulation-core` 输出稳定，plugin trace 可解释。
- 单元测试覆盖到 role chain 的关键状态分支和 AI advisory guardrail。

## 4. Contract Tests

### 测试目标

验证 shared-contracts、OpenAPI、JSON Schema、fixture 和 repository adapter 行为一致，防止 schema drift 和端到端对象断裂。

### 涉及目录

- `contracts/openapi`
- `contracts/schemas`
- `contracts/fixtures`
- `packages/shared-contracts/src`
- `tests/contract`
- `scripts`

### 关键文件

- `tests/contract/repository-adapter-contract.ts`
- `scripts/check-contracts.mjs`
- `contracts/openapi/p0-api.openapi.yaml`
- `contracts/schemas/decision.v1.json`
- `contracts/schemas/role-decision-section.v1.json`
- `contracts/schemas/decision-merge-commit.v1.json`
- `contracts/schemas/team-confirmation.v1.json`
- `contracts/schemas/settlement-result.v1.json`
- `contracts/schemas/replay-input-manifest.v1.json`
- `contracts/schemas/replay-diff-report.v1.json`
- `contracts/schemas/coach-output.v1.json`
- `contracts/schemas/model-call-log.v1.json`
- `contracts/fixtures/decision.valid.json`
- `contracts/fixtures/role-decision-section.valid.json`
- `contracts/fixtures/decision-merge-commit.valid.json`
- `contracts/fixtures/team-confirmation.valid.json` 当前未见；需要先确认是否补齐

### 失败风险

- schema 与代码字段不同步。
- shared-contracts 新增字段后未同步 OpenAPI 或 fixtures。
- repository adapter contract 和真实运行时行为分叉。
- `team-confirmation.valid.json` 之类的缺失 fixture 让契约覆盖不完整。

### 建议命令

```powershell
npm run test:contract
```

```powershell
npm run test:schema-drift
```

```powershell
npm run typecheck
```

### 验收标准

- shared-contracts 类型、OpenAPI、JSON Schema 和 fixtures 相互一致。
- 决策链核心对象都能找到明确 schema 和合法样例。
- repository adapter contract 覆盖 role section、merge commit、team confirmation、replay、settlement 的持久化行为。

## 5. API Integration Tests

### 测试目标

验证 route、service、repository、ledger、Replay 和 settlement 组合后的真实命令链，重点是 student 端角色化决策提交和 teacher 端锁轮 / 结算 / 发布流程。

### 涉及目录

- `tests/integration`
- `services/api/src/routes`
- `services/api/src/foundation-services.ts`
- `services/api/src/decision-routes.ts`
- `services/api/src/settlement-service.ts`
- `services/api/src/replay-service.ts`
- `services/api/src/repository-facade.ts`

### 关键文件

- `tests/integration/p0-flow.test.ts`
- `tests/integration/p2-engineering-foundation.test.ts`
- `tests/integration/async-repository-facade.test.ts`
- `tests/integration/postgres-repository-adapter.test.ts`
- `services/api/src/routes/foundation-routes.ts`
- `services/api/src/routes/decision-routes.ts`
- `services/api/src/routes/settlement-routes.ts`
- `services/api/src/routes/replay-routes.ts`
- `services/api/src/routes/agent-routes.ts`
- `services/api/src/repository-facade.ts`
- `services/api/src/settlement-service.ts`
- `services/api/src/replay-service.ts`

### 失败风险

- route 绕过 repository port 直接写 store。
- role section ready / merge / confirmation / decision 的顺序或权限校验失效。
- official decision 被客户端 payload 覆盖。
- settlement 不是幂等的，或重复 settle 产生二次副作用。
- Replay / Shadow Replay 读写链路绕过 repositoryFacade。

### 建议命令

```powershell
npm test
```

```powershell
npm run test:postgres-adapter
```

```powershell
npm run typecheck
```

### 验收标准

- 学员端角色化决策链完整跑通。
- teacher 锁轮前必须看到 canonical decision 完整性检查。
- settlement 重复调用返回稳定结果，不重复落库或重复推进状态。
- Replay / Shadow Replay 只生成正式与候选报告，不覆盖历史结果。

## 6. E2E Tests

### 测试目标

验证教师端、学员端、管理端的真实浏览器工作流和可见性裁剪，确保角色化决策从 UI 到 API 再到 settlement 的整体体验一致。

### 涉及目录

- `tests/e2e`
- `tests/e2e-ui`
- `apps/student`
- `apps/teacher`
- `apps/admin`

### 关键文件

- `tests/e2e/p1-frontdoor-smoke.test.ts`
- `tests/e2e-ui/sprint8-product-flow.spec.ts`
- `apps/student/src/App.tsx`
- `apps/teacher/src/App.tsx`
- `apps/admin/src/App.tsx`

### 失败风险

- 前端页面展示和后端权限裁剪不一致。
- 学员端角色链 UI 误把草稿当正式结果。
- 教师端无法正确看到 team readiness、canonical decision 或 settlement 完成状态。
- 管理端误把 RBAC 角色与业务角色混用。

### 建议命令

```powershell
npm run test:e2e:ui
```

```powershell
npx playwright test
```

### 验收标准

- 学员端可完成登录、角色 section、ready、merge、confirmation、decision 提交。
- 教师端可完成锁轮、结算、发布和 Replay / Shadow Replay 入口验证。
- 管理端仅展示控制面，不介入正式结算真值链。
- 页面文本、状态徽标和按钮行为符合 canonical / advisory 区分。

## 7. Migration Tests

### 测试目标

验证数据库表结构、字段、索引、RLS、唯一约束和 adapter 映射是否与角色化决策体系一致，防止 schema 漂移和正式结算链断裂。

### 涉及目录

- `db/migrations`
- `scripts`
- `tests/integration`
- `services/api/src/postgres-repository-adapter.ts`

### 关键文件

- `db/migrations/20260519_001_create_repository_identity_course_tables.sql`
- `db/migrations/20260519_002_create_repository_decision_tables.sql`
- `db/migrations/20260519_003_create_repository_billing_entitlement_tables.sql`
- `db/migrations/20260519_004_create_repository_data_governance_tables.sql`
- `db/migrations/20260519_005_create_repository_ledger_replay_tables.sql`
- `db/migrations/20260522_006_create_plugin_replay_ai_contract_tables.sql`
- `db/migrations/20260524_007_add_parameter_set_parameters_jsonb.sql`
- `db/migrations/20260525_008_create_auth_session_table.sql`
- `scripts/check-migrations.mjs`
- `scripts/check-postgres-migration-apply.mjs`
- `tests/integration/postgres-repository-adapter.test.ts`

### 失败风险

- `decision`、`role_decision_section`、`decision_merge_commit`、`team_confirmation` 的约束与代码不一致。
- `merge_commit_id`、`team_confirmation_id`、`role_section_ids` 的关系语义和迁移表达不同步。
- replay / settlement 相关表缺少幂等或审计约束。
- PostgreSQL adapter 与 migration 字段类型不匹配。

### 建议命令

```powershell
npm run test:migration
```

```powershell
npm run test:migration:apply
```

```powershell
npm run test:postgres-adapter
```

### 验收标准

- 迁移脚本可通过检查并在可丢弃数据库上成功 apply。
- 角色链相关表与 shared-contracts / repository port 一致。
- RLS、唯一键、status check 和 replay / settlement 相关约束可复现。

## 8. Replay Golden Tests

### 测试目标

验证相同输入在相同配置、相同 seed、相同 canonical decision 下能够得到稳定的结算结果和 replay hash。

### 涉及目录

- `tests/unit`
- `tests/integration`
- `tests/e2e`
- `services/api/src/replay-service.ts`
- `services/api/src/settlement-service.ts`
- `services/simulation-core/src`
- `contracts/fixtures`

### 关键文件

- `tests/unit/simulation-core.test.ts`
- `tests/integration/p2-engineering-foundation.test.ts`
- `tests/e2e/p1-frontdoor-smoke.test.ts`
- `services/api/src/replay-service.ts`
- `services/api/src/settlement-service.ts`
- `services/simulation-core/src/toy-logit-engine.ts`
- `services/simulation-core/src/market.ts`
- `services/simulation-core/src/operations.ts`
- `services/simulation-core/src/finance.ts`
- `services/simulation-core/src/scoring.ts`
- `contracts/fixtures/replay-run.valid.json`
- `contracts/fixtures/replay-report.valid.json`
- `contracts/fixtures/replay-input-manifest.valid.json`
- `contracts/fixtures/replay-diff-report.valid.json`

### 失败风险

- 相同输入输出不稳定。
- plugin trace 变化导致 golden 断裂。
- canonical decision、scenario、parameter set、plugin ids 或 seed 没有正确纳入 replay manifest。
- `ReplayInputManifest` / `ReplayDiffReport` 的字段漂移。

### 建议命令

```powershell
npm test
```

```powershell
npm run test:contract
```

### 验收标准

- 同一基线输入反复 replay 得到稳定 `replay_hash`。
- `ReplayInputManifest` 记录 canonical decision，而不是 role drafts。
- `ReplayDiffReport` 只反映候选差异，不改写历史正式结果。

## 9. Settlement Idempotency Tests

### 测试目标

验证正式结算命令是幂等的，重复请求、网络重试或并发补偿不会导致重复结果、重复事件或重复状态推进。

### 涉及目录

- `tests/integration`
- `tests/e2e`
- `services/api/src/settlement-service.ts`
- `services/api/src/routes/settlement-routes.ts`
- `services/api/src/repository-facade.ts`

### 关键文件

- `tests/integration/p2-engineering-foundation.test.ts`
- `tests/e2e/p1-frontdoor-smoke.test.ts`
- `services/api/src/settlement-service.ts`
- `services/api/src/routes/settlement-routes.ts`
- `services/api/src/repository-facade.ts`
- `contracts/schemas/settlement-result.v1.json`
- `contracts/schemas/state-snapshot.v1.json`

### 失败风险

- 重复 settle 产生第二份正式结果。
- `SettlementResult`、`StateSnapshot`、`Round` 状态推进不一致。
- replay hash 不稳定。
- teacher 端 publish / lock 逻辑与 settlement 状态不同步。

### 建议命令

```powershell
npm test
```

```powershell
npm run test:e2e:ui
```

### 验收标准

- 同一 round 重复 settle 返回同一正式结果或稳定 replay hash。
- 第二次结算不再产生新的正式副作用。
- `Round`、`SettlementResult`、`StateSnapshot` 状态一致。

## 10. Plugin Boundary Tests

### 测试目标

验证插件只在白名单 hook 内扩展市场、运营、财务和评分，不得写正式真值字段，也不得绕过正式结算链。

### 涉及目录

- `plugins/wellness`
- `services/simulation-core/src`
- `tests/unit`
- `tests/contract`
- `tests/integration`

### 关键文件

- `plugins/wellness/plugin.manifest.json`
- `services/simulation-core/src/wellness-plugin.ts`
- `services/simulation-core/src/wellness-parameters.ts`
- `services/simulation-core/src/types.ts`
- `services/simulation-core/src/toy-logit-engine.ts`
- `tests/unit/simulation-core.test.ts`
- `tests/contract/repository-adapter-contract.ts`
- `tests/integration/p2-engineering-foundation.test.ts`
- `contracts/schemas/plugin-package.v1.json`
- `contracts/schemas/wellness-parameters.v1.json`

### 失败风险

- 插件直接改写 `state_true`、score、rank 或 settlement result。
- 插件在进行中 Run 被热替换。
- `plugin_trace` 不完整，导致 Replay 无法解释差异。
- PluginPackage / ParameterSet 与 Run 绑定后仍可热改。

### 建议命令

```powershell
npm test
```

```powershell
npm run test:contract
```

```powershell
npm run test:migration
```

### 验收标准

- 插件只通过 `adjustDemand`、`adjustOperations`、`adjustFinance`、`adjustScore` 影响结果。
- `plugin_trace` 完整记录每个 hook 的影响。
- 插件包、参数集和场景包一旦绑定 Run，不应在运行期热替换。
- Replay 或 golden test 可以解释插件带来的差异。

## 11. 推荐的分层执行顺序

建议按以下顺序推进测试建设：

1. 先保证 `unit` 和 `contract` 稳定，冻结角色链对象和 schema。
2. 再补齐 `API integration`，把 role section、merge、confirmation、canonical decision 和 settlement 串起来。
3. 然后跑通 `E2E`，验证学生端和教师端真实浏览器流程。
4. 再固化 `migration` 与 `postgres adapter`，保证正式持久化边界。
5. 最后强化 `replay golden`、`settlement idempotency` 和 `plugin boundary`，把真值、可复现性和插件边界锁死。

## 12. 统一命令入口

当前仓库已提供可直接使用的统一命令入口：

```powershell
npm test
npm run test:contract
npm run test:schema-drift
npm run test:migration
npm run test:migration:apply
npm run test:postgres-adapter
npm run test:e2e:ui
npm run test:coverage
npm run quality
```

若后续按测试类型拆分更细的脚本，可在不改变命令语义的前提下继续新增，例如 `test:replay`、`test:settlement-idempotency`、`test:plugin-boundary`。这些新脚本不应改变现有门禁，只是让策略地图更容易落地。
