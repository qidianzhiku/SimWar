# SimWar 架构总览

建议保存路径：`docs/architecture/simwar-architecture-overview.md`

说明：本文件基于当前已经生成的 `apps`、`packages`、`services`、`db`、`plugins`、`docs` 知识图谱整理。用户提出的 `docs/SIMWAR_ARCHITECTURE_OVERVIEW.md` 已按仓库文档规则规范化为小写 kebab-case，并归入 `docs/architecture/`。

## 1. 项目定位

SimWar 是面向企业培训、课程对抗和经营模拟的商战仿真平台。当前仓库已经从纯规划文档进入本地可运行工程状态，核心技术形态是 TypeScript monorepo：

```text
React 三端前端
  -> Node.js 原生 HTTP API
  -> route / service / repository 分层
  -> simulation-core 结构化仿真内核
  -> JSON / PostgreSQL adapter 与 Replay / Audit / Event ledger
```

项目的架构中心不是 AI，也不是前端状态，而是结构化仿真内核与可回放事实链。正式市场份额、需求量、成交量、现金流、利润、库存、产能、评分、排名和结算状态都属于真值字段，只能由 `services/simulation-core` 或受控插件 hook 产生。

当前主线是 Phase 2/3 收口和 Phase 4/7 基础能力固化：

- Course / Team / Run / Round / Decision 已形成 API、共享类型、schema、fixture 和集成测试基线。
- 分角色决策链已经收敛为 `RoleDecisionSection(status=draft/ready) -> DecisionMergeCommit(status=validated) -> TeamConfirmation(status=confirmed) -> canonical Decision -> official settlement`。
- `simulation-core` 已具备 market、operations、finance、scoring 四段边界，并通过 `toy_logit_wellness_v1` adapter 串联。
- Replay / Shadow Replay 已有最小 manifest、hash 和 diff report 闭环。
- AI 只允许 advisory-only mock 输出，写入 `CoachOutput` / `ModelCallLog`，不得写真值。

## 2. 文档知识域 docs 图谱

`docs` 图谱是当前架构理解的文档知识域，共包含 40 个 Markdown 文档节点、88 条文档关系边和 8 个知识层。它不是运行时代码的一部分，但为代码、契约、数据库、插件和测试门禁提供解释框架。

文档知识域分为：

- 文档入口：`docs/INDEX.md`，用于维护标准化文档路径和历史文件名映射。
- 产品需求与治理规则：覆盖需求、用户故事、功能细化、非功能需求、收费权益、数据隐私、案例沉淀和社区复用。
- 架构与内核治理：覆盖系统架构、数据库设计、事件驱动、ADR、参数集、行业插件、业务流程、后置变更影响和 repository adapter 计划。
- 契约与权限边界：覆盖 REST API、旧 API 草案、模型工程契约和学生 RBAC / 分角色决策重构。
- 前端体验与状态流：覆盖教师端/学员端架构、组件库、Figma 原型和前端状态流。
- 质量门禁与回放验证：覆盖 Phase 2/3 baseline、测试覆盖、Replay / Shadow Replay 计划。
- 开发运维与发布：覆盖环境搭建、技术栈、CI/CD、监控告警、运行构建和安全扫描。
- 研究基准与模型调研：覆盖竞品 benchmark、Cesim、Marketplace Simulations、执行模型和小模型性能优化。

长期维护时，本总览应把 `docs` 图谱视为“架构解释层”：任何目录、schema、API、数据库迁移、插件 hook、Replay manifest 或 AI 契约变化，都应检查对应文档层是否需要同步更新。

## 3. 前端 apps 架构

`apps` 图谱显示当前前端由三个 Vite React 应用组成：

- `apps/admin`：管理端应用。
- `apps/teacher`：教师端应用。
- `apps/student`：学员端应用。

三个应用共享同一套基本结构：

- `index.html` 作为 Vite HTML 入口。
- `src/main.tsx` 挂载 React 根组件。
- `src/App.tsx` 承载当前端的主要业务工作台。
- `src/styles.css` 定义工作台、面板、表单、状态徽标和响应式样式。
- `package.json` 引用 `@simwar/shared-contracts`。
- `vite.config.ts` 绑定本地开发端口。

### 管理端

管理端围绕平台控制面：

- 读取 `/api/v1/admin/state`。
- 管理租户和用户。
- 创建 mock payment order。
- 激活或检查 entitlement。
- 查看 Replay、Shadow Replay 和审计日志。

管理端的关键边界是：支付、权益和访问控制只影响访问、额度和功能，不得写入市场、财务、评分、排名或结算结果。

### 教师端

教师端覆盖教学主流程：

- 创建和发布课程。
- 创建队伍。
- 创建 Run。
- 开轮、锁轮、触发结算、发布结果。
- 查看 Replay / Shadow Replay。
- 发起 AI advisory。
- 管理课程数据政策和案例候选。

教师端可以触发结算 endpoint，但不能在前端自行计算正式市场份额、利润、评分或排名。正式结果必须来自后端结算链。

### 学员端

学员端围绕团队决策协作：

- 读取本地演示态 `/api/v1/demo-state`。
- 提交角色决策区块。
- 标记角色 ready。
- 创建队长/CEO merge commit。
- 提交 team confirmation。
- 提交 canonical team decision。
- 请求 advisory-only AI 建议。

学员端重点体现分角色决策链。角色草稿、ready 状态、AI 建议和 merge 候选都不得直接进入正式结算；正式结算只消费团队确认后的 canonical decision。

### 前后端 API 关系

图谱中前端引用的 endpoint 应理解为“前端命令入口”，后端 route group 才负责权限、schema、状态机、repository 和仿真内核处理。当前主要映射如下：

| 前端 endpoint                                                               | services route group                        | shared contract                                                | db / domain entity                                                             |
| --------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `/api/v1/auth/login`                                                        | `AuthRoutes`                                | `AuthSession`、`CurrentUser`、`ApiEnvelope`                    | `auth_session`、`simwar_user`、session domain                                  |
| `/api/v1/demo-state`                                                        | `CourseRoutes` / runtime state facade       | `P0DemoState`                                                  | Course / Team / Run / Round / Decision / Settlement 聚合视图                   |
| `/api/v1/admin/state`                                                       | `TenantRoutes`、`UserRoutes`、`AuditRoutes` | `AdminState`、`Tenant`、`User`、`AuditLog`                     | `simwar_tenant`、`simwar_user`、`audit_log`                                    |
| `/api/v1/admin/tenants`                                                     | `TenantRoutes`                              | `Tenant`                                                       | `simwar_tenant`                                                                |
| `/api/v1/admin/users`                                                       | `UserRoutes`                                | `User`、`ActorRole`、`PermissionKey`                           | `simwar_user`                                                                  |
| `/api/v1/courses`                                                           | `CourseRoutes`                              | `Course`                                                       | `course`                                                                       |
| `/api/v1/courses/{courseId}/teams`                                          | `CourseRoutes`                              | `Team`、`TeamMember`                                           | `team`                                                                         |
| `/api/v1/courses/{courseId}/runs`                                           | `CourseRoutes`                              | `Run`、`ScenarioPackage`、`ParameterSet`、`PluginPackage`      | `simwar_run`、`scenario_package`、`parameter_set`、plugin binding domain       |
| `/api/v1/runs/{runId}/rounds/{roundNo}/start`                               | `RoundRoutes`                               | `Round`                                                        | `simwar_round`                                                                 |
| `/api/v1/runs/{runId}/rounds/{roundNo}/lock`                                | `RoundRoutes`                               | `Round`、`Decision`                                            | `simwar_round`、decision validation domain                                     |
| `/api/v1/runs/{runId}/rounds/{roundNo}/settle`                              | `SettlementRoutes`                          | `SettlementResult`、`ReplayInputManifest`、`StateSnapshot`     | `settlement_result`、`state_snapshot`、`replay_input_manifest`、`domain_event` |
| `/api/v1/runs/{runId}/rounds/{roundNo}/publish`                             | `RoundRoutes`                               | `Round`、`PublicResultView`                                    | `simwar_round`、published result domain                                        |
| `/api/v1/runs/{runId}/rounds/{roundNo}/decisions`                           | `DecisionRoutes`                            | `Decision`、`DecisionPayload`                                  | `decision`                                                                     |
| `/api/v1/runs/{runId}/rounds/{roundNo}/teams/{teamId}/role-sections/{role}` | `FoundationRoutes`                          | `RoleDecisionSection`                                          | `role_decision_section`                                                        |
| `/api/v1/runs/{runId}/rounds/{roundNo}/teams/{teamId}/merge-commits`        | `FoundationRoutes`                          | `DecisionMergeCommit`                                          | `decision_merge_commit`                                                        |
| `/api/v1/runs/{runId}/rounds/{roundNo}/teams/{teamId}/confirmations`        | `FoundationRoutes`                          | `TeamConfirmation`                                             | `team_confirmation`                                                            |
| `/api/v1/replays` / `/api/v1/shadow-replays`                                | `ReplayRoutes`                              | `ReplayRun`、`ReplayReport`、`ReplayDiffReport`                | `replay_run`、`replay_report`、`replay_diff_report`、Replay domain             |
| `/api/v1/agents/advisory`                                                   | `AgentRoutes`                               | `AgentRequest`、`AgentResponse`、`CoachOutput`、`ModelCallLog` | `coach_output`、`model_call_log`                                               |
| `/api/v1/billing/mock-payment-orders`                                       | `FoundationRoutes`                          | `PaymentOrder`                                                 | `payment_order`、payment domain                                                |
| `/api/v1/entitlements/activate` / `/api/v1/entitlements/access-check`       | `FoundationRoutes`                          | `EntitlementLedger`、`EntitlementAccessDecision`               | `entitlement_ledger`、access-check domain                                      |
| `/api/v1/courses/{courseId}/data-policy`                                    | `FoundationRoutes`                          | `CourseDataPolicy`                                             | `course_data_policy`                                                           |
| `/api/v1/cases/candidates`                                                  | `FoundationRoutes`                          | `CaseCandidate`、`CaseConsent`                                 | `case_candidate`、case governance domain                                       |

这张映射表是长期维护重点：新增 endpoint 时应同步检查 route group、shared contract、schema fixture、repository port 和数据库/领域实体是否一致。

## 4. services 后端服务架构

`services` 图谱是当前最大子图谱，覆盖主业务 API、仿真核心和 Agent Gateway 占位。

### services/api

`services/api` 是主业务 API 服务，采用 Node.js 原生 HTTP server，按 route/service/repository 分层。

核心入口：

- `api/src/server.ts`：创建 runtime、认证上下文，并按顺序调度 route handler。
- `api/src/http.ts`：封装 JSON 读写、响应 envelope、路径匹配、公开裁剪和 truth-protected field 拦截。
- `api/src/repositories.ts`：组合 legacy repository、repository ports、facade、事件账本和快照账本。

Route 层包括：

- `AuthRoutes`：登录、登出、当前用户和 session 生命周期。
- `TenantRoutes` / `UserRoutes` / `RbacRoutes`：租户、用户、角色和权限边界。
- `CourseRoutes`：课程、队伍、Run 创建和课程状态变更。
- `RoundRoutes`：回合列表、开轮、锁轮、发布结果和下一轮创建。
- `DecisionRoutes`：正式 canonical decision submit。
- `SettlementRoutes`：结算请求和 service kernel 正式结算。
- `ReplayRoutes`：Official Replay 和 Shadow Replay。
- `AgentRoutes`：AI advisory-only mock 输出，写 `CoachOutput` / `ModelCallLog`。
- `AuditRoutes`：审计日志查询。
- `GovernanceRoutes`：ScenarioPackage、PluginPackage、ParameterSet 最小治理。
- `FoundationRoutes`：分角色决策、权益、数据政策和案例治理 command。

Service 层包括：

- `foundation-services.ts`：分角色决策、收费权益、数据政策和案例治理。
- `settlement-service.ts`：正式结算 command 链，负责 service kernel 校验、manifest 记录、simulation 调用、结果落库、快照和审计。
- `replay-service.ts`：Replay input manifest、manifest hash、settlement input 准备和 diff report。
- `simulation.ts`：API 到 simulation-core 的 adapter，负责决策 payload 校验、提交体解析和 preview settlement。

Repository 层包括：

- `repository-ports.ts`：JSON/Postgres adapter 的共同数据访问端口。
- `repository-facade.ts`：route-facing async facade，统一同步 JSON ports 和 async Postgres ports。
- `json-repository-adapter.ts`：当前 JSON / memory runtime adapter。
- `postgres-repository-adapter.ts`：PostgreSQL/Supabase async adapter 草案。
- `store.ts`：本地 JSON / memory 演示 store、种子数据、审计追加、RBAC 辅助和快照持久化。

### services/simulation-core

`simulation-core` 是正式真值边界的当前落点。

主要模块：

- `market.ts`：市场需求计算，读取决策和参数，并允许插件调整 demand。
- `operations.ts`：运营约束计算，处理产能、服务质量和 fulfilled demand。
- `finance.ts`：财务计算，计算 revenue、cost、profit、cash flow。
- `scoring.ts`：评分和 `TeamSettlement` 构造，负责 score、rank、`state_true/state_obs/state_est` 裁剪。
- `toy-logit-engine.ts`：`toy_logit_wellness_v1` adapter，编排 market、operations、finance、score 四段。
- `types.ts`：`SettlementEngine`、插件 hook、市场/运营/财务/评分结果和团队上下文类型。
- `wellness-plugin.ts` / `wellness-parameters.ts`：wellness v1 参数和 hook 实现。

`toy_logit_wellness_v1` 只是 adapter，不应扩散到业务层。后续替换引擎时应实现同一 `SettlementEngine` 边界。

### services/agent-gateway

`agent-gateway` 当前是占位目录。按照项目规则，Phase 6 前不得接真实模型；相关开发只能围绕 advisory-only 契约、mock 输出、日志、权限过滤、schema fail、提示注入和越权测试展开。

## 5. db 数据库表关系

`db` 图谱覆盖 PostgreSQL migration 中的 32 个表节点和 8 个 schema 节点。为了避免把业务流程图误读为数据库外键图，本节分成两层表达：

- 业务依赖流：描述业务对象从创建、确认、结算、回放到审计的领域推进顺序。
- 严格外键关系：描述 migration 中已经由 `references`、`check`、`unique`、RLS policy 等 SQL 约束直接强制的关系。

### 业务依赖流

业务依赖流用于理解系统如何运转，不等同于所有字段都存在外键。

```text
Tenant / User
  -> ScenarioPackage / ParameterSet
  -> Course
  -> Team
  -> Run
  -> Round
  -> RoleDecisionSection(status=draft/ready)
  -> DecisionMergeCommit(status=validated)
  -> TeamConfirmation(status=confirmed)
  -> canonical Decision
  -> SettlementResult / StateSnapshot / ReplayInputManifest
  -> ReplayReport / ReplayDiffReport / AuditLog / DomainEvent
```

关键业务域：

- 身份与课程运行：`simwar_tenant` 是多租户隔离根；`simwar_user`、`course`、`team`、`simwar_run`、`simwar_round` 形成教学运行上下文。
- 场景与参数：`scenario_package`、`parameter_set` 在课程和 Run 创建时被绑定，正式运行期间不应热替换。
- 分角色决策：`role_decision_section` 记录各角色 section 和 ready 状态；`decision_merge_commit` 记录队长/CEO 合并后的候选 canonical payload；`team_confirmation` 记录确认；`decision` 保存最终可结算的 canonical decision。
- 收费权益：`payment_order` 和 `payment_transaction` 证明支付过程；`entitlement_ledger` 是访问检查账本。支付成功不自动等于权益激活。
- 数据治理：`course_data_policy` 表达默认意图与有效审批状态；`case_candidate`、`case_consent`、`case_anonymization_log`、`consent_withdrawal_request` 形成案例、训练、公开复用和撤回链路。
- 真值与 Replay：`settlement_result`、`state_snapshot`、`replay_input_manifest`、`replay_diff_report` 保存正式结算、状态快照、可回放输入和差异报告。
- 插件、Replay 执行与 AI：`plugin_package` 保存插件治理信息；`replay_run` / `replay_report` 保存回放任务；`coach_output` / `model_call_log` 保存 advisory-only AI 输出和调用审计。

### 严格外键关系

严格外键关系来自 migration 中已经声明的 `references`。当前主要约束如下。

身份、课程与运行：

- `simwar_user.tenant_id -> simwar_tenant.tenant_id`
- `scenario_package.tenant_id -> simwar_tenant.tenant_id`
- `parameter_set.tenant_id -> simwar_tenant.tenant_id`
- `course.tenant_id -> simwar_tenant.tenant_id`
- `course.scenario_package_id -> scenario_package.scenario_package_id`
- `course.parameter_set_id -> parameter_set.parameter_set_id`
- `team.tenant_id -> simwar_tenant.tenant_id`
- `team.course_id -> course.course_id`
- `simwar_run.tenant_id -> simwar_tenant.tenant_id`
- `simwar_run.course_id -> course.course_id`
- `simwar_run.scenario_package_id -> scenario_package.scenario_package_id`
- `simwar_run.parameter_set_id -> parameter_set.parameter_set_id`
- `simwar_round.tenant_id -> simwar_tenant.tenant_id`
- `simwar_round.run_id -> simwar_run.run_id`
- `auth_session.user_id -> simwar_user.user_id`
- `auth_session.tenant_id -> simwar_tenant.tenant_id`

分角色决策：

- `decision.tenant_id -> simwar_tenant.tenant_id`
- `decision.run_id -> simwar_run.run_id`
- `decision.round_id -> simwar_round.round_id`
- `decision.team_id -> team.team_id`
- `role_decision_section.tenant_id -> simwar_tenant.tenant_id`
- `role_decision_section.run_id -> simwar_run.run_id`
- `role_decision_section.round_id -> simwar_round.round_id`
- `role_decision_section.team_id -> team.team_id`
- `decision_merge_commit.tenant_id -> simwar_tenant.tenant_id`
- `decision_merge_commit.run_id -> simwar_run.run_id`
- `decision_merge_commit.round_id -> simwar_round.round_id`
- `decision_merge_commit.team_id -> team.team_id`
- `team_confirmation.tenant_id -> simwar_tenant.tenant_id`
- `team_confirmation.run_id -> simwar_run.run_id`
- `team_confirmation.round_id -> simwar_round.round_id`
- `team_confirmation.team_id -> team.team_id`
- `team_confirmation.merge_commit_id -> decision_merge_commit.merge_commit_id`

收费权益：

- `payment_order.tenant_id -> simwar_tenant.tenant_id`
- `payment_transaction.tenant_id -> simwar_tenant.tenant_id`
- `payment_transaction.payment_order_id -> payment_order.payment_order_id`
- `entitlement_ledger.tenant_id -> simwar_tenant.tenant_id`

数据治理：

- `course_data_policy.tenant_id -> simwar_tenant.tenant_id`
- `course_data_policy.course_id -> course.course_id`
- `case_candidate.tenant_id -> simwar_tenant.tenant_id`
- `case_candidate.course_id -> course.course_id`
- `case_consent.tenant_id -> simwar_tenant.tenant_id`
- `case_consent.case_candidate_id -> case_candidate.case_candidate_id`
- `case_anonymization_log.tenant_id -> simwar_tenant.tenant_id`
- `case_anonymization_log.case_candidate_id -> case_candidate.case_candidate_id`
- `consent_withdrawal_request.tenant_id -> simwar_tenant.tenant_id`
- `consent_withdrawal_request.case_candidate_id -> case_candidate.case_candidate_id`
- `consent_withdrawal_request.case_consent_id -> case_consent.case_consent_id`

真值账本、Replay、插件和 AI：

- `domain_event.tenant_id -> simwar_tenant.tenant_id`
- `settlement_result.tenant_id -> simwar_tenant.tenant_id`
- `settlement_result.run_id -> simwar_run.run_id`
- `settlement_result.round_id -> simwar_round.round_id`
- `settlement_result.parameter_set_id -> parameter_set.parameter_set_id`
- `settlement_result.scenario_package_id -> scenario_package.scenario_package_id`
- `state_snapshot.tenant_id -> simwar_tenant.tenant_id`
- `state_snapshot.run_id -> simwar_run.run_id`
- `state_snapshot.round_id -> simwar_round.round_id`
- `state_snapshot.team_id -> team.team_id`
- `audit_log.tenant_id -> simwar_tenant.tenant_id`
- `replay_input_manifest.tenant_id -> simwar_tenant.tenant_id`
- `replay_input_manifest.run_id -> simwar_run.run_id`
- `replay_input_manifest.round_id -> simwar_round.round_id`
- `replay_input_manifest.domain_event_id -> domain_event.event_id`
- `replay_diff_report.tenant_id -> simwar_tenant.tenant_id`
- `replay_diff_report.run_id -> simwar_run.run_id`
- `replay_diff_report.round_id -> simwar_round.round_id`
- `replay_diff_report.domain_event_id -> domain_event.event_id`
- `plugin_package.tenant_id -> simwar_tenant.tenant_id`
- `replay_run.tenant_id -> simwar_tenant.tenant_id`
- `replay_run.source_run_id -> simwar_run.run_id`
- `replay_report.tenant_id -> simwar_tenant.tenant_id`
- `replay_report.replay_run_id -> replay_run.replay_run_id`
- `replay_report.source_run_id -> simwar_run.run_id`
- `coach_output.tenant_id -> simwar_tenant.tenant_id`
- `coach_output.run_id -> simwar_run.run_id`
- `model_call_log.tenant_id -> simwar_tenant.tenant_id`
- `model_call_log.coach_output_id -> coach_output.coach_output_id`

### 需要注意的非外键业务引用

以下字段在业务上有明确关联，但当前 migration 未全部声明为外键，长期正式化时需要用 repository contract、集成测试或后续 migration 补强：

- `team.captain_user_id` 和 `team.members` 指向用户语义，但当前不是 `simwar_user` 外键。
- `decision.merge_commit_id`、`decision.team_confirmation_id` 是 canonical 来源证据字段，但当前没有声明到 `decision_merge_commit` / `team_confirmation` 的外键。
- `decision_merge_commit.role_section_ids` 是角色 section 列表，当前以 `text[]` 形式保存，不是逐项外键。
- `state_snapshot.settlement_result_id` 和 `replay_diff_report.settlement_result_id` 是结算结果引用，当前未声明到 `settlement_result` 的外键。
- `entitlement_ledger.source` 表达 `mock_payment` 或 `manual_grant` 来源，但没有强制引用 `payment_order`。

### SQL 约束与租户隔离

除外键外，migration 还使用 `check` 和 `unique` 约束固化状态机和幂等边界，例如 round 状态、decision 状态、角色枚举、payment 状态、Replay 状态、AI advisory-only 等。多数业务表启用 RLS，并通过 `tenant_id = current_setting('simwar.tenant_id', true)` policy 执行租户隔离。

## 6. packages 共享合约

`packages` 图谱显示当前核心是 `@simwar/shared-contracts`。它是 API、前端、测试、simulation-core、contract fixtures 和 Replay 之间的结构化类型边界。

主要合约组：

- API 响应与健康检查：`ApiEnvelope`、`ApiErrorEnvelope`、`HealthPayload`。
- 状态枚举：`TenantStatus`、`UserStatus`、`CourseStatus`、`RoundStatus`、`DecisionStatus`、`ParameterSetStatus`、`PackageStatus`、`ReplayMode`、`SettlementHookName`。
- 身份与权限：`ActorRole`、`PermissionKey`、`Tenant`、`User`、`CurrentUser`、`AuthSession`、`ROLE_PERMISSION_MATRIX`。
- 课程运行：`ScenarioPackage`、`PluginPackage`、`PluginManifest`、`WellnessParametersV1`、`ParameterSet`、`Course`、`Team`、`Run`、`Round`。
- 决策链：`DecisionPayload`、`Decision`、`RoleDecisionSection`、`DecisionMergeCommit`、`TeamConfirmation`。
- 结算与真值：`TeamSettlement`、`SettlementPluginTrace`、`SettlementResult`、`PublicResultView`、`TRUTH_PROTECTED_FIELDS`。
- Replay：`ReplayInputManifest`、`ReplayDiffReport`、`ReplayRun`、`ReplayReport`。
- 治理与审计：`PaymentOrder`、`EntitlementLedger`、`EntitlementAccessDecision`、`CourseDataPolicy`、`CaseCandidate`、`CaseConsent`、`AuditLog`、`DomainEvent`、`StateSnapshot`。
- AI advisory：`CoachOutput`、`ModelCallLog`、`AgentRequest`、`AgentResponse`。

共享合约的关键价值是避免 API、前端、测试和 simulation-core 各自解释同一业务对象。所有正式输入输出都应尽量引用共享类型和 schema，而不是临时字符串结构。

## 7. plugins 插件机制

`plugins` 图谱当前覆盖 wellness 行业插件。

### 插件清单

`plugins/wellness/plugin.manifest.json` 声明：

- plugin id 和 manifest version。
- 行业类型。
- 审批状态。
- settlement hook 白名单。
- 参数 schema 引用。
- simulation-core adapter 引用。

`PluginManifest v1` 约束插件清单必须提供 manifest version、plugin id、状态、行业、hook 列表、参数 schema 引用和 adapter reference。

### 参数契约

`WellnessParametersV1` 覆盖四组参数：

- `demand_curve`：参考价格、价格摩擦、质量预算效用提升和价格敏感度。
- `cost_structure`：合作折扣阈值和折扣率。
- `operations_constraints`：最大产能修正和最低服务质量预算。
- `scoring_weights`：服务质量加分、最高加分和低投入惩罚。

### Settlement hook

wellness adapter 实现四个白名单 hook：

- `adjustDemand:wellness_eldercare_demand_v1`：按服务质量预算和价格摩擦调整需求效用。
- `adjustOperations:wellness_capacity_guardrail_v1`：按最大产能修正限制 capacity 和 served demand。
- `adjustFinance:wellness_partnership_discount_v1`：服务质量预算达到阈值时降低成本。
- `adjustScore:wellness_service_quality_weight_v1`：基于服务质量预算加分或惩罚。

### 插件治理边界

插件机制必须遵守：

- 插件只能在白名单 hook 内返回结构化调整和 `SettlementPluginTrace`。
- 插件不得直接写 `state_true`、score、rank、settlement result 或 ledger。
- Run 绑定 `ScenarioPackage`、`PluginPackage`、`ParameterSet` 后不得热替换。
- 参数、插件或 engine adapter 变化必须走 Shadow Replay 差异报告。

## 8. 核心业务流程

### 教师创建课程与运行

```text
Teacher login
  -> create/publish Course
  -> create Teams
  -> create Run
  -> start Round
```

Run 创建时应冻结场景包、插件包、参数集、engine id 和 seed。正式运行期间不得原位替换这些输入。

### 学员分角色决策

```text
RoleDecisionSection(status=draft/ready)
  -> DecisionMergeCommit(status=validated)
  -> TeamConfirmation(status=confirmed)
  -> canonical Decision(status=validated, canonical_source=role_merge_commit)
```

角色成员只能写自己的 `RoleDecisionSection`、`status=ready` 状态和协作证据。队长/CEO 负责创建 `DecisionMergeCommit`，团队成员通过 `TeamConfirmation` 确认后，后端才能生成或接受可进入正式结算的 canonical `Decision`。

### 锁轮与结算

```text
Teacher lock Round
  -> validate canonical decisions for all teams
  -> request official settlement
  -> settlement-service builds ReplayInputManifest
  -> simulation-core computes market / operations / finance / score
  -> persist SettlementResult, StateSnapshot, DomainEvent, AuditLog
```

重复 settle 必须幂等，返回同一正式结果或稳定 replay hash，不得重复产生副作用。

### 发布结果

```text
SettlementResult created
  -> teacher reviews
  -> publish Round result
  -> student/teacher views read-only public result
```

发布后的 round/result 是只读对象，不得重新 settle 或修改正式结果。

### Replay / Shadow Replay

```text
official settlement inputs
  -> ReplayInputManifest
  -> official replay or shadow replay
  -> ReplayReport / ReplayDiffReport
```

Replay 只能读取历史绑定输入。Shadow Replay 只能生成候选差异报告，不得覆盖正式 SettlementResult。

### AI advisory

```text
AgentRequest
  -> schema / permission / truth-field guardrail
  -> mock advisory output
  -> CoachOutput
  -> ModelCallLog
```

AI 输出只作为建议、诊断或复盘证据，不能进入正式 truth hash，也不能直接改写真值字段。

## 9. 当前架构风险

### 图谱仍是分域生成，缺少根图谱

当前已生成 `apps`、`packages`、`services`、`db`、`plugins`、`docs` 六个子图谱，但没有统一根图谱。跨域关系需要人工汇总，例如前端 endpoint 到 API route、API repository 到 DB table、simulation-core 到 plugin manifest 的全链路仍不够直观。

### JSON runtime 与 Postgres adapter 并行期风险

当前本地运行默认仍依赖 JSON / memory store，Postgres adapter 和 migration 是正式化方向。风险在于 route 或 service 继续依赖 JSON store 细节，导致后续 adapter contract 难以完全覆盖。

### 前端工作台承载逻辑较重

三端 `App.tsx` 都承载较多流程编排。随着 Course、Run、Round、Decision、Replay、Entitlement、AI advisory 增长，前端可能出现状态耦合、重复 API client 逻辑和权限裁剪不一致。

### simulation-core adapter 仍是 toy 引擎

`toy_logit_wellness_v1` 已被约束为 adapter，但仍是当前唯一可运行实现。后续如果真实仿真算法接入不严格遵守 `SettlementEngine` 边界，可能把业务规则散落到 API 或插件外层。

### 插件治理链还需要更强测试

wellness 插件已具备 manifest、参数和 hook，但参数版本化、插件审批、Run 绑定冻结、Shadow Replay 差异门禁和不可热替换约束需要持续用 contract / integration / replay 测试固化。

### AI advisory 容易被误用为决策来源

当前图谱显示 Agent route 和前端 advisory 已存在。风险是后续接真实模型时，建议输出被误当作 canonical decision、settlement input 或评分依据。

### 数据治理字段语义容易被弱化

`policy_default.*` 只是默认意图，不能替代 `effective_processing_status.*=approved`、同意记录、匿名化和人工审核。若前端或 API 将默认意图当成批准状态，会造成训练、公开或跨课程复用越权。

## 10. 后续重构建议

### 生成并维护根知识图谱

建议将六个子图谱合并为根级 `.understand-anything/knowledge-graph.json`，并补充跨域边：

- apps endpoint -> services route。
- services repository port -> db table。
- services settlement-service -> simulation-core engine。
- simulation-core plugin hook -> plugins manifest。
- shared-contracts type -> schema fixture -> API route。
- docs architecture/contracts/quality -> 对应源码模块。

这会让架构审查、影响分析和 onboarding 更直接。

### 强化 repository port 收口

继续把新增实体的数据访问收敛到 `repository-ports.ts` 和 `repository-facade.ts`：

- route 不直接读写 `store.ts`。
- JSON adapter 和 Postgres adapter 复用同一 adapter contract。
- migration apply、idempotency、RLS 和 adapter contract 在 CI 中成为正式门禁。

### 抽出前端 API client 与业务 hooks

三端可以保留独立工作流，但建议提取共享前端基础层：

- typed API client。
- auth/session hook。
- RBAC/permission 裁剪 hook。
- common error/envelope handling。
- Replay/advisory/result view helper。

这样可以减少三端对 endpoint、envelope 和权限语义的重复实现。

### 固化 settlement command pipeline

正式结算链建议保持单一入口：

```text
SettlementRequested
  -> service_kernel auth
  -> canonical decision validation
  -> replay manifest build
  -> simulation-core settle
  -> settlement result persist
  -> state snapshot persist
  -> audit/domain event append
```

所有 preview、replay、shadow replay、AI advisory 都不得复用会产生正式副作用的写入路径。

### 将插件治理从 manifest 扩展到 lifecycle

建议补齐：

- PluginPackage 审批状态机。
- ParameterSet 与 PluginPackage 绑定版本锁。
- 插件 hook 输出 schema 校验。
- plugin trace golden fixture。
- Shadow Replay 差异阈值和人工审核状态。
- 禁止 Run 内热替换的 API 与数据库约束测试。

### 为 AI 接入设置更硬的工程闸门

真实模型接入前建议至少完成：

- `CoachOutput` 和 `ModelCallLog` schema drift test。
- truth-protected field blacklist 测试。
- prompt injection / schema fail / over-permission 测试。
- 模型版本、prompt 版本、输入输出 hash 审计。
- advisory 输出与 canonical decision 的 UI 区分测试。

### 将文档总览纳入质量入口

本文件建议作为 `docs/INDEX.md` 的 Architecture 入口之一，并与以下文档形成阅读链：

- `docs/quality/phase-2-3-baseline-checklist.md`
- `docs/architecture/system-architecture.md`
- `docs/contracts/api-contract.md`
- `docs/contracts/student-rbac-decision-refactor.md`
- `docs/quality/replay-shadow-replay-test-plan.md`
- `docs/architecture/industry-plugin-model-report.md`
- `docs/contracts/model-engineering-contract.md`

后续每次改变目录、schema、接口、数据库迁移、插件 hook、Replay manifest 或 AI 契约时，都应同步检查本总览是否需要更新。
