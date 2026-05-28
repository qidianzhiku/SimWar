# 学员端分角色登录与角色化决策体系实施计划

建议保存路径：`docs/architecture/student-role-based-decision-implementation-plan.md`

文档状态：Proposed

依据文档：`docs/architecture/student-role-based-decision-refactor.md`

实施范围：`contracts/`、`packages/shared-contracts/`、`services/api/`、`db/migrations/`、`apps/student/`、`apps/teacher/`、`apps/admin/`、`plugins/`、`tests/`

本文用于指导 Codex 后续按阶段开发。当前任务只生成实施计划，不修改任何业务代码。

## 0. 实施原则

本计划必须保持以下边界：

- 当前核心链路保持不变：`RoleDecisionSection -> DecisionMergeCommit -> TeamConfirmation -> canonical Decision -> SettlementResult`。
- `RoleReadyState` 不作为独立核心实体实现；ready 状态由 `RoleDecisionSection.status` 或审计事件表达。
- `RoleContext`、`RoleWorkspaceSnapshot`、`RoleReadinessSummary`、`role_assignment`、`role_field_policy`、`decision_merge_section_link` 是拟新增能力，开发前必须先完成契约和测试。
- 正式结算只消费 canonical `Decision`，不得消费 role draft、AI advisory、评论、证据或未确认 merge。
- AI 只保留 advisory-only，不能执行 ready、merge、confirm、submit、settle 或 publish。
- 前端不得自行计算正式市场份额、利润、评分、排名或结算状态。
- 每个阶段都应保持可独立 review、可回滚、可测试。

推荐按小 PR 推进。除 Phase 0 外，每个阶段进入开发前先运行相关现状核验，退出阶段前至少运行对应最小测试门禁。

## Phase 0：实施前代码核验与基线冻结

### 目标

确认当前代码、契约、schema、fixture、migration 和测试文件的真实状态，避免把方案性概念当作已实现能力。该阶段只读检查，不修改业务代码。

### 涉及文件

| 类别             | 文件或目录                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 架构文档         | `docs/architecture/student-role-based-decision-refactor.md`、`docs/architecture/simwar-architecture-overview.md`                                 |
| OpenAPI          | `contracts/openapi/p0-api.openapi.yaml`                                                                                                          |
| schemas          | `contracts/schemas/role-decision-section.v1.json`、`decision-merge-commit.v1.json`、`team-confirmation.v1.json`、`decision.v1.json`              |
| fixtures         | `contracts/fixtures/role-decision-section.valid.json`、`decision-merge-commit.valid.json`、`team-confirmation.valid.json`、`decision.valid.json` |
| shared contracts | `packages/shared-contracts/src/index.ts`                                                                                                         |
| API routes       | `services/api/src/routes/foundation-routes.ts`、`decision-routes.ts`、`round-routes.ts`、`settlement-routes.ts`、`agent-routes.ts`               |
| persistence      | `services/api/src/repository-ports.ts`、`repository-facade.ts`、`json-repository-adapter.ts`、`postgres-repository-adapter.ts`                   |
| migrations       | `db/migrations/20260519_002_create_repository_decision_tables.sql`、`20260519_005_create_repository_ledger_replay_tables.sql`                    |
| tests            | `tests/contract/`、`tests/integration/`、`tests/unit/`、`tests/e2e/`、`tests/e2e-ui/`                                                            |

### 具体改动

本阶段不改代码。Codex 需要输出一份核验记录，至少确认：

- 当前是否已有独立 `role-sections/{role}/ready` endpoint。
- 当前 `PUT role-sections/{role}` 是否可以通过 `status=ready` 表达 ready。
- 当前 `Decision` 是否已有 `merge_commit_id`、`team_confirmation_id`、`source`、`submitted_by`。
- 当前 `DecisionMergeCommit.status` 是否只有 `validated`。
- 当前 `TeamConfirmation.status` 是否只有 `confirmed`。
- 当前 `RoleDecisionSection.status` 是否只有 `draft | ready`。
- 当前 `decision.merge_commit_id` 与 `decision.team_confirmation_id` 是否为严格外键。
- 当前 role decision 相关 integration tests 和 contract tests 覆盖哪些路径。

### 风险

- 如果跳过该阶段，后续 Codex 可能重复造 endpoint、重复造类型，或错误扩展 status。
- 当前仓库存在大量未提交变更，开发时必须避免误改或误提交无关文件。
- 图谱可能落后于最新本地代码，必须以当前文件为准二次确认。

### 测试方式

```powershell
rg -n "RoleDecisionSection|DecisionMergeCommit|TeamConfirmation|RoleReadyState" packages contracts services tests
rg -n "role-sections|merge-commits|confirmations|readiness|role-context|role-workspace" services contracts apps tests
rg -n "merge_commit_id|team_confirmation_id|role_section_ids" db services packages contracts tests
git status --short
```

### 验收标准

- 核验结果明确列出“当前已有 / 拟新增 / 需要进一步确认”。
- 没有业务代码变更。
- 后续阶段的待改文件清单和测试清单已经确认。

## Phase 1：shared contracts、OpenAPI、schemas 与 fixtures

### 目标

先冻结跨端契约，让前端、API、repository、测试和文档共享同一套角色上下文、角色工作台和 readiness 语义。

### 涉及文件

| 类别             | 文件或目录                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| shared contracts | `packages/shared-contracts/src/index.ts`                                                                                                   |
| OpenAPI          | `contracts/openapi/p0-api.openapi.yaml`                                                                                                    |
| schemas          | `contracts/schemas/role-decision-section.v1.json`、`decision-merge-commit.v1.json`、`team-confirmation.v1.json`、`decision.v1.json`        |
| 新增 schemas     | `contracts/schemas/role-context.v1.json`、`role-workspace-snapshot.v1.json`、`role-readiness-summary.v1.json`、`role-field-policy.v1.json` |
| fixtures         | `contracts/fixtures/*.json`                                                                                                                |
| contract tests   | `tests/contract/`、`scripts/check-contracts.mjs`                                                                                           |

### 具体改动

- 新增 `RoleContext`、`RolePermissionScope`、`RoleWorkspaceSnapshot`、`RoleReadinessSummary`。
- 新增或明确 `RoleFieldOwnership` / `RoleFieldPolicy`，用于描述角色可编辑字段、只读字段和 merge 规则。
- 保持 `RoleDecisionSection.status` 以 `draft | ready` 为当前最小实现。`returned`、`locked` 仅在本阶段完成核验后再决定是否引入。
- 保持 `DecisionMergeCommit.status=validated`、`TeamConfirmation.status=confirmed` 为当前最小实现。`rejected`、`revoked`、`superseded` 不在首批实现中默认加入。
- 为 `Decision` 明确 canonical source 追溯字段。如果当前字段不存在，先以拟新增字段进入 contract proposal。
- 新增 role context、workspace、readiness 的 JSON Schema 和 valid fixtures。
- 更新 OpenAPI，标注以下拟新增 endpoint：
  - `GET /api/v1/runs/{runId}/rounds/{roundNo}/teams/{teamId}/role-context`
  - `GET /api/v1/runs/{runId}/rounds/{roundNo}/teams/{teamId}/role-workspace`
  - `GET /api/v1/runs/{runId}/rounds/{roundNo}/teams/{teamId}/readiness`
- 确保 OpenAPI 中已有 role section、merge commit、confirmation、decision、settle endpoint 与 shared types 对齐。

### 风险

- 过早扩展 status 会放大 route、repository、migration 和 UI 改造范围。
- 新增 schemas 如果没有 fixture 和 contract tests，很容易发生 schema drift。
- 如果 OpenAPI 与 `@simwar/shared-contracts` 不一致，前后端会出现隐性契约分叉。

### 测试方式

```powershell
npm run typecheck
npm run test:contract
npm run test:schema-drift
```

### 验收标准

- shared types、OpenAPI、schemas、fixtures 一致。
- `RoleReadyState` 没有作为独立核心实体出现。
- 当前核心链路类型仍为 `RoleDecisionSection`、`DecisionMergeCommit`、`TeamConfirmation`、canonical `Decision`、`SettlementResult`。
- 新增类型都有至少一个 valid fixture。

## Phase 2：DB migration、repository ports 与 adapter 基线

### 目标

把角色上下文和合并追溯所需的数据结构落到 migration 与 repository ports，同时不破坏当前 JSON / Postgres adapter 行为。

### 涉及文件

| 类别              | 文件或目录                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| migrations        | `db/migrations/`                                                                                                                                       |
| repository ports  | `services/api/src/repository-ports.ts`                                                                                                                 |
| repository facade | `services/api/src/repository-facade.ts`                                                                                                                |
| JSON adapter      | `services/api/src/json-repository-adapter.ts`、`services/api/src/store.ts`                                                                             |
| Postgres adapter  | `services/api/src/postgres-repository-adapter.ts`                                                                                                      |
| adapter tests     | `tests/contract/repository-adapter-contract.ts`、`tests/integration/postgres-repository-adapter.test.ts`、`tests/unit/json-repository-adapter.test.ts` |
| migration tests   | `scripts/check-migrations.mjs`、`scripts/check-postgres-migration-apply.mjs`                                                                           |

### 具体改动

- 新增 migration：`role_assignment`，用于绑定 `tenant_id`、`course_id`、`run_id` 或 `round_id`、`team_id`、`user_id`、`role_key`。
- 新增 migration：`role_field_policy`，用于保存默认角色字段归属和课程级覆盖策略。
- 新增 migration：`decision_merge_section_link`，用于替代或补强 `decision_merge_commit.role_section_ids text[]` 的严格关系。
- 视 Phase 0 结论决定是否新增 `role_context_session`、`role_contribution_evidence`、`merge_conflict_log`、`role_readiness_history`。
- 如果当前 `decision.merge_commit_id`、`decision.team_confirmation_id` 不是严格外键，新增兼容 migration，将其升级为 FK 或记录为下一阶段风险。
- 扩展 repository ports：
  - 查询当前用户角色分配。
  - 查询 role field policy。
  - 查询 role workspace 聚合数据。
  - 查询 role readiness summary。
  - 写入 decision merge section links。
- JSON adapter 与 Postgres adapter 同步实现同一 port 行为。

### 风险

- 迁移如果直接改历史表约束，可能破坏现有 fixtures 或 adapter contract。
- `decision_merge_section_link` 与旧的 `role_section_ids` 双轨期间可能产生不一致，需要明确哪个是写入真源。
- Postgres adapter 与 JSON adapter 行为不一致会让本地演示和正式持久化产生分叉。

### 测试方式

```powershell
npm run test:migration
npm run test:migration:apply
npm run test:postgres-adapter
npm test -- --run tests/unit/json-repository-adapter.test.ts
```

### 验收标准

- migration 可重复检查通过。
- 新增表有 `tenant_id`、必要唯一键、必要索引和外键。
- repository adapter contract 同时覆盖 JSON 和 Postgres 行为。
- 当前核心链路旧数据仍可读取。

## Phase 3：services API 与权限守卫

### 目标

在服务端建立角色上下文、角色工作台、readiness 聚合和命令级权限守卫，保证角色化行为不能绕过 canonical decision 链路。

### 涉及文件

| 类别         | 文件或目录                                                                                                                         |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| routes       | `services/api/src/routes/foundation-routes.ts`、`decision-routes.ts`、`round-routes.ts`、`settlement-routes.ts`、`agent-routes.ts` |
| auth         | `services/api/src/auth-context.ts`、`auth.ts`                                                                                      |
| services     | `services/api/src/foundation-services.ts`、`settlement-service.ts`、`replay-service.ts`                                            |
| HTTP helpers | `services/api/src/http.ts`                                                                                                         |
| repository   | `services/api/src/repository-facade.ts`、`repository-ports.ts`                                                                     |
| tests        | `tests/integration/`、`tests/unit/auth-token.test.ts`                                                                              |

### 具体改动

- 在 `FoundationRoutes` 增加拟新增 endpoint：
  - `GET role-context`
  - `GET role-workspace`
  - `GET readiness`
- 强化 `PUT role-sections/{role}`：
  - 校验 actor、tenant、team membership、role assignment。
  - 校验 role field policy。
  - 拒绝真值字段。
  - 保持幂等保存。
- 决定 ready command 形态：
  - 如果已有独立 ready endpoint，则补权限和测试。
  - 如果没有，则通过 `PUT role-sections/{role}` 更新 `status=ready`，并在 OpenAPI 中明确。
- 强化 `POST merge-commits`：
  - 只允许 CEO/队长或具备 merge 权限的角色。
  - 读取 ready sections 和 field policy。
  - 生成 diff、validation report 和 section link。
- 强化 `POST confirmations`：
  - 校验 merge commit 属于同一 tenant/run/round/team。
  - 校验确认策略。
  - 保持幂等。
- 强化 `DecisionRoutes`：
  - canonical `Decision` 必须追溯到 confirmed `TeamConfirmation`。
  - 不接受未确认 merge 或角色草稿。
- 强化 `RoundRoutes` 锁轮 preflight：
  - 每个队伍必须有可结算 canonical `Decision`。
  - 缺失时返回结构化错误。
- 强化 `AgentRoutes`：
  - advisory 输入按 `RoleContext` 裁剪。
  - AI 输出仍只写 `CoachOutput` / `ModelCallLog`。

### 风险

- 权限校验分散在 route 中会造成重复和漏检，建议集中到 foundation service 或 helper。
- 如果 role workspace 聚合返回过多字段，可能泄露 `state_true` 或对手策略。
- ready、merge、confirm、submit 幂等键不清晰会导致重复提交或审计噪音。

### 测试方式

```powershell
npm run lint
npm run typecheck
npm test
npm run test:contract
```

重点新增 integration cases：

- 学生只能保存自己的 role section。
- 学生不能保存其他角色 section。
- 未分配角色不能访问 role workspace。
- 非 CEO 不能创建 merge commit，除非有显式权限。
- 未 confirmed merge 不能提交 canonical decision。
- 锁轮前缺 canonical decision 时返回结构化错误。
- advisory 不得接受或输出真值字段写入。

### 验收标准

- 所有角色化写操作都有 actor、tenant、team、role、state、truth guard 校验。
- `DecisionRoutes` 只接受 confirmed merge 之后的 canonical decision。
- `SettlementRoutes` 不读取 role section、evidence 或 advisory。
- 权限失败返回稳定错误结构，前端可展示。

## Phase 4：settlement、Replay 与 truth hash 收口

### 目标

确保角色化重构不改变正式结算真值来源，不污染 replay truth hash，不破坏幂等结算。

### 涉及文件

| 类别            | 文件或目录                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| settlement      | `services/api/src/settlement-service.ts`、`services/api/src/simulation.ts`                                               |
| replay          | `services/api/src/replay-service.ts`                                                                                     |
| simulation core | `services/simulation-core/src/`                                                                                          |
| contracts       | `packages/shared-contracts/src/index.ts`、`contracts/schemas/replay-input-manifest.v1.json`、`settlement-result.v1.json` |
| tests           | `tests/unit/simulation-core.test.ts`、`tests/integration/p2-engineering-foundation.test.ts`、`tests/replay/`             |

### 具体改动

- 在 settlement input preparation 中明确只读取 canonical `Decision`。
- 在 `ReplayInputManifest` 中明确：
  - included：canonical decisions、scenario、parameter set、teams、engine、plugin ids、seed。
  - excluded：role drafts、AI advisory、learning evidence、role assignment、field policy。
- 对 excluded governance context 使用 `excluded_from_truth_hash` 或等价结构，避免影响 truth hash。
- 增加重复 settle 幂等测试，确认同一 run/round 返回稳定 result 或 hash。
- 确认发布后 round/result 只读，不能重新 settle 或改写正式结果。

### 风险

- 如果把 role assignment 或 role field policy 放入 truth hash，角色配置变化可能导致历史 Replay 不稳定。
- 如果 settlement service 读取 role sections，会绕过 confirmed canonical decision。
- 如果插件 role extension 与 settlement hook 共享未隔离结构，可能污染正式真值。

### 测试方式

```powershell
npm test
npm run test:contract
npm run test:schema-drift
```

重点新增测试：

- role draft 改变不改变 replay truth hash。
- advisory 改变不改变 replay truth hash。
- canonical decision 改变会改变 expected hash 或 replay diff。
- settlement idempotency 通过。

### 验收标准

- settlement 只消费 canonical decision。
- Replay manifest 的 included / excluded 边界清楚。
- role-based evidence 不污染 official `SettlementResult`。
- 现有 simulation-core golden / idempotency 测试仍通过。

## Phase 5：apps/student 角色工作台

### 目标

将学员端从单个团队决策页面重构为角色化工作台，同时保留现有闭环功能：role section、ready、merge、confirmation、canonical decision、advisory、结果查看。

### 涉及文件

| 类别                  | 文件或目录                                                |
| --------------------- | --------------------------------------------------------- |
| student app           | `apps/student/src/App.tsx`、`apps/student/src/styles.css` |
| optional components   | `apps/student/src/components/`                            |
| optional client/hooks | `apps/student/src/api/`、`apps/student/src/hooks/`        |
| shared contracts      | `packages/shared-contracts/src/index.ts`                  |
| e2e                   | `tests/e2e-ui/`、`tests/e2e/`                             |

### 具体改动

- 新增或拆分 `RoleContextGate`：
  - 登录后拉取 role context。
  - 多上下文时展示选择器。
  - 单上下文时进入 role workspace。
- 新增或拆分 `RoleWorkspace`：
  - 展示课程、run、round、team、role、权限摘要。
  - 展示 role section 状态、team readiness、merge/confirmation 状态。
- 新增或拆分 `RoleSectionEditor`：
  - 根据 role field policy 或后端 workspace snapshot 渲染可编辑字段。
  - 保存 `RoleDecisionSection`。
  - 将 ready 表达为 section status 或 ready command。
- 新增 `MergeCommitPanel`：
  - 仅 CEO/队长或有权限角色可操作。
  - 展示 diff、validation report、缺失角色。
- 新增 `TeamConfirmationPanel`：
  - 展示 confirmed / pending 状态。
  - 支持确认操作和错误反馈。
- 新增 `CanonicalSubmitPanel`：
  - 只在 confirmed merge 后可提交。
  - 提交后进入只读或等待锁轮状态。
- 改造 advisory panel：
  - 明确 advisory-only 标签。
  - 不允许直接写 canonical decision。
- 改造 result view：
  - 发布后只读。
  - 不在前端计算正式结果。

### 风险

- 当前 `apps/student/src/App.tsx` 可能承载过多逻辑，一次性拆分容易引入回归。
- 如果前端本地推断权限而不是使用服务端裁剪，可能出现 UI 与 API 权限不一致。
- 文案或状态徽标不清楚会让学生误以为 AI 建议或角色草稿已经正式提交。

### 测试方式

```powershell
npm run typecheck
npm run build
npm run test:e2e:ui
```

关键手动或浏览器验证：

- 学生登录进入正确 role context。
- CFO/CMO/COO/risk 只能编辑自己区域。
- CEO 能看到 readiness summary 并创建 merge commit。
- 未 confirmed 时 canonical submit 不可用。
- 发布结果后页面只读。

### 验收标准

- 学员端主流程可完成：登录、role section、ready、merge、confirm、canonical submit、查看结果。
- 非授权字段不可编辑，API 也会拒绝。
- advisory 和正式决策有清晰视觉区分。
- 前端没有新增正式结算计算逻辑。

## Phase 6：apps/teacher 与 apps/admin 治理视图

### 目标

让教师能够运营分角色课堂，让管理端能够审计角色化权限与治理边界。

### 涉及文件

| 类别             | 文件或目录                                                                           |
| ---------------- | ------------------------------------------------------------------------------------ |
| teacher app      | `apps/teacher/src/App.tsx`、`apps/teacher/src/styles.css`                            |
| admin app        | `apps/admin/src/App.tsx`、`apps/admin/src/styles.css`                                |
| shared contracts | `packages/shared-contracts/src/index.ts`                                             |
| API routes       | `services/api/src/routes/foundation-routes.ts`、`round-routes.ts`、`audit-routes.ts` |
| tests            | `tests/e2e-ui/`、`tests/integration/`                                                |

### 具体改动

- 教师端增加 role assignment 视图：
  - 按 course/team/user 分配 `role_key`。
  - 展示未分配、重复分配、缺岗。
- 教师端增加 readiness dashboard：
  - 按 team 展示 `RoleDecisionSection.status`。
  - 展示 merge commit、team confirmation、canonical decision 状态。
- 教师端增强 lock preflight：
  - 锁轮前提示缺失 canonical decision 的队伍。
  - 展示缺失原因：未 ready、未 merge、未 confirm、未 submit。
- 教师端增加确认链路和审计证据查看。
- 管理端增加角色权限矩阵和 role governance 审计入口。
- 管理端展示 role-based access 与 entitlement 的关系，但不让 entitlement 写入真值字段。

### 风险

- 教师端如果提供“覆盖提交”能力，容易破坏团队确认链路，需要默认只允许退回或提示。
- 管理端权限矩阵如果与 shared contracts 不一致，会导致前后端裁剪冲突。
- 锁轮 preflight 错误信息不稳定会影响 E2E 和教师操作判断。

### 测试方式

```powershell
npm run typecheck
npm run build
npm run test:e2e:ui
npm test
```

### 验收标准

- 教师可以看清每队角色状态、merge 状态、confirmation 状态、canonical decision 状态。
- 锁轮前缺失 canonical decision 时明确阻止或返回结构化错误。
- 管理端只展示治理信息，不提供改写真值的入口。
- 教师端从开轮到发布结果的现有主流程仍通过。

## Phase 7：plugins 角色扩展与 wellness 示例

### 目标

为行业插件提供角色字段归属、角色 UI schema、角色 advisory scope 的扩展点，同时不改变 settlement hook 的真值保护边界。

### 涉及文件

| 类别              | 文件或目录                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| plugin manifest   | `plugins/wellness/plugin.manifest.json`                                                              |
| plugin schemas    | `contracts/schemas/plugin-manifest.v1.json`、`plugin-package.v1.json`、`wellness-parameters.v1.json` |
| simulation plugin | `services/simulation-core/src/wellness-plugin.ts`、`wellness-parameters.ts`                          |
| shared contracts  | `packages/shared-contracts/src/index.ts`                                                             |
| tests             | `tests/unit/simulation-core.test.ts`、contract/schema tests                                          |

### 具体改动

- 在 plugin manifest schema 中拟新增可选字段：
  - `role_extensions`
  - `field_ownership`
  - `role_validation_rules`
  - `kpi_ownership`
  - `role_ui_schema_ref`
  - `advisory_scope`
- wellness manifest 增加一个示例角色扩展，例如 `care_ops`，但不改变 settlement hook 行为。
- role extension 只能影响 role workspace、field policy、advisory scope 和学习反馈。
- `adjustDemand`、`adjustOperations`、`adjustFinance`、`adjustScore` 仍只返回结构化调整和 plugin trace。
- 确认插件 role extension 随 Run 绑定冻结，不允许运行期间热替换。

### 风险

- 插件扩展如果直接进入 simulation-core 输入，可能绕开 canonical decision。
- 插件角色字段如果没有 schema 校验，会导致前端动态表单和后端验证分叉。
- 插件变更如果未跑 Shadow Replay，可能影响历史结果解释。

### 测试方式

```powershell
npm run test:contract
npm run test:schema-drift
npm test -- --run tests/unit/simulation-core.test.ts
```

### 验收标准

- wellness role extension 可被 schema 校验。
- 插件 role extension 不改写 `state_true`、score、rank、settlement result、ledger。
- plugin trace 与 role evidence 可关联，但不污染 replay truth hash。
- simulation-core 现有 hook tests 仍通过。

## Phase 8：全链路 E2E、质量门禁与文档收口

### 目标

将分角色登录与角色化决策作为完整产品流程验证，确保文档、契约、代码、迁移、测试和前端体验一致。

### 涉及文件

| 类别             | 文件或目录                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| docs             | `docs/architecture/student-role-based-decision-refactor.md`、本文件、`docs/INDEX.md`             |
| frontend docs    | `docs/frontend/teacher-student-architecture.md`、`docs/frontend/frontend-state-flow.md`          |
| quality docs     | `docs/quality/phase-2-3-baseline-checklist.md`、`docs/quality/replay-shadow-replay-test-plan.md` |
| e2e tests        | `tests/e2e-ui/`、`tests/e2e/`                                                                    |
| all changed code | 前述阶段涉及的全部文件                                                                           |

### 具体改动

- 增加完整 E2E：
  - 教师创建或选择课程。
  - 分配团队角色。
  - 学生分别登录并保存 role section。
  - 学生 ready。
  - CEO merge。
  - 团队 confirmation。
  - canonical decision submit。
  - 教师锁轮、结算、发布。
  - 学生查看只读结果。
- 增加越权 E2E 或 integration：
  - 学生不能编辑他人角色字段。
  - 学生不能访问其他队伍 workspace。
  - 未确认 merge 不能 submit。
  - 发布后不能修改。
- 更新文档索引和相关架构/前端/质量文档。
- 运行完整本地门禁。

### 风险

- E2E 数据准备复杂，容易依赖本地 JSON store 状态。测试应使用隔离 fixture 或 memory store。
- 文档更新如果滞后，会让后续 Codex 按旧路径或旧契约开发。
- 完整门禁可能暴露既有 unrelated 失败，需要区分本次改动引入的问题和历史问题。

### 测试方式

```powershell
npm run format:check
npm run lint
npm run lint:boundaries
npm run check:unused
npm run security:audit
npm run typecheck
npm test
npm run test:coverage
npm run test:contract
npm run test:schema-drift
npm run test:migration
npm run test:postgres-adapter
npm run build
npm run test:e2e:ui
```

如本地具备测试数据库，再运行：

```powershell
npm run test:migration:apply
```

### 验收标准

- 完整角色化主流程通过 E2E。
- 所有新增 endpoint、type、schema、fixture、migration 和 UI 状态都有测试覆盖。
- Replay truth hash 不受 role draft、AI advisory、learning evidence 影响。
- 角色化插件扩展不破坏 settlement hook 和 Shadow Replay 边界。
- `npm run quality` 通过，或交付说明明确列出无法运行的门禁、原因和风险。

## 推荐开发顺序

建议按以下 PR 顺序推进：

| PR   | 范围                                                    | 退出条件                                   |
| ---- | ------------------------------------------------------- | ------------------------------------------ |
| PR 1 | Phase 0 核验记录和契约设计确认                          | 无业务代码变更，问题清单明确               |
| PR 2 | Phase 1 shared contracts / schemas / fixtures / OpenAPI | contract、schema drift、typecheck 通过     |
| PR 3 | Phase 2 migrations / repository ports / adapters        | migration、adapter tests 通过              |
| PR 4 | Phase 3 services API 和权限守卫                         | integration、contract、typecheck 通过      |
| PR 5 | Phase 4 settlement / Replay truth hash 收口             | replay、settlement、idempotency tests 通过 |
| PR 6 | Phase 5 apps/student 角色工作台                         | build、student E2E 通过                    |
| PR 7 | Phase 6 teacher/admin 治理视图                          | build、teacher E2E 通过                    |
| PR 8 | Phase 7 plugin 扩展                                     | plugin schema、simulation-core tests 通过  |
| PR 9 | Phase 8 全链路收口                                      | `npm run quality` 通过                     |

每个 PR 都必须在描述中说明：

- 本阶段是否触碰真值链路。
- 是否新增或修改契约。
- 是否新增 migration。
- 是否影响 Replay truth hash。
- 已运行的测试命令。
- 已知风险和回滚方式。
