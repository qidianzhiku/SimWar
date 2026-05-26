# SimWar 架构决策记录 ADR 总览

建议保存路径：`docs/architecture/simwar-architecture-decisions.md`

| 项目 | 内容 |
| --- | --- |
| 文档定位 | 当前已形成架构决策的总览索引 |
| 适用范围 | apps、packages、services、db、plugins、docs 知识域 |
| 最后更新 | 2026-05-26 |
| 状态 | baseline |
| 相关文档 | `docs/architecture/simwar-architecture-overview.md`、`docs/architecture/adr.md`、`docs/architecture/repository-adapter-plan.md`、`docs/quality/phase-2-3-baseline-checklist.md` |

## 1. 总体判断

SimWar 当前已经从纯文档规划进入本地可运行工程状态，架构决策的主线已经比较清晰：

```text
Vite React apps
  -> Node.js API route/service/repository
  -> shared-contracts / OpenAPI / JSON Schema / fixtures
  -> simulation-core structured truth engine
  -> repository ports / JSON runtime / PostgreSQL migration draft
  -> ledger / replay / audit / advisory governance
```

这些决策共同服务一个核心原则：正式经营结果必须来自结构化仿真内核和受控插件链路，前端、AI、Replay、教师端、学员端和管理端都不得绕过 canonical decision 与 settlement 链直接改写真值字段。

## 2. ADR 总览表

| ADR 编号 | 决策主题 | 状态 | 实现状态 | 主要影响范围 | 当前落点 |
| --- | --- | --- | --- | --- | --- |
| ADR-ARCH-001 | 采用 monorepo 下的前后端分层架构 | baseline | implemented | apps / services / packages | `apps/*`、`services/api`、`services/simulation-core`、`packages/shared-contracts` |
| ADR-CONTRACT-001 | 采用 shared-contracts 契约优先 | baseline | partial | API / 前端 / 测试 / 仿真 | `packages/shared-contracts`、`contracts/openapi`、`contracts/schemas`、`contracts/fixtures` |
| ADR-ENGINE-001 | simulation-core 是正式真值来源 | baseline | implemented | settlement / scoring / replay | `services/simulation-core`、`services/api/src/settlement-service.ts` |
| ADR-DATA-001 | 数据库采用审计事实链与 repository port 边界 | baseline | partial | db / services / tests | `db/migrations`、`repository-ports.ts`、`repository-facade.ts`、adapter contract tests |
| ADR-PLUGIN-001 | 采用行业无关 kernel + 受控插件 hook | baseline | partial | plugins / simulation-core / governance | `plugins/wellness`、`services/simulation-core`、`PluginPackage` |
| ADR-REPLAY-001 | Replay / Shadow Replay 是复现与治理机制 | baseline | partial | replay / settlement / governance | `ReplayInputManifest`、`ReplayRun`、`ReplayReport`、`ReplayDiffReport` |
| ADR-AI-001 | AI 当前只允许 advisory-only 输出 | baseline | implemented | agent / AI / audit / security | `CoachOutput`、`ModelCallLog`、`agent-routes.ts` |
| ADR-DECISION-001 | 分角色决策必须汇聚为 canonical Decision 后才能结算 | baseline | implemented | student / teacher / decision / settlement | `RoleDecisionSection`、`DecisionMergeCommit`、`TeamConfirmation`、`Decision` |
| ADR-GOV-001 | Scenario / ParameterSet / PluginPackage 采用版本化治理 | baseline | partial | governance / run / replay | `ScenarioPackage`、`ParameterSet`、`PluginPackage`、最小治理 API 与 Shadow Replay 证据引用 |

实现状态说明：

- `implemented`：当前仓库已有对应代码、契约和基础测试覆盖，可作为已落地基线维护。
- `partial`：当前仓库已有核心骨架或最小闭环，但治理流、覆盖范围或正式运行时仍需继续固化。
- `policy-only`：当前仅有文档规则或设计约束，尚未形成代码、schema、migration 或测试闭环。

## 3. ADR-ARCH-001：采用 monorepo 下的前后端分层架构

| 项目 | 内容 |
| --- | --- |
| 状态 | baseline |
| 实现状态 | implemented |
| 验证门禁 | `npm run lint:boundaries`、`npm run typecheck`、`npm run build`、`npm run test:e2e:ui` |
| 证据链接 | `apps/admin`、`apps/teacher`、`apps/student`、`services/api/src/server.ts`、`services/api/src/routes`、`services/api/src/repository-facade.ts`、`docs/architecture/simwar-architecture-overview.md` |
| 相关知识域 | apps、services、packages、docs |
| 关键文件 | `apps/admin`、`apps/teacher`、`apps/student`、`services/api/src/server.ts`、`services/api/src/routes/*`、`services/api/src/repository-facade.ts` |

### 背景

SimWar 同时包含教师端、学员端、管理端、主业务 API、仿真内核、行业插件、契约包、数据库迁移和测试门禁。完全单体会让真值计算、前端交互和治理逻辑混在一起；过早拆成微服务又会增加本地开发和测试复杂度。

### 决策

采用 npm workspaces monorepo，按以下层次组织：

- `apps/admin`、`apps/teacher`、`apps/student` 承载前端工作台。
- `services/api` 承载主业务 API，内部按 route / service / repository 分层。
- `services/simulation-core` 承载结构化仿真内核。
- `packages/shared-contracts` 承载共享类型、枚举和真值字段保护列表。
- `contracts` 承载 OpenAPI、JSON Schema 和 fixtures。
- `db/migrations` 承载 SQL-first PostgreSQL migration。
- `plugins` 承载行业插件包和 manifest。

### 约束

- 前端只能发起业务命令和展示后端结果，不得计算正式市场份额、利润、评分、排名或结算状态。
- route 层负责 HTTP 编排和权限入口，不承载长业务逻辑。
- service 层负责领域命令和真值链路编排。
- repository port / facade 隔离 JSON runtime 与未来 PostgreSQL runtime。

### 后果

该决策降低了早期工程复杂度，同时为后续正式数据库、插件和 AI 网关演进保留边界。风险是早期 `App.tsx` 和本地 JSON runtime 仍可能承载较多演示逻辑，需要持续通过 repository ports、contract tests 和前端拆分计划收敛。

## 4. ADR-CONTRACT-001：采用 shared-contracts 契约优先

| 项目 | 内容 |
| --- | --- |
| 状态 | baseline |
| 实现状态 | partial |
| 验证门禁 | `npm run test:contract`、`npm run test:schema-drift`、`npm run typecheck` |
| 证据链接 | `packages/shared-contracts/src/index.ts`、`contracts/openapi/p0-api.openapi.yaml`、`contracts/schemas`、`contracts/fixtures`、`scripts/check-contracts.mjs`、`tests/unit/decision-schema.test.ts` |
| 相关知识域 | packages、contracts、apps、services、tests |
| 关键文件 | `packages/shared-contracts/src/index.ts`、`contracts/openapi/p0-api.openapi.yaml`、`contracts/schemas/*.v1.json`、`contracts/fixtures/*.valid.json`、`scripts/check-contracts.mjs` |

### 背景

SimWar 的核心对象会同时被前端、API、仿真内核、数据库 adapter、fixtures 和测试引用。如果各层各自定义类型，会快速产生 schema drift，尤其会影响 Decision、SettlementResult、Replay、PluginPackage、ParameterSet 和 AI advisory 边界。

### 决策

所有公共 API、持久化对象、事件、Replay 输入输出、AI 输出和插件治理对象必须优先进入共享契约：

- TypeScript 类型定义在 `packages/shared-contracts/src/index.ts`。
- HTTP 入口定义在 `contracts/openapi/p0-api.openapi.yaml`。
- JSON Schema 使用 `additionalProperties: false` 固定字段边界。
- 合法样例进入 `contracts/fixtures`。
- 契约漂移由 `npm run test:contract` 和 `npm run test:schema-drift` 类门禁检查。

### 约束

- 新增 public 或 persisted object 时，应同步更新 shared contracts、OpenAPI、schema、fixture、repository port、migration 和测试。
- 学员决策、Replay manifest、AI advisory 输出都必须使用结构化 schema，不允许靠临时字符串拼接传递关键字段。
- 真值字段通过 `TRUTH_PROTECTED_FIELDS` 和服务端校验保护。

### 后果

契约优先让前后端、后端 service、simulation-core 和测试保持同一语义。代价是任何跨层对象变更都需要多处同步，但这是防止结算链和 Replay 链分裂的必要成本。

## 5. ADR-ENGINE-001：simulation-core 是正式真值来源

| 项目 | 内容 |
| --- | --- |
| 状态 | baseline |
| 实现状态 | implemented |
| 验证门禁 | `npm test`、`npm run test:contract`、`npm run test:e2e:ui` |
| 证据链接 | `services/simulation-core/src`、`services/api/src/settlement-service.ts`、`services/api/src/simulation.ts`、`packages/shared-contracts/src/index.ts`、`tests/unit/simulation-core.test.ts`、`tests/integration/p2-engineering-foundation.test.ts` |
| 相关知识域 | services、packages、plugins、db、tests |
| 关键文件 | `services/simulation-core/src/*`、`services/api/src/settlement-service.ts`、`services/api/src/simulation.ts`、`packages/shared-contracts/src/index.ts` |

### 背景

SimWar 的教学可信度依赖稳定、可复现、可审计的经营结果。市场份额、需求、现金流、利润、库存、评分、排名和结算状态都属于真值字段，不能由前端、AI、教师手工输入或 Replay 覆盖。

### 决策

`services/simulation-core` 是正式真值链路的当前落点：

```text
canonical Decision
  -> settlement-service
  -> simulation adapter
  -> simulation-core SettlementEngine
  -> market / operations / finance / scoring
  -> SettlementResult / StateSnapshot / ReplayInputManifest
```

当前 `toy_logit_wellness_v1` 只是可替换 engine adapter。后续替换更复杂的 BLP / RCNL 或行业引擎时，必须实现同一 `SettlementEngine` 边界。

### 约束

- 结算只消费 canonical decisions，不消费角色草稿、AI 建议、前端本地状态或未确认 merge。
- settlement 必须幂等。同一 round 重复 settle 应返回同一正式结果或稳定 replay hash。
- 发布后的 result / round 不得被重新 settle 或原位覆盖。
- `state_true` 只允许核心结算链写入，公开视图必须裁剪。

### 后果

该决策把教学结果的可信度集中在结构化核心，而不是散落在前端或 AI 输出中。风险是所有新增业务能力都必须尊重真值边界，开发速度会受 schema、Replay 和测试门禁约束。

## 6. ADR-DATA-001：数据库采用审计事实链与 repository port 边界

| 项目 | 内容 |
| --- | --- |
| 状态 | baseline |
| 实现状态 | partial |
| 验证门禁 | `npm run test:migration`、`npm run test:migration:apply`、`npm run test:postgres-adapter`、`npm test` |
| 证据链接 | `db/migrations`、`services/api/src/repository-ports.ts`、`services/api/src/repository-facade.ts`、`services/api/src/json-repository-adapter.ts`、`services/api/src/postgres-repository-adapter.ts`、`tests/contract/repository-adapter-contract.ts` |
| 相关知识域 | db、services、tests、docs |
| 关键文件 | `db/migrations/*.sql`、`services/api/src/repository-ports.ts`、`services/api/src/json-repository-adapter.ts`、`services/api/src/postgres-repository-adapter.ts`、`tests/contract/repository-adapter-contract.ts` |

### 背景

当前本地运行仍以 JSON / memory store 为主，但项目已经需要 PostgreSQL migration、RLS、审计、Replay、adapter contract 和未来 Supabase/Postgres runtime。若 service 层直接读写具体 store，会使未来迁移数据库时重写业务规则。

### 决策

数据层采用两条并行约束：

- 运行时通过 repository ports / repository facade 访问数据，route/service 不直接依赖具体存储实现。
- 数据库迁移表达事实链：identity/course/run/round/decision、billing/entitlement、data governance、domain event、state snapshot、settlement result、replay、plugin、AI advisory 和 audit。

### 事实链

正式业务事实按追加写、版本化和审计组织：

```text
Decision / RoleDecisionSection / DecisionMergeCommit / TeamConfirmation
  -> DomainEvent / AuditLog
  -> SettlementResult / StateSnapshot
  -> ReplayInputManifest / ReplayReport / ReplayDiffReport
```

### 约束

- 多租户表必须带 `tenant_id`，迁移中启用 RLS / force RLS。
- 关键账本和正式结果不应物理级联删除。
- `ReplayInputManifest`、`StateSnapshot`、`SettlementResult` 和 `AuditLog` 是申诉、复盘和恢复的事实基础。
- route 新增写路径应优先进入 repository port，并由 JSON adapter 与 Postgres adapter contract 共同覆盖。

### 后果

该决策允许本地 JSON runtime 与未来 PostgreSQL runtime 共存，降低迁移风险。代价是新增表、字段或状态时必须同步 port、adapter、migration 和测试。

## 7. ADR-PLUGIN-001：采用行业无关 kernel + 受控插件 hook

| 项目 | 内容 |
| --- | --- |
| 状态 | baseline |
| 实现状态 | partial |
| 验证门禁 | `npm test`、`npm run test:contract`、`npm run test:schema-drift` |
| 证据链接 | `plugins/wellness/plugin.manifest.json`、`services/simulation-core/src/wellness-plugin.ts`、`services/simulation-core/src/types.ts`、`contracts/schemas/plugin-package.v1.json`、`contracts/schemas/wellness-parameters.v1.json`、`services/api/src/routes/governance-routes.ts` |
| 相关知识域 | plugins、services、packages、contracts、db |
| 关键文件 | `plugins/wellness/plugin.manifest.json`、`services/simulation-core/src/wellness-plugin.ts`、`services/simulation-core/src/types.ts`、`contracts/schemas/plugin-package.v1.json` |

### 背景

SimWar 需要支持不同行业场景，但核心仿真链路不能因为行业差异而散落成多套真值逻辑。行业扩展需要能调整参数、需求曲线、运营约束、成本结构和评分权重，同时不能绕过核心结算链。

### 决策

采用“行业无关 kernel + 行业插件”的微内核架构。插件只能通过白名单 settlement hook 影响结构化计算：

- `adjustDemand`
- `adjustOperations`
- `adjustFinance`
- `adjustScore`

当前 wellness v1 插件通过 `plugin.manifest.json` 声明 `supported_hooks`、参数 schema 和 `settlement_hook_refs`，并由 `simulation-core` 在 market / operations / finance / scoring 阶段调用。

### 约束

- 插件不得直接写 `state_true`、score、rank、SettlementResult 或 ledger。
- PluginPackage 绑定正式 run 前应通过治理状态校验；涉及 approval evidence 的完整审批流当前属于继续固化范围。
- ScenarioPackage、ParameterSet、PluginPackage 一旦绑定 Run，正式运行期间不得热替换。
- 插件影响必须进入 `plugin_trace`，用于 Replay、审计和教学解释。

### 后果

该决策让行业扩展可组合、可审计、可回放。风险是 hook 边界过宽会侵蚀真值保护，因此新增 hook 必须先进入 shared contracts、schema、tests 和 Shadow Replay 验证。

## 8. ADR-REPLAY-001：Replay / Shadow Replay 是复现与治理机制

| 项目 | 内容 |
| --- | --- |
| 状态 | baseline |
| 实现状态 | partial |
| 验证门禁 | `npm test`、`npm run test:contract`、`npm run test:e2e:ui` |
| 证据链接 | `services/api/src/replay-service.ts`、`services/api/src/routes/replay-routes.ts`、`contracts/schemas/replay-input-manifest.v1.json`、`contracts/schemas/replay-diff-report.v1.json`、`contracts/fixtures/replay-input-manifest.valid.json`、`docs/quality/replay-shadow-replay-test-plan.md`、`tests/integration/p2-engineering-foundation.test.ts` |
| 相关知识域 | services、packages、db、quality、docs |
| 关键文件 | `services/api/src/replay-service.ts`、`services/api/src/routes/replay-routes.ts`、`contracts/schemas/replay-input-manifest.v1.json`、`docs/quality/replay-shadow-replay-test-plan.md` |

### 背景

仿真系统需要能回答“为什么这个结果出现”“同样输入是否可以复算”“参数或插件升级会影响哪些历史结果”。没有 Replay，正式结算无法被验证、申诉和治理。

### 决策

正式结算必须记录 replayable input manifest，并生成稳定 replay hash。Replay / Shadow Replay 的职责是复现和差异报告，而不是覆盖正式结果。

Replay 输入核心包括：

- Run、Round、Team。
- canonical decisions。
- ScenarioPackage。
- ParameterSet。
- PluginPackage ids。
- engine id。
- seed。

### 约束

- Official Replay 只能读取历史绑定输入，不得覆盖正式 `SettlementResult`。
- Shadow Replay 只能生成候选 `ReplayDiffReport`，不得写成正式成绩。
- role drafts、billing、entitlement、data policy、case candidate 等只能作为治理上下文或 `excluded_from_truth_hash`，不得进入正式 truth hash。
- 参数、插件、评分规则或 engine adapter 变更必须补充 Replay / Shadow Replay 说明和测试。

### 后果

Replay 决策把 SimWar 的结果可信度从“运行时算过一次”提升为“可复现、可比较、可审计”。代价是结算输入必须保持结构化和版本化，不能允许临时字段进入真值 hash。

## 9. ADR-AI-001：AI 当前只允许 advisory-only 输出

| 项目 | 内容 |
| --- | --- |
| 状态 | baseline |
| 实现状态 | implemented |
| 验证门禁 | `npm test`、`npm run test:contract`、`npm run test:schema-drift` |
| 证据链接 | `services/api/src/routes/agent-routes.ts`、`contracts/schemas/coach-output.v1.json`、`contracts/schemas/model-call-log.v1.json`、`contracts/fixtures/coach-output.valid.json`、`contracts/fixtures/model-call-log.valid.json`、`docs/contracts/model-engineering-contract.md` |
| 相关知识域 | services、packages、contracts、db、docs |
| 关键文件 | `services/api/src/routes/agent-routes.ts`、`contracts/schemas/coach-output.v1.json`、`contracts/schemas/model-call-log.v1.json`、`docs/contracts/model-engineering-contract.md` |

### 背景

AI 可以提升教学解释、复盘和陪练体验，但如果 AI 能直接写经营结果、评分或参数，会破坏仿真系统的可信度和可复现性。当前阶段也尚未进入真实模型接入。

### 决策

AI 在当前基线中只允许 advisory-only mock 输出：

- 输出写入 `CoachOutput`。
- 调用日志写入 `ModelCallLog`。
- 两者都必须带 `advisory_only: true`。
- Agent route 对真值相关 prompt / 输出意图进行 guardrail 拦截。

### 约束

- Phase 6 前不得接真实模型。
- AI 不得写 `state_true`、SettlementResult、score、rank、ParameterSet 或任何正式财务结果。
- AI 输出落库前必须经过 schema 校验、权限校验、真值字段检查、事件记录和审计。
- AI 建议只能作为教学辅助、复盘草稿或候选分析，不进入 settlement truth hash。

### 后果

该决策允许产品保留 AI 体验入口，同时不牺牲正式结算链可信度。后续接入真实模型前，必须先补足模型版本、Prompt 版本、越权测试、日志完整性和 Replay 影响评估。

## 10. ADR-DECISION-001：分角色决策必须汇聚为 canonical Decision 后才能结算

| 项目 | 内容 |
| --- | --- |
| 状态 | baseline |
| 实现状态 | implemented |
| 验证门禁 | `npm test`、`npm run test:contract`、`npm run test:e2e:ui` |
| 证据链接 | `packages/shared-contracts/src/index.ts`、`services/api/src/routes/foundation-routes.ts`、`services/api/src/foundation-services.ts`、`services/api/src/routes/decision-routes.ts`、`db/migrations/20260519_002_create_repository_decision_tables.sql`、`contracts/schemas/role-decision-section.v1.json`、`contracts/schemas/decision-merge-commit.v1.json`、`contracts/schemas/team-confirmation.v1.json`、`tests/integration/p0-flow.test.ts` |
| 相关知识域 | apps、services、packages、db、tests |
| 关键文件 | `packages/shared-contracts/src/index.ts`、`services/api/src/routes/foundation-routes.ts`、`services/api/src/foundation-services.ts`、`services/api/src/routes/decision-routes.ts`、`db/migrations/20260519_002_create_repository_decision_tables.sql` |

### 背景

学员端需要支持 CEO、CFO、CMO、COO、risk 等角色协作，但正式结算仍必须看到团队级单一 canonical decision。角色草稿、ready 状态和 merge 候选都不能直接成为结算输入。

### 决策

采用当前核心链路：

```text
RoleDecisionSection(status=draft/ready)
  -> DecisionMergeCommit(status=validated)
  -> TeamConfirmation(status=confirmed)
  -> canonical Decision(canonical_source=role_merge_commit)
  -> official settlement
```

`RoleReadyState` 当前不是独立核心实体，ready 状态由 `RoleDecisionSection.status` 表达。

### 约束

- 角色成员只能写自己的角色 section 和 ready 状态。
- 队长/CEO merge commit 后，团队确认才能生成 canonical decision。
- 当 `canonical_source = "role_merge_commit"` 时，official decision payload 以后端 merge commit 的 `canonical_decision_payload` 为准，不信任客户端提交体中的突变 payload。
- 锁轮前必须确认每个队伍存在 validated canonical decision。

### 后果

该决策把协作过程和正式结算输入分开，避免把半成品草稿送入仿真核心。后续拟新增 `RoleContext`、`RoleWorkspaceSnapshot`、`RoleReadinessSummary`、`role_assignment`、`role_field_policy` 时，必须保持 canonical Decision 仍是 settlement 的唯一团队决策输入。

## 11. ADR-GOV-001：Scenario / ParameterSet / PluginPackage 采用版本化治理

| 项目 | 内容 |
| --- | --- |
| 状态 | baseline |
| 实现状态 | partial |
| 验证门禁 | `npm run test:contract`、`npm run test:schema-drift`、`npm run test:migration`、`npm test` |
| 证据链接 | `contracts/schemas/scenario-package.v1.json`、`contracts/schemas/parameter-set.v1.json`、`contracts/schemas/plugin-package.v1.json`、`services/api/src/routes/governance-routes.ts`、`db/migrations/20260522_006_create_plugin_replay_ai_contract_tables.sql`、`docs/architecture/parameter-set-management.md`、`docs/architecture/industry-plugin-model-report.md` |
| 相关知识域 | services、packages、contracts、db、plugins、quality |
| 关键文件 | `contracts/schemas/scenario-package.v1.json`、`contracts/schemas/parameter-set.v1.json`、`contracts/schemas/plugin-package.v1.json`、`services/api/src/routes/governance-routes.ts` |

### 背景

仿真结果取决于场景、参数、插件、引擎版本和 seed。若这些对象在正式运行期间可被原位修改，Replay 将失去意义，教师也无法解释结果变化。

### 决策

ScenarioPackage、ParameterSet 和 PluginPackage 作为治理对象版本化管理。Run 创建时绑定固定 scenario、parameter set、plugin package ids 和 seed。参数或插件升级必须新建版本；当前基线已具备最小治理 API、状态字段和 Shadow Replay 证据引用，完整审批流、人工审核状态和更严格晋级门禁仍需继续固化。

### 约束

- `ParameterSet` approved 后不可原位覆盖。
- 正在进行中的 Run 不允许热替换参数、插件或 scenario。
- 候选参数 / 插件的晋级应绑定 Shadow Replay 或审批证据；当前实现以最小门禁和证据引用为主，完整审批流需继续补齐。
- 治理对象变化必须进入 domain event 和 audit log。

### 后果

该决策保证正式运行的输入冻结，支撑 Replay、申诉和回滚。代价是参数修正和插件升级不能“就地热修”，必须通过新版本和治理流程交付。

## 12. 后续维护规则

新增或变更架构决策时，应同步检查：

- 是否改变前后端职责边界。
- 是否新增或修改 shared contract、OpenAPI、JSON Schema、fixture。
- 是否影响 simulation-core 真值链路或 `TRUTH_PROTECTED_FIELDS`。
- 是否需要新增 migration、RLS、唯一约束、审计或 domain event。
- 是否新增插件 hook 或改变插件 trace。
- 是否影响 Replay manifest、truth hash 或 Shadow Replay 门禁。
- 是否可能让 AI、前端、教师端、学员端或 Replay 绕过 canonical decision 与 settlement。

若答案为“是”，应新增独立 ADR 或更新本总览，并同步补充相关测试和质量门禁。
