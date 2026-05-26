# 学员端分角色决策体系 Phase 0 核验报告

> 依据：`docs/architecture/student-role-based-decision-refactor.md`、`docs/architecture/student-role-based-decision-implementation-plan.md`、当前 `apps/`、`packages/`、`services/`、`db/`、`contracts/`、`tests/` 工作区内容。
>
> 范围：Phase 0 仅做现状核验与契约确认。本报告未修改业务代码，未新增 migration，未修改 schema。

## 0. 核验结论

当前代码库已经具备分角色决策的核心链路骨架：

```text
RoleDecisionSection -> DecisionMergeCommit -> TeamConfirmation -> canonical Decision -> SettlementResult
```

其中 `RoleDecisionSection.status = "ready"` 承载 ready 状态；未发现独立的 `RoleReadyState` 类型、表或 schema。`RoleContext`、`RoleWorkspaceSnapshot`、`RoleReadinessSummary`、`role_assignment`、`role_field_policy`、`decision_merge_section_link` 等仍属于后续拟新增能力，当前代码库未落地。

总体判断：可以进入 Phase 1，但 Phase 1 应继续限定为契约和设计收敛，优先补齐角色上下文、角色分配、字段权限、readiness 汇总、fixture 与契约检查缺口；不应直接进入业务实现或 migration。

## 1. 当前核心定义位置

| 概念 | 当前定义位置 | 说明 |
| --- | --- | --- |
| `role_key` / `RoleKey` | `packages/shared-contracts/src/index.ts`：`TeamMember.role_slot`、`RoleKey = TeamMember["role_slot"]`；`contracts/schemas/role-decision-section.v1.json`；`db/migrations/20260519_002_create_repository_decision_tables.sql` | 当前角色枚举为 `CEO`、`CFO`、`CMO`、`COO`、`risk`。数据库在 `role_decision_section.role_key` 上使用 check constraint。 |
| `RoleDecisionSection` | `packages/shared-contracts/src/index.ts`；`contracts/schemas/role-decision-section.v1.json`；`contracts/fixtures/role-decision-section.valid.json`；`db/migrations/20260519_002_create_repository_decision_tables.sql` | 当前字段包含 `section_id`、tenant/run/round/team、`role_key`、`author_user_id`、`status: "draft" | "ready"`、`section_payload`、`payload_hash` 等。 |
| `DecisionMergeCommit` | `packages/shared-contracts/src/index.ts`；`contracts/schemas/decision-merge-commit.v1.json`；`contracts/fixtures/decision-merge-commit.valid.json`；`db/migrations/20260519_002_create_repository_decision_tables.sql` | 当前字段包含 `role_section_ids`、`canonical_decision_payload`、`merge_diff`、`validation_report`、`committed_by`、`status: "validated"`、`payload_hash`。 |
| `TeamConfirmation` | `packages/shared-contracts/src/index.ts`；`contracts/schemas/team-confirmation.v1.json`；`db/migrations/20260519_002_create_repository_decision_tables.sql` | 当前字段包含 `confirmation_id`、tenant/run/round/team、`merge_commit_id`、`confirmed_by`、`status: "confirmed"`。当前未发现 `contracts/fixtures/team-confirmation.valid.json`。 |
| canonical `Decision` | `packages/shared-contracts/src/index.ts`；`contracts/schemas/decision.v1.json`；`contracts/fixtures/decision.valid.json`；`db/migrations/20260519_002_create_repository_decision_tables.sql`；`services/api/src/routes/decision-routes.ts` | 当前 `Decision` 支持 `merge_commit_id`、`team_confirmation_id`、`canonical_source: "legacy_direct" | "role_merge_commit"`。当 `canonical_source = "role_merge_commit"` 时，API 从 merge commit 读取 canonical payload，避免客户端篡改正式决策。 |
| `SettlementResult` | `packages/shared-contracts/src/index.ts`；`contracts/schemas/settlement-result.v1.json`；`db/migrations/20260519_005_create_repository_ledger_replay_tables.sql`；`services/api/src/settlement-service.ts`；`services/simulation-core/src/` | 当前正式结算结果包含 tenant/run/round、parameter/scenario、engine、plugin trace、replay hash、team results。settlement service 使用 canonical decisions 生成正式结果，并保持重复结算幂等。 |

补充说明：

- `RoleReadyState` 当前不是独立核心实体。ready 状态落在 `RoleDecisionSection.status`，并通过 ready endpoint 和 `RoleReadyChanged` domain event 表达。
- `DecisionMergeCommit.role_section_ids` 当前是 `text[]`；没有发现独立 join table `decision_merge_section_link`。
- `decision.merge_commit_id`、`decision.team_confirmation_id` 当前是业务关联字段，不是严格外键。

## 2. 当前前端 apps 现状

### 2.1 `apps/student`

主要位置：`apps/student/src/App.tsx`。

当前已具备的角色决策相关内容：

- 页面状态集中在 `App.tsx`，包括 `state`、`session`、`decision`、`busy`、`notice`。
- 从 `state.role_decision_sections`、`state.decision_merge_commits`、`state.team_confirmations`、`state.decisions` 派生当前队伍的 role section、merge commit、confirmation 与 submitted decision。
- `chainSteps` 展示 `role draft`、`role ready`、`merge`、`confirm`、`official submit` 的链路进度。
- API 调用集中在 `submitRoleDecisionChain`：
  - `PUT /api/v1/runs/{runId}/rounds/{roundNo}/teams/{teamId}/role-sections/CEO`
  - `POST /api/v1/runs/{runId}/rounds/{roundNo}/teams/{teamId}/role-sections/CEO/ready`
  - `POST /api/v1/runs/{runId}/rounds/{roundNo}/teams/{teamId}/merge-commits`
  - `POST /api/v1/runs/{runId}/rounds/{roundNo}/teams/{teamId}/confirmations`
  - `POST /api/v1/runs/{runId}/rounds/{roundNo}/decisions`
- 学员端会随 canonical decision 提交 `merge_commit_id`、`team_confirmation_id`、`canonical_decision_payload`。

当前限制：

- 当前 UI 和 API 调用硬编码 `CEO`，没有角色选择、角色上下文门禁或多角色 workspace。
- 未发现 `role-context`、`role-workspace`、`readiness` 聚合 endpoint 的前端调用。
- 状态管理仍在单文件 `App.tsx` 内，未拆分角色上下文 hook、决策 workspace hook 或 readiness store。

### 2.2 `apps/teacher`

主要位置：`apps/teacher/src/App.tsx`。

当前已具备的角色决策相关内容：

- `teamDecisionStatus` 会读取 `state.decisions`，识别 `canonical_source === "role_merge_commit"` 的正式 canonical decision。
- `hasAllDecisions` 用于判断当前 round 是否所有团队已有 canonical decision。
- 教师端锁轮前会阻止缺少 canonical team decision 的 round 进入锁定。
- settle 调用走 `POST /api/v1/runs/{runId}/rounds/{roundNo}/settle`。
- 页面中会展示团队 canonical decision 状态、settlement 完成状态、Replay / Shadow Replay 与 advisory 调用结果。

当前限制：

- 教师端没有角色分配、角色字段权限、角色 ready 汇总、merge 审核或 confirmation 明细视图。
- 锁轮门禁当前以 canonical decision 是否存在为主，未展示每个 team 内部 role readiness 缺口。

### 2.3 `apps/admin`

主要位置：`apps/admin/src/App.tsx`。

当前与角色相关的内容主要是平台/租户 RBAC：

- `roleOptions` 使用的是 actor role / RBAC 角色，例如 `tenant_admin`、`teacher`、`learner`、`team_captain`、`scenario_designer`。
- 管理端展示 tenant、users、roles、permissions、entitlement、replay、audit timeline 等控制面信息。

当前限制：

- 未发现 admin 端对 `RoleKey`、role assignment、role field policy 或角色化决策链的管理页面。
- 当前 admin 角色概念与团队内业务角色 `CEO/CFO/CMO/COO/risk` 是两套不同语义，Phase 1 需要明确边界，避免混用。

## 3. 当前 services 现状

### 3.1 Route 层

| 文件 | 当前职责 |
| --- | --- |
| `services/api/src/routes/foundation-routes.ts` | 提供角色决策链路 route：list role sections、upsert role section、ready、merge commits、confirmations。 |
| `services/api/src/routes/decision-routes.ts` | 提供 official decision 提交。对 `canonical_source = "role_merge_commit"` 的提交，会校验 merge commit 与 team confirmation，并以 merge commit 的 canonical payload 为准。 |
| `services/api/src/routes/settlement-routes.ts` | 提供 public settle 与 internal settle route，调用 settlement command/service。 |

### 3.2 Service 层

| 文件 | 当前职责 |
| --- | --- |
| `services/api/src/foundation-services.ts` | 包含 `RoleDecisionRepository` 以及 role section upsert、ready、merge、confirmation 相关 command。merge 要求 team captain 权限，并只合并 ready sections。confirmation 会记录 team confirmation。 |
| `services/api/src/settlement-service.ts` | 创建和执行 settlement command，处理 locked/settled round、幂等、replay manifest、state snapshot、audit/domain event。 |
| `services/api/src/replay-service.ts` | 准备 settlement 输入，过滤 canonical decisions，并拒绝缺少 `merge_commit_id` 或 `team_confirmation_id` 的非 canonical / 不完整正式决策。 |
| `services/api/src/simulation.ts` | 解析 decision submission，支持 `decision_payload` 与 `canonical_decision_payload`，并过滤未知字段。 |

### 3.3 Repository / Adapter 层

| 文件 | 当前职责 |
| --- | --- |
| `services/api/src/repository-ports.ts` | 定义 decision、role section、merge commit、team confirmation、settlement 等 repository port。 |
| `services/api/src/repository-facade.ts` | 提供 route-facing facade，组合 demo state、settlement input context、latest decisions、merge refs、confirmations。 |
| `services/api/src/json-repository-adapter.ts` | 当前 JSON / memory adapter 的 decision、role section、merge commit、team confirmation 持久化实现。 |
| `services/api/src/postgres-repository-adapter.ts` | PostgreSQL adapter 草案，包含 decision、role section、merge commit、confirmation、settlement 等映射与 SQL 操作。 |

当前未发现独立的 `role-context` service、`role-workspace` service、`readiness` aggregation service 或 role field policy service。

## 4. 当前 db migration 相关表和字段

### 4.1 决策链表

来源：`db/migrations/20260519_002_create_repository_decision_tables.sql`。

| 表 | 关键字段 | 关系表达 |
| --- | --- | --- |
| `decision` | `decision_id`、`tenant_id`、`run_id`、`round_id`、`team_id`、`status`、`version`、`payload`、`validation_report`、`submitted_by`、`merge_commit_id`、`team_confirmation_id`、`canonical_source` | tenant/run/round/team 是严格外键；`merge_commit_id`、`team_confirmation_id` 当前不是严格外键，属于业务依赖引用。 |
| `role_decision_section` | `section_id`、tenant/run/round/team、`role_key`、`author_user_id`、`status`、`revision`、`section_payload`、`payload_hash` | tenant/run/round/team 是严格外键；`role_key` 通过 check constraint 限定。 |
| `decision_merge_commit` | `merge_commit_id`、tenant/run/round/team、`role_section_ids`、`canonical_decision_payload`、`merge_diff`、`validation_report`、`committed_by`、`status`、`payload_hash` | tenant/run/round/team 是严格外键；`role_section_ids` 是 `text[]`，没有严格 FK 到 `role_decision_section.section_id`。 |
| `team_confirmation` | `confirmation_id`、tenant/run/round/team、`merge_commit_id`、`confirmed_by`、`status` | tenant/run/round/team 是严格外键；`merge_commit_id` 严格 FK 到 `decision_merge_commit.merge_commit_id`。 |

### 4.2 结算与 Replay 表

来源：`db/migrations/20260519_005_create_repository_ledger_replay_tables.sql`。

| 表 | 关键字段 | 关系表达 |
| --- | --- | --- |
| `settlement_result` | `settlement_result_id`、tenant/run/round、`parameter_set_id`、`scenario_package_id`、`engine_id`、`plugin_trace`、`replay_hash`、`team_results` | tenant/run/round/parameter/scenario 是严格外键；tenant/run/round 有唯一约束，支撑结算幂等。 |
| `state_snapshot` | `snapshot_id`、tenant/run/round/team、`settlement_result_id`、`replay_hash`、`state_true`、`state_obs`、`state_est` | tenant/run/round/team 是严格外键；`settlement_result_id` 当前不是严格 FK。 |
| `replay_input_manifest` | `manifest_id`、tenant/run/round、`manifest_hash`、`manifest`、`domain_event_id` | tenant/run/round 是严格外键；`domain_event_id` 严格 FK 到 `domain_event`。 |
| `replay_diff_report` | `replay_report_id`、tenant/run/round、`settlement_result_id`、`manifest_hash`、`settlement_replay_hash`、`status` | tenant/run/round 是严格外键；`settlement_result_id` 当前不是严格 FK。 |

### 4.3 当前未发现的拟新增表

在当前 migrations 中未发现以下拟新增表或等价结构：

- `role_assignment`
- `role_field_policy`
- `decision_merge_section_link`
- `role_context_session`
- `role_contribution_evidence`
- `merge_conflict_log`
- `role_readiness_history`

## 5. 当前 contracts / schemas / fixtures / tests 覆盖情况

### 5.1 OpenAPI

来源：`contracts/openapi/p0-api.openapi.yaml`。

当前已定义路径：

- `GET /api/v1/runs/{runId}/rounds/{roundNo}/teams/{teamId}/role-sections`
- `PUT /api/v1/runs/{runId}/rounds/{roundNo}/teams/{teamId}/role-sections/{roleKey}`
- `POST /api/v1/runs/{runId}/rounds/{roundNo}/teams/{teamId}/role-sections/{roleKey}/ready`
- `POST /api/v1/runs/{runId}/rounds/{roundNo}/teams/{teamId}/merge-commits`
- `POST /api/v1/runs/{runId}/rounds/{roundNo}/teams/{teamId}/confirmations`
- `POST /api/v1/runs/{runId}/rounds/{roundNo}/decisions`
- `POST /api/v1/runs/{runId}/rounds/{roundNo}/settle`
- `POST /internal/v1/runs/{runId}/rounds/{roundNo}/settle`

当前未发现的拟新增路径：

- role context 获取 endpoint
- role workspace 获取 / 保存 endpoint
- readiness summary endpoint
- role assignment 管理 endpoint
- role field policy 管理 endpoint

### 5.2 JSON Schema

当前已发现相关 schema：

- `contracts/schemas/decision.v1.json`
- `contracts/schemas/role-decision-section.v1.json`
- `contracts/schemas/decision-merge-commit.v1.json`
- `contracts/schemas/team-confirmation.v1.json`
- `contracts/schemas/settlement-result.v1.json`
- `contracts/schemas/replay-input-manifest.v1.json`
- `contracts/schemas/replay-diff-report.v1.json`
- `contracts/schemas/state-snapshot.v1.json`

当前未发现拟新增 schema：

- `role-context`
- `role-workspace`
- `role-readiness-summary`
- `role-assignment`
- `role-field-policy`
- `decision-merge-section-link`

### 5.3 Fixtures

当前已发现相关 fixture：

- `contracts/fixtures/decision.valid.json`
- `contracts/fixtures/role-decision-section.valid.json`
- `contracts/fixtures/decision-merge-commit.valid.json`

当前缺口：

- 未发现 `contracts/fixtures/team-confirmation.valid.json`。
- 未发现 role context / role workspace / readiness summary / role assignment / role field policy 相关 fixture。

### 5.4 Contract check

来源：`scripts/check-contracts.mjs`。

当前已纳入 schema/type 对齐检查的核心类型包括 `Decision`、`RoleDecisionSection`、`DecisionMergeCommit`、`TeamConfirmation`、`SettlementResult` 等。

当前观察到的缺口：

- 必需 fixture 列表包含 `decision.valid.json`、`role-decision-section.valid.json`、`decision-merge-commit.valid.json`，但未包含 `team-confirmation.valid.json`。
- OpenAPI 路径存在 ready endpoint；contract check 的 required path 列表需要在 Phase 1 再确认是否完整覆盖 ready endpoint 和后续新增 endpoint。

### 5.5 Tests

当前已发现相关测试覆盖：

- `tests/integration/p0-flow.test.ts`
  - 覆盖 role section 保存、ready、merge、confirmation、canonical decision submit、settlement、重复 settlement 幂等。
- `tests/integration/p2-engineering-foundation.test.ts`
  - 覆盖未知字段拒绝、canonical payload 存储、settlement command、domain event、replayable state snapshot、多队伍多回合、canonical lock gate、角色 ownership、merge confirmation、客户端 payload 篡改防护、Replay / Shadow Replay、advisory-only guardrail。
- `tests/e2e/p1-frontdoor-smoke.test.ts`
  - 覆盖前门流程中的 role chain、canonical source、settlement。
- `tests/e2e-ui/sprint8-product-flow.spec.ts`
  - 覆盖教师端 / 学员端产品流中的 canonical decision 与 settlement 文案。
- `tests/unit/decision-schema.test.ts`
  - 覆盖 decision payload 字段过滤和 canonical payload 解析。
- `tests/unit/simulation-core.test.ts`
  - 覆盖 simulation-core 对 canonical decision、deterministic settlement、plugin trace、idempotency 的处理。
- `tests/contract/repository-adapter-contract.ts`
  - 覆盖 repository adapter 对 role sections、merge commits、team confirmations、canonical decisions、settlements、replay manifest 的契约。

当前未发现的测试覆盖：

- role context gate 测试。
- role workspace 状态隔离测试。
- readiness summary 聚合测试。
- role assignment / role field policy 权限矩阵测试。
- decision merge section link 的严格关联测试。
- team confirmation fixture 的 schema fixture 校验。

## 6. 拟新增能力与当前已有能力差距清单

| 能力 | 当前状态 | 差距 |
| --- | --- | --- |
| 角色草稿与 ready | 已有 `RoleDecisionSection.status = "draft" | "ready"`、ready endpoint、domain event | ready 仍是 role section 字段，不是独立状态实体；缺少 readiness 聚合视图。 |
| 角色 merge | 已有 `DecisionMergeCommit`、merge endpoint、team captain 权限、canonical payload 生成 | `role_section_ids` 不是严格 FK；缺少 `decision_merge_section_link`、merge conflict 记录和字段级合并策略。 |
| 团队确认 | 已有 `TeamConfirmation`、confirmation endpoint、schema、db 表 | 缺少 `team-confirmation.valid.json` fixture；缺少更细粒度的团队确认参与者 / quorum 规则。 |
| canonical Decision | 已有 `canonical_source`、merge/confirmation 引用、payload 篡改防护、Replay 输入过滤 | `decision.merge_commit_id`、`decision.team_confirmation_id` 不是严格 FK；legacy direct 与 role merge commit 的迁移策略仍需 Phase 1 明确。 |
| SettlementResult | 已有 settlement service、simulation-core、plugin trace、replay hash、幂等约束 | settlement 已消费 canonical decisions，但角色草稿、ready、merge 之外的上下文尚未纳入治理说明。 |
| `RoleContext` | 未发现 | 需要定义当前用户在 run/team/round 内的 role、权限、可见字段、可操作 action。 |
| `RoleWorkspaceSnapshot` | 未发现 | 需要定义学员端角色工作台的读取模型和缓存边界。 |
| `RoleReadinessSummary` | 未发现 | 需要定义教师端/学员端可显示的 team-level readiness 聚合。 |
| `role_assignment` | 未发现 | 需要决定团队成员到业务角色的持久化来源、唯一性、变更审计和 migration。 |
| `role_field_policy` | 未发现 | 需要定义角色到 decision payload 字段的可写/可读/建议权限。 |
| `decision_merge_section_link` | 未发现 | 如需严格追踪 merge commit 与 section 的关系，需要新增 join table 或等价结构。 |
| 前端角色化 workspace | 部分已有 | 学员端只有单文件流程和硬编码 `CEO`；教师端只看 canonical decision；admin 端暂无业务角色治理。 |
| 契约与 fixture | 部分已有 | 核心 schema 已有；拟新增能力无 schema/fixture；team confirmation fixture 缺失。 |
| 测试 | 核心链路已有较强覆盖 | 拟新增上下文、字段权限、readiness、角色分配、workspace 隔离尚无测试。 |

## 7. 是否可以进入 Phase 1

判断：可以进入 Phase 1，但仅限进入“契约与设计收敛”阶段，不建议直接开始业务代码改造。

理由：

- 当前核心链路 `RoleDecisionSection -> DecisionMergeCommit -> TeamConfirmation -> canonical Decision -> SettlementResult` 已经在 shared contracts、JSON schema、OpenAPI、services、db migration、fixtures 和多层测试中形成基础闭环。
- 当前代码已经明确避免把角色草稿或客户端篡改 payload 直接送入正式结算，Replay / settlement 侧也有 canonical decision 过滤。
- 当前缺口主要集中在角色上下文、字段权限、readiness 聚合、角色分配和严格关联表，这些正是 Phase 1 应先冻结的契约对象。

进入 Phase 1 前置要求：

- 明确 `RoleContext`、`RoleWorkspaceSnapshot`、`RoleReadinessSummary` 的类型边界和 endpoint 命名。
- 决定 `role_assignment`、`role_field_policy`、`decision_merge_section_link` 是否进入 migration 范围，以及是否需要先用 JSON/memory adapter 草案验证。
- 补齐或确认 `team-confirmation.valid.json` fixture 缺口。
- 确认 `scripts/check-contracts.mjs` 是否需要把 ready endpoint、team confirmation fixture 和 Phase 1 新增 schema/fixtures 纳入强校验。
- 明确 admin RBAC role 与团队业务 `RoleKey` 的命名边界，避免后续实现混用。

Phase 1 禁止项：

- 不应在未冻结契约前新增 migration。
- 不应在未定义字段权限前开放多角色写入。
- 不应让 role workspace、AI 建议或 readiness summary 进入正式 settlement truth hash。
- 不应改变 settlement 对 canonical decision 的唯一真值输入边界。
