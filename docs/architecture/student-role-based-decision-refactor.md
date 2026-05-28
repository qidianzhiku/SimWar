# 学员端分角色登录与角色化决策体系重构方案

建议保存路径：`docs/architecture/student-role-based-decision-refactor.md`

文档状态：Proposed

适用范围：`apps/student`、`apps/teacher`、`apps/admin`、`packages/shared-contracts`、`services/api`、`services/simulation-core`、`db/migrations`、`plugins`

依据：本文基于当前已经生成的 `apps`、`packages`、`services`、`db`、`plugins`、`docs` 知识图谱，以及 `docs/architecture/simwar-architecture-overview.md` 中整理的架构关系。本文只定义重构方案，不新增业务代码。

## 0. 能力状态标记

为避免把方案性概念误读为当前代码能力，本文统一使用以下状态标记：

| 标记           | 含义                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------- |
| 当前已有       | 已在当前 apps / packages / services / db / plugins 图谱或源码契约中出现，可作为现有基线理解 |
| 拟新增         | 本重构方案建议新增的 endpoint、type、table、UI 模块、插件扩展或测试覆盖                     |
| 需要进一步确认 | 方向合理，但进入实现前必须核对当前代码、schema、fixture、migration 或测试文件后再定稿       |

当前核心链路为：`RoleDecisionSection -> DecisionMergeCommit -> TeamConfirmation -> canonical Decision -> SettlementResult`。其中 `RoleDecisionSection`、`DecisionMergeCommit`、`TeamConfirmation`、canonical `Decision` 与 `SettlementResult` 是当前图谱和共享契约已经表达的主链路；本文涉及的 `RoleContext`、`RoleWorkspaceSnapshot`、`RoleReadinessSummary`、`role_assignment`、`role_field_policy`、`decision_merge_section_link` 等均为拟新增或待实现的方案性概念，不能理解为当前代码中已经存在。

## 1. 当前学员端现状

`apps` 图谱显示，当前学员端核心集中在 `apps/student/src/App.tsx`。它已经具备完整的 Phase 2/3 演示闭环：登录后读取 `/api/v1/demo-state`，围绕团队驾驶舱、结构化决策、角色决策区块、ready、merge commit、team confirmation、canonical decision 和 advisory-only 建议组织交互。

当前学员端已有以下能力：

- 使用 `/api/v1/auth/login` 建立会话，前端持有当前用户和权限信息。
- 读取课程、队伍、Run、Round、Decision、Settlement 的聚合演示态。
- 通过 `RoleDecisionSection` 保存角色决策区块，并以 `status=draft/ready` 表达角色区块状态。
- 通过 `DecisionMergeCommit` 生成团队候选 canonical decision。
- 通过 `TeamConfirmation` 完成团队确认。
- 通过 `/api/v1/runs/{runId}/rounds/{roundNo}/decisions` 提交正式 canonical team decision。
- 通过 `/api/v1/agents/advisory` 请求 mock advisory-only AI 输出，且不写入正式真值。

当前核心链路已经在图谱中成立：

```text
RoleDecisionSection(status=draft/ready)
  -> DecisionMergeCommit(status=validated)
  -> TeamConfirmation(status=confirmed)
  -> canonical Decision
  -> SettlementResult
```

这条链路是后续重构必须保护的基线。角色化登录、角色工作台、权限裁剪和插件扩展只能增强链路前后的上下文与体验，不能让角色草稿、AI 建议或未确认 merge 直接进入正式 settlement。

当前主要问题不是缺少角色字段，而是角色上下文尚未成为一等运行时模型：

- 登录会话回答的是“用户是谁”，但尚未稳定回答“用户在某门课、某个 run、某一轮、某支队伍中以哪个角色行动”。
- 角色化流程存在于单个前端主组件中，API 调用、状态派生、表单交互、权限提示和提交链路耦合较重。
- 角色职责、字段归属、可见范围、合并权限、确认权限和 AI 可见域还没有统一的共享契约表达。
- 当前 `RoleDecisionSection -> DecisionMergeCommit -> TeamConfirmation -> canonical Decision` 链路已经存在，但前端体验仍偏“团队表单 + 角色区块”，不是完整的角色工作台。
- 教师端已经覆盖锁轮、结算、发布、Replay、AI advisory 等操作，但对角色分配、角色 ready 概览、合并冲突、团队确认证据的可视化还需要增强。

必须保持的现有边界：

- 正式结算只消费团队确认后的 canonical decision。
- 角色草稿、AI 建议、评论、证据和未确认合并不得直接进入结算。
- 前端不得自行计算正式市场份额、利润、评分、排名或结算状态。
- AI 在 Phase 6 前只能是 advisory-only mock 输出，不得替学员 ready、merge、confirm 或 submit。

## 2. 目标角色模型

目标模型应把身份认证、课程身份、团队身份和角色身份拆开。认证层只证明用户身份；角色上下文层负责解析该用户在当前教学运行中的职责、权限、可见域和可提交范围。

拟新增或显式固化 `RoleContext` 运行时模型。当前 shared-contracts 和 route 图谱尚未显示独立的 `RoleContext` 类型或 `role-context` endpoint，因此实现前必须先补共享契约、schema、fixture 和 API 测试：

```ts
interface RoleContext {
  tenant_id: string;
  user_id: string;
  course_id: string;
  run_id: string;
  round_id: string;
  round_no: number;
  team_id: string;
  role_key: RoleKey;
  seat_id?: string;
  permissions: RolePermissionScope;
  editable_fields: string[];
  visible_scopes: string[];
  can_save_section: boolean;
  can_mark_ready: boolean;
  can_create_merge_commit: boolean;
  can_confirm_team_decision: boolean;
  can_submit_canonical_decision: boolean;
  expires_at: string;
}
```

默认角色沿用当前共享契约和数据库约束中的基础角色，这是当前已有基线：

| 角色   | 默认定位                   | 主要输入域                               | 关键权限                                                 |
| ------ | -------------------------- | ---------------------------------------- | -------------------------------------------------------- |
| `CEO`  | 队长 / 总经理 / 最终整合者 | 战略目标、跨职能约束、合并说明、最终确认 | 创建 merge commit、发起团队确认、提交 canonical decision |
| `CFO`  | 财务负责人                 | 预算、融资、现金流、成本控制             | 保存财务 section、标记 ready、参与确认                   |
| `CMO`  | 市场负责人                 | 定价、渠道、投放、品牌、需求假设         | 保存市场 section、标记 ready、参与确认                   |
| `COO`  | 运营负责人                 | 产能、库存、服务质量、执行计划           | 保存运营 section、标记 ready、参与确认                   |
| `risk` | 风险与合规负责人           | 风险缓释、合规动作、压力测试             | 保存风险 section、标记 ready、参与确认                   |

目标角色模型需要支持三类扩展，其中扩展机制属于拟新增能力：

- 课程扩展：教师可在课程内选择固定角色、轮换角色或混合角色。
- 插件扩展：行业插件可声明额外角色、字段归属和行业 KPI 解释，但必须通过受控 schema。
- 权限扩展：平台可区分编辑、只读、合并、确认、提交、查看结果、请求 AI advisory 等动作。

角色模型的核心原则：

- 当前已有：`RoleDecisionSection` 是角色输入的最小持久化单位。
- 当前已有：`DecisionMergeCommit` 是团队合并候选，不是正式结算输入。
- 当前已有：`TeamConfirmation` 是团队认可合并结果的审计凭据。
- 当前已有：`Decision` 是进入正式 settlement 的 canonical decision。
- 当前已有：`SettlementResult` 是正式结算输出，不应由前端、Agent 或插件直接写入。
- 拟新增：`RoleContext` 可以影响“能看什么、能改什么、能提交什么”，但不得绕过 canonical decision 链路。

## 3. 前端 apps 改造范围

### apps/student

学员端应从当前单一主组件承载的团队决策页，逐步重构为角色工作台。下表模块均为拟新增前端结构或拟拆分结构，不能理解为当前 `apps/student` 已存在这些组件文件：

| 模块                    | 目标           | 主要职责                                                         |
| ----------------------- | -------------- | ---------------------------------------------------------------- |
| `RoleContextGate`       | 进入角色上下文 | 登录后解析可用课程、队伍、run、round、role；多上下文时提供选择器 |
| `RoleWorkspace`         | 角色主工作台   | 展示当前角色可见数据、角色 KPI、待办、权限状态和轮次状态         |
| `RoleSectionEditor`     | 角色区块编辑   | 按 `editable_fields` 渲染表单，保存 `RoleDecisionSection`        |
| `RoleReadyPanel`        | ready 状态     | 显示本角色状态、同队其他角色 ready 摘要和锁轮前缺口              |
| `MergeCommitPanel`      | 合并候选       | CEO/队长查看区块差异、冲突、校验报告，创建 `DecisionMergeCommit` |
| `TeamConfirmationPanel` | 团队确认       | 成员确认合并结果，生成 `TeamConfirmation`                        |
| `CanonicalSubmitPanel`  | 正式提交       | 仅允许有权限的角色提交 canonical `Decision`                      |
| `RoleAdvisoryPanel`     | 角色化 AI 建议 | 以角色上下文裁剪输入，只生成 advisory 输出                       |
| `RoleResultView`        | 结果与复盘     | 发布后展示角色相关结果、贡献证据、复盘建议和只读历史             |

前端实现约束：

- 表单字段必须来自共享契约或后端下发的 role UI schema，不在前端硬编码正式业务真值。
- 前端可以做即时校验和提示，但后端仍必须重新校验权限、schema、状态机和真值字段。
- 角色区块保存、ready、merge、confirm、canonical submit 应拆成明确 command，避免一个按钮隐式完成多步。
- 所有正式结果页只展示后端发布的结果裁剪视图，不自行复算 settlement。
- advisory 结果必须视觉上和正式决策、正式结果区分，且默认落入草稿或证据链，不直接写 canonical decision。

### apps/teacher

教师端当前已有课程、队伍、Run/Round 控制、锁轮、结算、发布、Replay/Shadow Replay、AI advisory、数据政策和案例候选流程。下列角色化班级运营能力属于拟新增或待增强：

- 角色模板选择和团队角色分配。
- 每轮各队各角色 `RoleDecisionSection(status=draft/ready)` 概览。
- 锁轮前 preflight：检查每队是否存在 validated `DecisionMergeCommit`、confirmed `TeamConfirmation` 和可结算 canonical `Decision`。
- 合并冲突、缺岗、迟交、确认缺失的教师端提示。
- 发布结果后的角色贡献、团队确认链路和审计证据查看。

教师端仍不得修改正式 settlement result。教师可触发锁轮、结算和发布，但正式结果仍来自 `SettlementRoutes -> settlement-service -> simulation-core`。

### apps/admin

管理端不是角色化决策主入口。当前管理端已有租户、用户、权益、审计、Replay 等控制面能力；下列角色治理视图属于拟新增或待增强：

- 查看租户级角色权限矩阵和功能开关。
- 查看 role-based access 与 entitlement 的关系，但 entitlement 只控制访问和额度。
- 查看角色化决策链相关审计事件、Replay 和 Shadow Replay 治理结果。

### 前端共享改造

建议沉淀共享前端能力。下列 client、hooks、guard 和组件均为拟新增或拟抽象能力：

- role context API client。
- role decision command hooks。
- role-aware permission guard。
- role status badge 和 merge status badge。
- contract-driven form renderer 的最小封装。
- advisory-only 输出组件和正式结果组件的视觉隔离规范。

## 4. packages/shared-contracts 类型改造

`packages` 图谱显示，`@simwar/shared-contracts` 已经是 API、前端、测试和仿真边界的共同语义层。角色化重构必须先改共享契约，再改 API 和前端。

当前已有关键类型：

- `ActorRole`
- `PermissionKey`
- `AuthSession`
- `CurrentUser`
- `DecisionPayload`
- `Decision`
- `RoleKey`
- `RoleDecisionSection`
- `DecisionMergeCommit`
- `TeamConfirmation`
- `SettlementResult`
- `ReplayInputManifest`
- `CoachOutput`
- `ModelCallLog`
- `AgentRequest`
- `AgentResponse`

建议新增或强化以下类型。状态列为“拟新增”的类型当前不能按已存在处理；状态列为“需要进一步确认”的类型应先核对 `packages/shared-contracts/src/index.ts`、`contracts/schemas/` 和 fixtures 后再实现：

| 类型                       | 状态           | 用途                                                                 |
| -------------------------- | -------------- | -------------------------------------------------------------------- | ------------------------------------------- |
| `RoleContext`              | 拟新增         | 用户在具体 course/run/round/team/role 下的运行时上下文               |
| `RolePermissionScope`      | 拟新增         | 动作权限、字段权限、可见域和提交权限                                 |
| `RoleSectionStatus`        | 需要进一步确认 | 当前 `RoleDecisionSection.status` 为 `draft                          | ready`；`returned`、`locked` 属于拟扩展状态 |
| `RoleFieldOwnership`       | 拟新增         | 字段到角色的归属和协作规则                                           |
| `RoleWorkspaceSnapshot`    | 拟新增         | 学员端角色工作台聚合视图                                             |
| `RoleReadinessSummary`     | 拟新增         | 队伍内各角色 section 和确认状态摘要                                  |
| `MergeConflict`            | 拟新增         | 跨角色字段冲突、预算冲突、约束冲突和缺失项                           |
| `MergeValidationReport`    | 需要进一步确认 | 当前 `DecisionMergeCommit` 已有校验语义；是否独立成类型需核对 schema |
| `TeamConfirmationPolicy`   | 拟新增         | 团队确认策略，如全员确认、CEO 确认、教师覆盖                         |
| `CanonicalDecisionSource`  | 拟新增         | `Decision` 来源，区分手工提交、merge commit、系统迁移或测试 fixture  |
| `RoleContributionEvidence` | 拟新增         | 保存、评论、引用 AI 建议、确认、复盘等学习证据                       |
| `RoleAdvisoryContext`      | 拟新增         | AI advisory 的角色裁剪输入                                           |
| `RoleAdvisoryResult`       | 拟新增         | 角色化 advisory 输出，最终仍映射到 `CoachOutput` / `ModelCallLog`    |

对现有类型的调整建议：

- 当前已有核心链路类型：`RoleDecisionSection`、`DecisionMergeCommit`、`TeamConfirmation`、canonical `Decision`、`SettlementResult`。
- `RoleDecisionSection` 当前已有 `role_key`、payload 和 `status=draft|ready` 语义；`validation_report`、`updated_by`、`ready_at`、`locked_at` 需要先核对当前源码与 schema 后再决定是否新增。
- 保留 `RoleReadyState` 说明，但不把 `RoleReadyState` 作为独立核心实体传播；ready 应作为 `RoleDecisionSection.status` 或事件表达，避免误导为独立真值链节点。
- `DecisionMergeCommit` 当前已有 `role_section_ids`、`canonical_decision_payload`、`diff`、`validation_report` 和 `status=validated` 语义；`rejected`、`superseded` 属于拟扩展状态。
- `TeamConfirmation` 当前已有 `merge_commit_id`、`confirmed_by` 和 `status=confirmed` 语义；`rejected`、`revoked` 属于拟扩展状态。
- `Decision` 增加或固化 `merge_commit_id`、`team_confirmation_id`、`source`、`status`、`submitted_by`，以追溯 canonical decision 来源；其中哪些字段已经存在必须在实施前逐项核对。
- `ReplayInputManifest` 保持只纳入 canonical decisions、scenario、parameter set、teams、engine、plugin ids、seed；角色草稿、AI 建议和学习证据只能进入 `excluded_from_truth_hash` 或治理上下文。

同步改造要求：

- 更新 `contracts/schemas/role-decision-section.v1.json`、`decision-merge-commit.v1.json`、`team-confirmation.v1.json`、`decision.v1.json`。
- 补充 `contracts/fixtures/*` 中的角色化样例。
- 更新 contract tests 和 schema drift tests，确保共享类型、JSON Schema、fixtures 和 OpenAPI 保持一致。

## 5. services API 改造

`services` 图谱显示，当前 API 已按 route/service/repository 分层，角色化相关能力主要落在 `FoundationRoutes`、`DecisionRoutes`、`RoundRoutes`、`SettlementRoutes`、`AgentRoutes` 和 repository facade。

建议维持现有 route group，不新增绕过式 BFF 服务。可以在现有路径基础上补齐角色上下文和聚合查询。下表明确标注 endpoint 状态；拟新增 endpoint 必须先补 OpenAPI、shared contracts、schema/fixture 和 route tests。

### Role context 与 workspace

| Endpoint                                                                  | 状态   | Route group        | Contract                | 说明                                         |
| ------------------------------------------------------------------------- | ------ | ------------------ | ----------------------- | -------------------------------------------- |
| `GET /api/v1/runs/{runId}/rounds/{roundNo}/teams/{teamId}/role-context`   | 拟新增 | `FoundationRoutes` | `RoleContext`           | 解析当前用户在队伍和轮次中的角色上下文       |
| `GET /api/v1/runs/{runId}/rounds/{roundNo}/teams/{teamId}/role-workspace` | 拟新增 | `FoundationRoutes` | `RoleWorkspaceSnapshot` | 返回角色工作台聚合视图，按权限裁剪           |
| `GET /api/v1/runs/{runId}/rounds/{roundNo}/teams/{teamId}/readiness`      | 拟新增 | `FoundationRoutes` | `RoleReadinessSummary`  | 返回队伍角色 ready、merge、confirmation 摘要 |

### Role section command

| Endpoint                                                                                | 状态             | Route group        | Contract              | 说明                                                                    |
| --------------------------------------------------------------------------------------- | ---------------- | ------------------ | --------------------- | ----------------------------------------------------------------------- |
| `PUT /api/v1/runs/{runId}/rounds/{roundNo}/teams/{teamId}/role-sections/{role}`         | 当前已有核心命令 | `FoundationRoutes` | `RoleDecisionSection` | 保存角色区块草稿                                                        |
| `POST /api/v1/runs/{runId}/rounds/{roundNo}/teams/{teamId}/role-sections/{role}/ready`  | 需要进一步确认   | `FoundationRoutes` | `RoleDecisionSection` | 当前 ready 可由 section status 表达；是否已有独立 endpoint 需核对 route |
| `POST /api/v1/runs/{runId}/rounds/{roundNo}/teams/{teamId}/role-sections/{role}/return` | 拟新增           | `FoundationRoutes` | `RoleDecisionSection` | CEO 或教师退回 section，可选 P1 能力                                    |

### Merge、confirmation 与 canonical decision

| Endpoint                                                                  | 状态             | Route group        | Contract              | 说明                                   |
| ------------------------------------------------------------------------- | ---------------- | ------------------ | --------------------- | -------------------------------------- |
| `POST /api/v1/runs/{runId}/rounds/{roundNo}/teams/{teamId}/merge-commits` | 当前已有核心命令 | `FoundationRoutes` | `DecisionMergeCommit` | 创建候选 canonical decision 和校验报告 |
| `POST /api/v1/runs/{runId}/rounds/{roundNo}/teams/{teamId}/confirmations` | 当前已有核心命令 | `FoundationRoutes` | `TeamConfirmation`    | 团队确认合并结果                       |
| `POST /api/v1/runs/{runId}/rounds/{roundNo}/decisions`                    | 当前已有核心命令 | `DecisionRoutes`   | `Decision`            | 提交正式 canonical decision            |

### Settlement、Replay 与 AI

| Endpoint                                               | 状态                                       | Route group        | Contract                                                       | 说明                                        |
| ------------------------------------------------------ | ------------------------------------------ | ------------------ | -------------------------------------------------------------- | ------------------------------------------- |
| `POST /api/v1/runs/{runId}/rounds/{roundNo}/settle`    | 当前已有核心命令                           | `SettlementRoutes` | `SettlementResult`、`ReplayInputManifest`                      | 只消费 validated canonical decision         |
| `POST /api/v1/replays` / `POST /api/v1/shadow-replays` | 当前已有治理能力                           | `ReplayRoutes`     | `ReplayRun`、`ReplayReport`、`ReplayDiffReport`                | 使用历史 canonical 输入重放，不覆盖正式结果 |
| `POST /api/v1/agents/advisory`                         | 当前已有 advisory 入口，角色化裁剪为拟增强 | `AgentRoutes`      | `AgentRequest`、`AgentResponse`、`CoachOutput`、`ModelCallLog` | 角色化裁剪 advisory，只读授权上下文         |

后端强制校验：

- `requireActor`：所有写操作必须有登录 actor。
- `requirePermission`：检查 actor 是否具备角色化动作权限。
- 租户隔离：所有路径参数和实体必须属于同一 `tenant_id`。
- 队伍成员校验：学生只能访问自己所属队伍和被分配角色。
- 回合状态机：已锁定或已发布 round 不允许修改 role section、merge、confirmation 或 decision。
- 字段归属校验：角色只能写自己可编辑字段；CEO 合并也必须留下 diff 和来源。
- 真值字段黑名单：请求体不得包含 market share、profit、score、rank、settlement status 等真值字段。
- 审计和事件：保存、ready、merge、confirm、submit、settle 都必须追加审计或 domain event。

## 6. db 表结构或 migration 改造

`db` 图谱显示，当前 migration 已有角色化决策核心表：

- `role_decision_section`
- `decision_merge_commit`
- `team_confirmation`
- `decision`
- `settlement_result`
- `state_snapshot`
- `replay_input_manifest`
- `auth_session`
- `simwar_user`

其中 `role_decision_section`、`decision_merge_commit`、`team_confirmation`、`decision` 与 `settlement_result` 构成当前核心链路的数据落点。下文出现的 `role_assignment`、`role_field_policy`、`decision_merge_section_link`、`role_context_session`、`role_contribution_evidence`、`merge_conflict_log`、`role_readiness_history` 都是拟新增或待评估表，不是当前 migration 已有表。

现有表已经能支撑最小链路，但要支持“分角色登录 + 角色工作台 + 可审计合并”，建议分两层推进。

### 第一层：收紧现有表语义

建议在后续 migration 或 repository contract 中明确：

- `role_decision_section` 以 `tenant_id + run_id + round_id + team_id + role_key` 唯一定位当前有效区块。
- `role_decision_section.status` 使用 `draft`、`ready`、`returned`、`locked` 等枚举，并记录 `updated_by`、`ready_at`。
- `decision_merge_commit` 保存 `canonical_decision_payload`、`role_section_ids`、`diff`、`validation_report`、`created_by` 和 `status`。
- `team_confirmation` 必须引用 `decision_merge_commit`，并记录确认人、确认策略和确认状态。
- `decision` 应追溯 `merge_commit_id` 和 `team_confirmation_id`。

架构总览中已经指出，当前 migration 中存在需要后续硬化的关系：

- `team_confirmation` 已严格引用 `decision_merge_commit`。
- `decision.merge_commit_id` 和 `decision.team_confirmation_id` 当前属于业务引用，建议后续升级为严格外键。
- `decision_merge_commit.role_section_ids` 当前是 `text[]`，无法对数组内每个元素施加外键；可保留为快照引用，也可新增 join table。
- `state_snapshot.settlement_result_id`、`replay_diff_report.settlement_result_id` 更偏业务引用，需要根据 repository adapter 目标决定是否强制外键。

### 第二层：新增角色上下文与证据表

建议新增或规划以下表：

| 表                            | 状态                    | 用途                                                                                              | 阶段 |
| ----------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------- | ---- |
| `role_assignment`             | 拟新增                  | 课程 / run / team / user 到 `role_key` 的分配                                                     | P0   |
| `role_context_session`        | 拟新增 / 可选           | 记录短生命周期角色上下文和切换审计                                                                | P1   |
| `role_field_policy`           | 拟新增                  | 角色可编辑字段、只读字段和合并策略                                                                | P0   |
| `role_contribution_evidence`  | 拟新增                  | 保存角色保存、ready、评论、采纳 AI、确认等学习证据                                                | P1   |
| `decision_merge_section_link` | 拟新增                  | 替代 `role_section_ids text[]` 的严格 join table                                                  | P1   |
| `merge_conflict_log`          | 拟新增                  | 保存合并冲突和处理结果                                                                            | P1   |
| `role_readiness_history`      | 拟新增 / 需要进一步确认 | 记录 ready / return / lock 的历史状态；若 ready 只保留在 `RoleDecisionSection.status`，该表可不建 | P1   |

索引和约束建议：

- `role_assignment(tenant_id, course_id, team_id, user_id, role_key)` 唯一或按轮次唯一。
- `role_decision_section(tenant_id, run_id, round_id, team_id, role_key)` 唯一。
- `decision_merge_commit(tenant_id, run_id, round_id, team_id, status)` 建索引。
- `team_confirmation(tenant_id, run_id, round_id, team_id, merge_commit_id, confirmed_by)` 建唯一或幂等键。
- `decision(tenant_id, run_id, round_id, team_id)` 对正式 canonical decision 保持幂等约束。
- 所有角色化表必须带 `tenant_id`，并在 Postgres adapter 中配合 RLS 或 repository 层租户过滤。

## 7. decision、merge、confirmation、settlement 链路影响

当前核心链路必须固定为：

```text
RoleDecisionSection(status=draft/ready)
  -> DecisionMergeCommit(status=validated)
  -> TeamConfirmation(status=confirmed)
  -> canonical Decision(status=submitted/validated)
  -> official SettlementResult
```

各节点职责：

| 节点                  | 状态             | 输入                                                                   | 输出                                   | 是否进入正式结算 |
| --------------------- | ---------------- | ---------------------------------------------------------------------- | -------------------------------------- | ---------------- |
| `RoleDecisionSection` | 当前已有核心链路 | 角色表单、角色 AI 建议采纳、证据                                       | 角色 section payload 和 ready 状态     | 否               |
| `DecisionMergeCommit` | 当前已有核心链路 | 多个 ready section、字段归属、冲突处理                                 | 候选 canonical payload、diff、校验报告 | 否               |
| `TeamConfirmation`    | 当前已有核心链路 | merge commit、确认策略、成员确认                                       | confirmed audit record                 | 否               |
| canonical `Decision`  | 当前已有核心链路 | confirmed merge commit                                                 | 正式 canonical decision payload        | 是               |
| `SettlementResult`    | 当前已有核心链路 | canonical decisions、scenario、parameter set、plugin ids、engine、seed | 正式结果、快照、manifest               | 结果输出         |

链路影响：

- 锁轮前校验应从“是否有 decision”升级为“每队是否存在可结算 canonical decision，且可追溯到 validated merge commit 和 confirmed team confirmation”。
- 如果角色区块未 ready，系统可以阻止 merge，也可以允许 CEO 创建带缺口报告的 merge commit；是否允许进入正式提交由课程策略决定。该策略属于拟新增或待配置能力。
- 如果 team confirmation 未满足策略，`DecisionRoutes` 不得接受 canonical decision。
- `SettlementRoutes` 和 `settlement-service` 不应读取 role section 或 AI advisory 作为结算输入。
- `ReplayInputManifest` 的 truth hash 只纳入 canonical decision；角色草稿、证据、AI 建议、确认记录可作为治理上下文或 `excluded_from_truth_hash`。
- 发布后的 round/result 保持只读，不得重新 settle 或修改正式结果。
- 重复 settle 必须幂等，返回同一正式结果或稳定 replay hash。

建议增加链路状态矩阵：

| Round 状态  | Role section   | Merge commit | Team confirmation | Decision    | 允许动作                | 状态说明                      |
| ----------- | -------------- | ------------ | ----------------- | ----------- | ----------------------- | ----------------------------- |
| `open`      | `draft`        | 无           | 无                | 无          | 保存 section            | 当前已有基础链路              |
| `open`      | `ready`        | 无           | 无                | 无          | 创建 merge commit       | 当前已有基础链路              |
| `open`      | `ready`        | `validated`  | 无                | 无          | 团队确认                | 当前已有基础链路              |
| `open`      | `ready/locked` | `validated`  | `confirmed`       | 无          | 提交 canonical decision | `locked` section 状态为拟扩展 |
| `locked`    | `locked`       | `validated`  | `confirmed`       | `validated` | 结算                    | `locked` section 状态为拟扩展 |
| `published` | 只读           | 只读         | 只读              | 只读        | 查看结果与 Replay       | 当前发布后只读原则            |

## 8. plugins 对角色化决策的扩展方式

`plugins` 图谱显示，当前 wellness 插件通过 `plugin.manifest.json` 声明元数据、审批状态、参数 schema、adapter ref 和白名单 settlement hook。现有 hook 包括：

- `adjustDemand`
- `adjustOperations`
- `adjustFinance`
- `adjustScore`

角色化扩展应遵守同一插件治理边界：插件可以增加行业语义和 UI/schema 扩展，但不能跳过核心链路写正式真值。下表扩展点均为拟新增插件 manifest / schema 能力，当前 wellness manifest 已有的是 approved 生命周期、参数 schema、adapter ref 和四个白名单 settlement hook。

建议为插件增加以下可选扩展点：

| 扩展点                  | 状态   | 用途                                           | 真值边界                 |
| ----------------------- | ------ | ---------------------------------------------- | ------------------------ |
| `role_extensions`       | 拟新增 | 声明行业专属角色，如康养运营负责人、合规负责人 | 不直接影响 settlement    |
| `field_ownership`       | 拟新增 | 声明角色对行业字段的编辑权和协作权             | 只影响权限和 merge       |
| `role_validation_rules` | 拟新增 | 声明角色 section 的行业校验规则                | 阻止非法输入，不产出真值 |
| `kpi_ownership`         | 拟新增 | 将行业 KPI 解释绑定到角色                      | 只影响反馈和学习证据     |
| `role_ui_schema_ref`    | 拟新增 | 提供角色表单 schema 引用                       | 前端渲染辅助             |
| `advisory_scope`        | 拟新增 | 约束角色化 AI 可读取字段                       | 只影响 advisory 输入裁剪 |

示例：

```json
{
  "role_extensions": [
    {
      "role_key": "care_ops",
      "role_name": "康养运营负责人",
      "field_ownership": ["service_quality_budget", "capacity_plan"],
      "kpi_ownership": ["service_quality", "capacity_utilization"],
      "role_ui_schema_ref": "plugin://wellness/roles/care-ops.v1",
      "advisory_scope": ["state_obs.operations", "state_est.demand"]
    }
  ]
}
```

插件必须遵守：

- 插件扩展角色后，仍通过当前核心链路 `RoleDecisionSection -> DecisionMergeCommit -> TeamConfirmation -> canonical Decision -> SettlementResult` 进入正式输入和结果输出。
- 插件不得直接写 `state_true`、score、rank、settlement result、ledger 或 replay truth hash。
- 插件 role extension 必须随 `PluginPackage`、`ScenarioPackage` 和 `ParameterSet` 在 Run 绑定时冻结。
- 插件字段、参数、评分规则或 engine adapter 变化必须通过 Shadow Replay 验证。
- 插件 trace 可以解释 hook 调整，但不能替代 canonical decision 审计链。

## 9. 权限边界

角色化重构必须把权限拆成五层：

| 权限层         | 控制问题                     | 典型检查点                                   |
| -------------- | ---------------------------- | -------------------------------------------- |
| 身份认证       | 用户是谁                     | `AuthSession`、JWT/session、`CurrentUser`    |
| 租户隔离       | 用户属于哪个租户             | `tenant_id` 一致性、RLS/repository filter    |
| 课程与队伍成员 | 用户是否属于该课程和队伍     | course/team membership                       |
| 角色上下文     | 用户在当前轮次以哪个角色行动 | `role_assignment`、`RoleContext`，均为拟新增 |
| 字段和动作权限 | 能看什么、改什么、提交什么   | `RolePermissionScope`、`PermissionKey`       |

学生侧默认权限：

- 学生只能读取自己课程、自己队伍、当前或已发布 round 的授权视图。
- 学生只能编辑自己角色拥有的 `RoleDecisionSection` 字段；字段归属策略依赖拟新增的 `role_field_policy` 或等价共享配置。
- 学生可以查看同队其他角色 ready 摘要，但不默认拥有修改权。
- CEO/队长可以创建 `DecisionMergeCommit`，但必须保留 diff 和来源。
- 团队确认必须满足课程策略；未确认不得提交 canonical decision。
- 学生不得读取未授权 `state_true`、对手未发布策略、其他队伍草稿、未脱敏案例或教师私有备注。

教师侧默认权限：

- 教师可以查看所授课程内队伍、角色状态、合并状态、确认状态和正式结果。
- 教师可以配置角色策略、分配角色、锁轮、触发结算和发布结果。
- 教师不得直接修改 settlement truth、score、rank 或已发布结果。
- 教师覆盖或退回角色区块必须产生审计事件。

系统和 Agent 权限：

- `service_kernel` 是正式 settlement 的服务账号边界，只能由受控后端链路创建。
- Agent 只能读取角色裁剪后的上下文，输出 advisory、candidate、draft 或 event log。
- AI 输出不得执行 ready、merge、confirm、submit、settle 或 publish。
- 所有 Agent 调用必须记录 `ModelCallLog`，所有输出必须落入 `CoachOutput` 或等价 advisory contract。

## 10. 测试计划

文档落地后的测试需要覆盖契约、服务、数据库、前端和安全边界。

### Contract 与 schema 测试

- `RoleContext`、`RolePermissionScope`、`RoleWorkspaceSnapshot` 的 JSON Schema 校验。
- `RoleDecisionSection` ready 状态 fixture；`returned` / `locked` 属于拟扩展状态，实施前必须先更新类型和 schema。
- `DecisionMergeCommit` diff、validation report fixture；conflict 独立结构属于拟新增能力。
- `TeamConfirmation` confirmed fixture；`rejected` 属于拟扩展状态，实施前必须先更新类型和 schema。
- `Decision` 追溯 `merge_commit_id` 和 `team_confirmation_id` 的 fixture。
- OpenAPI 与 shared contracts drift 检查。

推荐命令：

```powershell
npm run typecheck
npm run test:contract
npm run test:schema-drift
```

### API 与服务集成测试

- 学生只能保存自己角色 section。
- 学生不能保存其他角色 section。
- CEO 可以创建 merge commit，非授权角色不能创建。
- 未 ready 或未通过校验的 section 进入 merge 时产生结构化 conflict。
- 未 confirmed 的 merge commit 不能生成正式 canonical decision。
- 已 locked / published round 拒绝修改 role section、merge 和 confirmation。
- Settlement 只读取 canonical decision，不读取 role draft 或 advisory。
- 重复 submit / confirm / settle 保持幂等。

推荐命令：

```powershell
npm test
npm run test:contract
```

### DB migration 与 adapter 测试

- `role_assignment`、`role_field_policy`、`decision_merge_section_link` 等拟新增表 migration apply。
- 外键、唯一键、check 约束和索引验证。
- JSON adapter 与 Postgres adapter 对角色化 repository port 行为一致。
- RLS 或 repository filter 防止跨租户、跨课程、跨队伍访问。

推荐命令：

```powershell
npm run test:migration
npm run test:migration:apply
npm run test:postgres-adapter
```

### 前端 E2E 测试

- 学生登录后进入角色上下文选择或角色工作台。
- CFO 保存财务 section 并 ready。
- CMO / COO 保存各自 section 并 ready。
- CEO 查看 readiness summary，创建 merge commit。
- 团队成员确认后提交 canonical decision。
- 教师锁轮、结算、发布结果。
- 发布后学员端只读展示结果和角色复盘。
- 非授权角色尝试编辑他人字段时 UI 阻止，API 也拒绝。

推荐命令：

```powershell
npm run test:e2e:ui
npm run build
```

### 安全与真值保护测试

- 请求体包含 `state_true`、score、rank、profit 等真值字段时拒绝。
- advisory 输出试图写 canonical decision 时拒绝。
- 跨队伍读取 role section 拒绝。
- 跨租户访问 workspace 拒绝。
- 未发布结果、对手策略、私密反思和未脱敏案例不泄露。
- Replay truth hash 不受 role draft、AI advisory、学习证据影响。

推荐完整门禁：

```powershell
npm run quality
```

## 11. 实施前代码核验清单

进入业务代码重构前，必须先完成以下只读核验，并把核验结果写入对应开发任务或 PR 描述。目标是确认哪些能力已经存在、哪些属于拟新增、哪些需要先调整契约后才能实现。

### Endpoint 核验

| 项目                                            | 需要确认的文件或目录                                                                     | 结论要求                                                                          |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `role-sections/{role}` 保存接口                 | `services/api/src/routes/foundation-routes.ts`、OpenAPI                                  | 确认 method、路径参数、请求体、幂等键和权限检查                                   |
| `role-sections/{role}/ready`                    | `services/api/src/routes/foundation-routes.ts`、OpenAPI                                  | 确认是否已有独立 ready endpoint；若没有，明确通过 PUT status 更新还是新增 command |
| `merge-commits`                                 | `services/api/src/routes/foundation-routes.ts`、OpenAPI                                  | 确认 `DecisionMergeCommit` 创建路径、校验报告和审计事件                           |
| `confirmations`                                 | `services/api/src/routes/foundation-routes.ts`、OpenAPI                                  | 确认 `TeamConfirmation` 创建路径、确认人和幂等策略                                |
| `decisions`                                     | `services/api/src/routes/decision-routes.ts`、OpenAPI                                    | 确认 canonical `Decision` 是否追溯 merge commit 和 confirmation                   |
| `settle`                                        | `services/api/src/routes/settlement-routes.ts`、`services/api/src/settlement-service.ts` | 确认 settlement 只读取 canonical decision                                         |
| `role-context` / `role-workspace` / `readiness` | 尚未确认，拟新增                                                                         | 若决定实现，先补 OpenAPI、contract、schema、fixture、route tests                  |

### Type 与 schema 核验

| 项目                                                             | 需要确认的文件或目录                                                                        | 结论要求                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------- |
| `RoleKey`                                                        | `packages/shared-contracts/src/index.ts`、`contracts/schemas/role-decision-section.v1.json` | 确认当前枚举为 `CEO`、`CFO`、`CMO`、`COO`、`risk`                                |
| `RoleDecisionSection`                                            | `packages/shared-contracts/src/index.ts`、`contracts/schemas/role-decision-section.v1.json` | 确认现有字段、`status=draft                                                      | ready` 和 fixture |
| `DecisionMergeCommit`                                            | `packages/shared-contracts/src/index.ts`、`contracts/schemas/decision-merge-commit.v1.json` | 确认现有字段、`status=validated`、diff 和 validation report 表达                 |
| `TeamConfirmation`                                               | `packages/shared-contracts/src/index.ts`、`contracts/schemas/team-confirmation.v1.json`     | 确认现有字段、`status=confirmed` 和 `merge_commit_id`                            |
| `Decision`                                                       | `packages/shared-contracts/src/index.ts`、`contracts/schemas/decision.v1.json`              | 确认是否已有 `merge_commit_id`、`team_confirmation_id`、`source`、`submitted_by` |
| `RoleContext` / `RoleWorkspaceSnapshot` / `RoleReadinessSummary` | 拟新增                                                                                      | 先定义 shared type，再同步 schema、fixture、OpenAPI 和前端 client                |

### Table 与 migration 核验

| 项目                                                                    | 需要确认的文件或目录                                                    | 结论要求                                                                      |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `role_decision_section`                                                 | `db/migrations/20260519_002_create_repository_decision_tables.sql`      | 确认唯一键、status check、tenant/run/round/team 引用                          |
| `decision_merge_commit`                                                 | `db/migrations/20260519_002_create_repository_decision_tables.sql`      | 确认 `role_section_ids`、`canonical_decision_payload`、status 和索引          |
| `team_confirmation`                                                     | `db/migrations/20260519_002_create_repository_decision_tables.sql`      | 确认已严格引用 `decision_merge_commit`                                        |
| `decision`                                                              | `db/migrations/20260519_002_create_repository_decision_tables.sql`      | 确认 `merge_commit_id`、`team_confirmation_id` 当前是否为严格外键还是业务引用 |
| `settlement_result` / `replay_input_manifest`                           | `db/migrations/20260519_005_create_repository_ledger_replay_tables.sql` | 确认正式结果与 replay manifest 的边界                                         |
| `role_assignment` / `role_field_policy` / `decision_merge_section_link` | 拟新增                                                                  | 若进入实现，先写 migration 设计、adapter contract 和 migration tests          |

### Status、fixture 与测试文件核验

| 项目              | 需要确认的文件或目录                                                                                                                             | 结论要求                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| status 枚举       | shared-contracts、schemas、fixtures                                                                                                              | 确认当前 status 后，再决定是否扩展 `returned`、`locked`、`rejected`、`revoked`、`superseded` |
| fixtures          | `contracts/fixtures/role-decision-section.valid.json`、`decision-merge-commit.valid.json`、`team-confirmation.valid.json`、`decision.valid.json` | 确认 fixture 能表达当前核心链路；新增状态必须新增 fixture                                    |
| contract tests    | `tests/contract/`                                                                                                                                | 确认新增 endpoint/type/schema 后有 contract 覆盖                                             |
| integration tests | `tests/integration/`                                                                                                                             | 确认 ready、merge、confirm、canonical submit、settle 的正反向链路                            |
| migration tests   | `tests/`、`scripts/` 中 migration gate                                                                                                           | 确认新增表、外键、唯一键和幂等行为                                                           |
| e2e tests         | `tests/e2e/`                                                                                                                                     | 确认学员端角色工作台和教师锁轮 preflight 的主流程                                            |

## 12. 分阶段开发任务

### Phase A：方案与契约冻结

目标：先冻结角色化语义，不写业务实现。

- 审阅本文档与 `docs/architecture/simwar-architecture-overview.md` 的一致性。
- 明确默认角色集合、角色扩展策略和课程角色分配策略。
- 确认 `RoleDecisionSection.status` 表达 ready，不引入误导性的独立 `RoleReadyState` 核心实体。
- 更新 OpenAPI 草案、JSON Schema 草案和 fixtures 草案。
- 明确锁轮 preflight 需要检查的 canonical decision 条件。

交付物：

- 角色化 shared contract 设计。
- API endpoint 清单。
- DB migration 设计草案。
- 测试矩阵。

### Phase B：shared-contracts、schemas 和 fixtures

目标：让前后端和测试先共享同一语义。

- 新增或强化 `RoleContext`、`RolePermissionScope`、`RoleWorkspaceSnapshot`、`RoleReadinessSummary`、`MergeConflict`、`MergeValidationReport`。
- 更新 `RoleDecisionSection`、`DecisionMergeCommit`、`TeamConfirmation`、`Decision`。
- 更新 JSON Schema 和 fixtures。
- 补 contract / schema drift 测试。

验收：

- `npm run typecheck`
- `npm run test:contract`
- `npm run test:schema-drift`

### Phase C：services API 与 repository port

目标：后端先形成受控角色命令链。

- 在 `FoundationRoutes` 增加 role context、workspace、readiness 聚合查询。
- 强化 role section 保存、ready、merge commit、team confirmation command。
- 在 `DecisionRoutes` 校验 canonical decision 必须追溯到 confirmed merge commit。
- 在 `RoundRoutes` 锁轮 preflight 中检查 validated canonical decision。
- 在 repository ports 中增加角色上下文、角色分配、角色字段策略和 merge link 操作。
- 为 JSON adapter 和 Postgres adapter 规划一致行为。

验收：

- API 集成测试覆盖正常链路和越权链路。
- 幂等测试覆盖 submit / confirm / settle。

### Phase D：db migration 硬化

目标：把角色上下文与合并追溯从业务约定推进到数据库约束。

- 新增 `role_assignment`、`role_field_policy`、`decision_merge_section_link`。
- 可选新增 `role_context_session`、`role_contribution_evidence`、`merge_conflict_log`、`role_readiness_history`。
- 将 `decision.merge_commit_id`、`decision.team_confirmation_id` 升级为严格外键。
- 为角色化查询补充唯一键和索引。
- 检查 RLS 或 repository tenant filter。

验收：

- `npm run test:migration`
- `npm run test:migration:apply`
- `npm run test:postgres-adapter`

### Phase E：apps/student 角色工作台

目标：从团队总表单升级为角色化工作流。

- 增加 role context gate。
- 拆分 role workspace、section editor、ready panel、merge panel、confirmation panel、canonical submit panel。
- 将 API 调用收敛到 role decision client / hooks。
- 明确 advisory-only 视觉隔离和草稿采纳路径。
- 发布后结果页只读展示角色化复盘。

验收：

- 浏览器主流程验证。
- E2E 覆盖学生角色保存、ready、merge、confirm、submit。
- 构建通过。

### Phase F：apps/teacher / apps/admin 治理视图

目标：让教师能运营角色化课堂，管理端能审计治理边界。

- 教师端增加角色分配和 readiness dashboard。
- 锁轮前展示各队 role section、merge、confirmation、canonical decision 缺口。
- 教师端展示合并冲突和确认链路。
- 管理端展示角色权限矩阵、审计事件和 Replay/Shadow Replay 关系。

验收：

- 教师端从开轮到发布的完整 E2E 仍通过。
- 未满足 canonical decision 条件时锁轮或结算被明确阻止。

### Phase G：settlement、Replay 和插件扩展收口

目标：确认角色化不破坏真值链和插件治理。

- `settlement-service` 明确只消费 canonical decision。
- Replay manifest 明确 role drafts、AI advisory、learning evidence 的 excluded 语义。
- 插件 manifest 增加 role extension 草案。
- wellness 插件示例增加角色字段归属说明，但不改变 hook 真值边界。
- 增加 Shadow Replay 验证插件角色扩展变更不会覆盖历史正式结果。

验收：

- settlement golden / replay hash / idempotency 测试稳定。
- 插件 trace 与角色证据链可审计但不污染 truth hash。
- `npm run quality` 通过后再进入业务实现合并。
