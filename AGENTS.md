# SimWar Agent Development Guide

本文件是 SimWar 仓库的 agent 开发规则，作用范围为整个仓库。
Codex、Claude Code 或其他 coding agent 在本仓库内开发、测试、评审和生成代码时，必须优先遵守本文件。

## Small PR and Worktree Guardrails

- One task equals one small PR.
- Start from the latest origin/master.
- Use an independent branch and worktree for every PR.
- Do not develop in a dirty main workspace.
- Do not reuse merged feature branches or worktrees.
- Do not use git add -A.
- Stage only explicitly allowed files.
- Every PR body must include Summary, Validation, and Scope Notes.
- JSON adapter remains the default runtime.
- Postgres runtime requires an explicit opt-in PR.
- Do not change settlement logic, settlement result shape, replay_hash generation, buildReplayHash inputs, or canonical/latest decision selection.
- Role drafts, AI advice, learning evidence, and analytics-only data must not enter settlement truth.
- Prefer short Codex task cards with Task, Allowed files, Forbidden files, Validation, and Output.

## Quick Rules

- 先读本文件，再读 `DEVELOPMENT_PLAN.md` 和本次任务相关文档。
- 每次处理 SimWar 任务前，优先阅读本文件的 `Read Order` 与 `Required Architecture Pack`；涉及工具链、质量门禁或自动化时，必须同时查看 `docs/architecture/simwar-development-quality-toolchain-roadmap.md`。
- 当前主线是 Phase 2/3 收口：Course、Team、Run、Round、Decision、simulation-core、settlement、contract、fixture、Replay manifest。
- 不急着接真实 AI。Phase 6 之前只能做 advisory-only 契约、`CoachOutput` / `ModelCallLog` 草案和越权测试。
- 结构化仿真内核是真值来源。前端、教师端、学员端、Agent、LLM、Replay 和插件都不得绕过核心结算链改写真值字段。
- 所有 API、事件、决策、状态快照、结算结果、Replay 输入输出必须使用结构化 schema 和共享类型。
- 涉及接口、schema、共享类型、迁移、命令或目录变化时，必须同步更新相关文档和测试。
- 合并前至少运行与变更相关的最小测试；真值、权限、契约、迁移或结算链变更必须跑完整本地门禁。
- 不要提交密钥、令牌、真实用户数据、模型私有权重、本地环境文件或未脱敏企业数据。
- 当前仓库使用 npm workspaces 与 `package-lock.json`。不要假设 pnpm 命令可运行；若文档提到 pnpm，应先确认项目已经完成包管理器迁移或脚本别名建设。

## Current Status

仓库已经从纯文档规划进入本地可运行工程状态。

- Monorepo: npm workspaces + TypeScript。
- Frontend: Vite React apps for admin、teacher、student。
- API: Node.js 原生 HTTP 服务，按 route/service/repository 分层。
- Contracts: OpenAPI、JSON Schema、shared contracts、fixtures。
- Simulation: `services/simulation-core` 先采用 TypeScript engine boundary；Python 仍可作为未来仿真内核目标栈。
- Persistence: 当前本地演示默认使用 JSON / memory store；PostgreSQL adapter 和 SQL migration 作为正式化方向。
- Testing: Vitest、contract check、Postgres replay verification、build gate 已存在。

不要再假定仓库没有 Node.js、测试、前端或服务结构。新增 Python、Docker、CI、数据库或外部服务前，先确认对应配置文件真实存在。

## Read Order

开始任务时按以下顺序收集上下文：

1. `AGENTS.md`
2. `DEVELOPMENT_PLAN.md`
3. 与任务相关的 `docs/architecture/`、`docs/contracts/`、`docs/quality/`、`docs/frontend/` 文档
4. `contracts/openapi/`、`contracts/schemas/`、`contracts/fixtures/`
5. 相关源码与测试文件

## Required Architecture Pack

以下文档是 Codex 处理 SimWar 架构、契约、决策链、质量工具链和测试策略时的首选上下文：

- `docs/architecture/simwar-architecture-overview.md`
- `docs/architecture/simwar-architecture-decisions.md`
- `docs/architecture/student-role-based-decision-refactor.md`
- `docs/architecture/student-role-based-decision-implementation-plan.md`
- `docs/architecture/student-role-based-decision-phase-0-audit.md`
- `docs/architecture/student-role-based-decision-test-strategy.md`
- `docs/architecture/simwar-development-quality-toolchain-roadmap.md`

如果任务涉及 Understand Anything 图谱、影响分析或架构认知同步，还应查看：

- `docs/architecture/understand-anything-usage-log.md`

涉及后置重大变更时，必须同时查看：

- 分角色决策、收费权益、数据隐私、社区竞赛、案例、训练或导出：`docs/architecture/post-document-change-impact-assessment.md`
- Replay / Shadow Replay：`docs/quality/replay-shadow-replay-test-plan.md`
- Phase 2/3 基线冻结、完整本地门禁和 adapter 边界：`docs/quality/phase-2-3-baseline-checklist.md`
- 参数、插件、场景：`docs/architecture/parameter-set-management.md` 与 `docs/architecture/industry-plugin-model-report.md`
- AI / Agent：`docs/contracts/model-engineering-contract.md`

若未来新增 `CLAUDE.md`，它可以作为 Claude Code 的补充入口，但不得覆盖本文件中的真值保护、权限、测试和安全门禁。

## Pre-Change Workflow

修改代码、契约、迁移、测试或重要文档前，必须先完成以下检查：

1. 影响分析：确认本次变更影响 `apps`、`services`、`db`、`packages/shared-contracts`、`contracts`、`plugins`、Replay / settlement 链路中的哪些部分。
2. 文件范围确认：列出预计修改文件，避免把无关工作区改动带入本任务。
3. 禁止事项确认：确认不会破坏 canonical Decision、SettlementResult、Replay truth hash、plugin hook、AI advisory-only 和 schema 一致性边界。
4. 测试策略确认：根据变更范围选择最小测试集；真值、权限、契约、迁移、Replay 或插件边界变更必须补测试护栏。
5. Git 检查：修改前后使用 `git status` 和必要的 `git diff` 理解当前工作区；不得回滚或覆盖其他人已有修改。

## Product Architecture

SimWar 采用“行业无关内核 + 行业插件”的微内核架构。

- Core kernel: 负责对象模型、仿真推进、市场/运营/财务真值计算、评分、事件存储和权限边界。
- Industry plugins: 负责行业参数、场景、需求曲线、成本结构、政策规则和教学内容扩展。
- Agent services: 只提供建议、诊断、复盘或候选决策；不得直接改写真值字段。
- Applications: 教师端、学员端、企业后台、竞赛平台和社区界面通过 API 调用核心能力。

核心原则：结构化仿真引擎是真值来源。LLM 或 Agent 输出必须经过 schema 校验、权限校验、真值字段检查、事件记录和可回放输入保存。

## Quality Toolchain Roles

SimWar 的质量工具链按以下职责分工理解和使用：

- Understand Anything：理解项目结构、知识图谱和影响范围。
- Codex：小步生成方案、文档、代码和测试。
- GitHub Actions / Harness：自动质量门禁、发布审批、环境发布和回滚治理；当前优先使用 GitHub Actions，Harness 作为中后期发布治理平台。
- Vitest：当前保护 unit / service / contract 基线；Playwright / Pact 属于后续 E2E 与 consumer-driven contract 能力，落地前不得写成当前可运行门禁。
- OpenAPI / Spectral / JSON Schema：冻结 API、schema、fixtures、shared-contracts 契约。
- Codecov / SonarQube / Snyk 或 OWASP Dependency-Check：覆盖率趋势、代码质量、安全和供应链风险。
- Renovate / Dependabot：依赖更新和安全补丁自动化，必须受 CI 门禁约束。
- Storybook / Chromatic / Lighthouse CI：三端 UI 工作台、视觉回归、性能和可访问性。
- Sentry / OpenTelemetry：上线后的错误监控、链路追踪和运行质量反馈。

不要把尚未配置到仓库的工具当作当前可运行能力。引入新工具前，先更新路线图或设计文档，再小步补 scripts、CI 和测试。

## Current Development Focus

近期开发按以下优先级推进：

1. Phase 2/3 收口：冻结并补齐 Course / Team / Run / Round / Decision 的 OpenAPI、JSON Schema、共享类型和 fixtures。
2. 正式化状态机：多队伍、多回合、重复提交、锁轮前校验、发布后只读、结算幂等。
3. simulation-core 边界：市场、运营、财务、评分四个子模块接口保持可替换；`toy_logit` 只作为 adapter，不得扩散到业务层。
4. wellness v1 最小插件：参数、需求曲线、成本结构、settlement hook、plugin trace 可审计。
5. Replay foundation：manifest、hash、diff report、golden、replay、idempotency 测试先做扎实。
6. 教师端/学员端完整闭环：课程、队伍、回合、决策表单、结果页、权限裁剪、错误态。
7. AI 后置：先做 advisory-only 契约、日志、越权测试和 mock 输出，再接真实模型。

## Phase Strategy

- Phase 1 前以文档、影响分析、契约盘点和计划拆分为主；不要直接修改业务代码，除非用户明确要求执行实现任务。
- Phase 1 优先冻结 contracts、schemas、fixtures、OpenAPI 和 shared-contracts。
- Phase 2 之后再推进 migration、repository ports、repository facade 和 adapter contract 的正式化。
- settlement、Replay、plugin boundary、AI advisory-only、权限和真值链相关修改必须有测试护栏。
- 文档、契约、业务代码、migration 和 CI 调整应尽量分开变更，便于 review 和回滚。

## Repository Layout

新增代码时优先按当前结构组织；如实际技术栈调整，必须同步修改本节。

```text
apps/
  admin/                企业或平台后台
  teacher/              教师端应用
  student/              学员端应用
services/
  api/                  主业务 API 服务
    src/server.ts       HTTP 入口和路由调度器，不承载长业务逻辑
    src/routes/         auth/tenant/user/rbac/course/round/decision/settlement/audit 路由模块
    src/repositories.ts 本地 repository、domain event ledger、state snapshot repository 抽象
    src/foundation-services.ts
                         分角色决策、收费权益、数据政策和案例治理的 service/repository/command 层
    src/replay-service.ts
                         Replay input manifest、manifest hash 和最小 diff report
    src/repository-ports.ts
                         JSON/Postgres/Supabase adapter 必须遵守的数据访问端口
    src/repository-facade.ts
                         同步 JSON runtime 到 async Postgres runtime 的 route-facing facade
    src/json-repository-adapter.ts
                         当前内存/文件 JSON store 的 repository port 适配器
    src/postgres-repository-adapter.ts
                         PostgreSQL/Supabase adapter 的 async port 草案
  simulation-core/      仿真内核、结算、评分、插件 hook 和 engine adapter
  agent-gateway/        未来 Agent 调度、权限过滤、输入输出校验
plugins/
  wellness/             未来康养行业插件包目录；当前最小实现位于 simulation-core
packages/
  shared-contracts/     跨 API、前端、测试和仿真内核共享的结构化类型
contracts/
  openapi/              REST API 契约
  schemas/              JSON Schema 契约
  fixtures/             contract test 使用的固定样例
tests/
  contract/             契约测试
  unit/                 单元测试
  integration/          集成测试
  e2e/                  前门冒烟和未来浏览器 E2E
  replay/               未来 Replay / Shadow Replay 测试
docs/
  architecture/         架构与方案文档
  contracts/            API、模型和工程契约
  quality/              测试覆盖、Replay 和 Shadow Replay 计划
  frontend/             教师端/学员端架构与状态流
  devops/               部署、运维、回滚文档
db/
  migrations/           SQL-first PostgreSQL migration 文件；当前由 npm run test:postgres-replay 覆盖真实 Postgres replay / migration 验证，专项 migration scripts 仍属后续治理
```

## Development Commands

只运行真实存在的命令。新增技术栈后，把真实命令写回本节。

当前真实包管理器是 npm。以下 npm 命令来自根目录 `package.json`，可以在对应场景中运行。运行前仍应以当前 `package.json` 为准：

```powershell
# Inspect repository files
rg --files

# Install declared dependencies
npm ci

# Currently implemented quality and verification commands
npm run check:hidden-unicode
npm run format:check
npm run lint
npm run security:audit
npm run typecheck
npm test
npm run test:contract
npm run test:postgres-replay
npm run build

# Local dev servers
npm run dev:api
npm run dev:admin
npm run dev:teacher
npm run dev:student
```

以下是质量工具链路线图推荐的标准命令名或尚未落地的专项门禁，但当前不应假设可运行；除非 `package.json` 或包管理器配置已经补齐，否则将它们视为拟新增命令：

```powershell
# Planned command names; verify before running
npm run quality
npm run lint:boundaries
npm run check:unused
npm run test:coverage
npm run check:schemas
npm run check:migrations
npm run test:migration
npm run test:migration:apply
npm run test:postgres-adapter
npm run test:e2e
npm run test:e2e:ui
npm run test:replay
npm run test:settlement-idempotency
npm run test:plugin-boundary
npm run openapi:lint
npm run schema:check
```

当前 npm 命令与拟新增命令的大致对应关系：

| Target capability                             | Current repository status                                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Full local aggregate quality gate             | Planned; `npm run quality` does not exist yet                                                                                    |
| Architecture boundary lint                    | Planned; `npm run lint:boundaries` does not exist yet                                                                            |
| Knip unused/dependency gate                   | Configuration exists in `knip.json`, but `knip` dependency, script, and CI gate do not exist yet                                 |
| Coverage gate                                 | Planned; `npm run test:coverage` does not exist yet                                                                              |
| Dedicated schema gate                         | Planned; current `npm run test:contract` performs baseline contract presence checks                                              |
| Dedicated migration static gate               | Planned; `npm run check:migrations` / `npm run test:migration` do not exist yet                                                  |
| Dedicated migration apply gate                | Planned; `npm run test:migration:apply` does not exist yet                                                                       |
| Dedicated Postgres adapter gate               | Planned; `npm run test:postgres-adapter` does not exist yet                                                                      |
| Playwright E2E gate                           | Configuration exists in `playwright.config.ts`, but `@playwright/test`, E2E scripts, E2E test files, and CI job do not exist yet |
| Replay / settlement / plugin boundary专项门禁 | Planned; coverage currently lives in Vitest and Postgres replay verification where applicable                                    |
| pnpm command set                              | Planned only; current repository uses npm workspaces and `package-lock.json`                                                     |

````

Python commands are allowed only when a `pyproject.toml` or equivalent Python project exists:

```powershell
poetry install
poetry run pytest
poetry run ruff check .
poetry run black --check .
````

Docker commands are allowed only when the relevant Dockerfile / compose target exists:

```powershell
docker build -t simwar/service:local .
```

本地 API 默认使用 `tmp/simwar-store.json` 作为开发快照文件。自动化测试应使用 memory store，避免依赖或污染本地开发快照。

## Quality Gates

按变更范围选择测试，但不要跳过与风险直接相关的门禁。

- 文档-only：至少检查 Markdown 结构；若涉及命令、目录、契约或计划，确认对应源码/脚本仍存在。
- shared contracts / schema / fixtures：当前可运行 `npm run typecheck`、`npm test`、`npm run test:contract`。
- API routes / repository / settlement：当前可运行 `npm run lint`、`npm run typecheck`、`npm test`、`npm run test:contract`。
- DB migration / Postgres adapter：当前可运行 `npm run test:postgres-replay`；`test:migration:apply` 和 `test:postgres-adapter` 是后续专项门禁，新增前不得写成现有能力。
- simulation-core / plugin hook：`npm test`，必须覆盖 golden、replay hash、idempotency、plugin trace。
- frontend：`npm run typecheck`、`npm run build`，关键交互变更要用 Browser / Playwright 验证。
- 权限、真值、Replay、Agent、AI 边界：必须补 contract / integration / security-style 测试。
- 发布前或大改动：运行当前可用的相关命令集合；`npm run quality` 聚合脚本尚未实现前，不得声称已经运行完整本地聚合门禁。

若无法运行测试，交付说明必须写明原因、影响范围和替代验证。

## Coding Rules

- 优先沿用仓库既有技术栈、目录结构、命名和测试风格。
- 使用 `rg` / `rg --files` 搜索；手工编辑使用 `apply_patch`。
- 保持变更聚焦；不要在功能修复中混入无关重构。
- 接口、事件、模型输入输出必须使用结构化 schema，不要依赖临时字符串拼接。
- 业务规则应放在核心内核或行业插件中；Agent 服务不得隐藏结算逻辑。
- 前端不能自行计算正式市场份额、利润、评分、排名或结算状态。
- 所有用户可见文案、教学反馈和复盘报告应可追溯到输入数据、决策日志或评分规则。
- 新增共享模块时必须补充最小单元测试；跨服务行为必须补充契约测试或集成测试。
- 不要无故引入新框架、数据库、队列、AI SDK 或大型依赖。
- 不要修改与任务无关的文件；不要回滚用户或其他 agent 的未提交变更。

## Truth Protection

以下字段类型属于真值字段，只能由核心仿真引擎或受控插件路径计算和写入：

- 市场份额、需求量、成交量、价格指数
- 现金流、利润、资产负债、融资结果
- 库存、产能、生产成本、交付结果
- 评分、排名、胜负结果、结算状态
- 任何用于教学评价、竞赛排名或财务结算的最终指标

Agent 可以读取必要上下文并生成建议，但输出必须写入 advisory、candidate、draft 或 event log。不得让 LLM、前端、教师端、学员端、Replay 或外部服务直接覆盖真值字段。

## Decision And Settlement Guardrails

涉及学员端、队伍、决策、锁轮、结算、Replay 或 AI 角色建议时，必须遵守分角色决策链：

```text
RoleDecisionSection(status=draft/ready) -> DecisionMergeCommit -> TeamConfirmation -> canonical Decision -> official settlement
```

- 角色成员只能写自己的 `RoleDecisionSection`、ready 状态和协作证据。
- `RoleReadyState` 不是独立核心实体；ready 状态优先由 `RoleDecisionSection.status` 表达。
- 正式结算只能消费队长/CEO merge commit 后、团队确认后的 canonical decision。
- canonical Decision 不能被 role draft、AI advisory、learning evidence 或未确认 merge 污染。
- 角色草稿、AI 建议、前端本地状态和未确认 merge 不得进入 L1-L3 结算。
- 锁轮前必须校验每个队伍都有 validated canonical decision。
- 发布后的 round/result 是只读对象；不得重新 settle 或修改正式结果。
- 重复 settle 必须幂等，返回同一正式结果或稳定 replay hash，不得重复产生副作用。

## Billing, Entitlement And Data Governance

涉及课程访问、企业购买、班级类型、插件、AI 额度、导出、财务或后台时，必须遵守：

```text
PaymentOrder -> PaymentTransaction -> Entitlement activation -> EntitlementLedger -> access-check
```

- Payment、Billing、Entitlement 是独立控制面。
- 支付成功不得自动等于课程、插件、AI 额度或导出权益激活。
- Entitlement ledger 只能控制访问、额度和功能，不得写入市场、运营、财务、评分、排名或 ParameterSet。

涉及数据隐私、案例库、社区、竞赛、训练或跨课程复用时，必须遵守：

- `policy_default.training_enabled`
- `policy_default.public_reuse_enabled`
- `policy_default.cross_course_reuse_enabled`

以上字段只表示进入候选流程的默认意图。实际训练、公开、跨课程复用必须以 `effective_processing_status.*=approved`、同意记录、脱敏、人工审核和审计链为准。

社区、竞赛、案例库和训练样本开发必须默认防止未发布成绩、对手策略、企业私有数据、受限品牌内容和未脱敏案例外泄。

## Simulation Core And Plugins

- `services/simulation-core` 是正式仿真边界的当前落点。
- 市场、运营、财务、评分模块必须保持清晰接口，避免把业务规则散落在 API route 或前端。
- `toy_logit_wellness_v1` 只应作为可替换 engine adapter；新引擎必须实现相同 `SettlementEngine` 边界。
- wellness v1 插件最小能力包括参数、需求曲线、成本结构、settlement hook 和 plugin trace。
- 插件只能在白名单 hook 内影响结构化计算，不得直接写 `state_true`、score、rank、`SettlementResult` 或 ledger。
- ScenarioPackage、PluginPackage、ParameterSet 一旦绑定 Run，正式运行期间不得热替换。
- ParameterSet 发布后不可原位覆盖；任何调整必须新建版本并走审批与 Shadow Replay。

## Replay And Shadow Replay

- 正式结算必须记录 replayable input manifest。
- Replay 只能读取历史绑定输入、参数、场景、插件、engine id 和 seed，不得覆盖正式 SettlementResult。
- Shadow Replay 只能生成候选差异报告，不得写成正式结果。
- Replay manifest 只纳入 canonical decisions、scenario、parameter set、teams、engine、plugin ids、seed。
- Replay truth hash 不得包含 AI advisory、learning evidence、role drafts、billing、entitlement、data policy 或 case candidate。
- role drafts、billing、entitlement、data policy、case candidate 只能作为治理上下文或 `excluded_from_truth_hash`，不得影响正式 truth hash。
- 参数、插件、评分规则或 engine adapter 变更必须补 replay / shadow replay 说明和测试。

## Agent And AI Contracts

所有 Agent 接口必须明确输入、输出、版本和权限。最小请求结构：

```json
{
  "agentType": "MarketStrategy",
  "version": "1.0.0",
  "actor": {
    "role": "student",
    "teamId": "team-001"
  },
  "scenarioId": "scenario-001",
  "round": 1,
  "payload": {}
}
```

最小响应结构：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "recommendations": [],
    "confidence": 0.8,
    "explanations": []
  }
}
```

Agent 输出落库前必须经过：

1. schema 校验
2. 权限校验
3. 真值字段写入检查
4. 事件日志记录
5. 可回放输入保存

Phase 6 前不得接真实模型。AI 相关开发必须先完成：

- advisory-only 输出 schema
- `CoachOutput`、`ModelCallLog`、`ModelVersion`、`PromptVersion` 契约
- 输出字段白名单和真值字段黑名单
- 越权、提示注入、schema fail、日志完整性测试
- mock / fixed advisory 输出

## Security And Compliance

- 训练、评估和复盘数据必须脱敏，避免暴露学生、企业、团队或个人敏感信息。
- 不同角色的数据访问必须隔离：教师、学生、管理员、企业用户和 Agent 服务只获得必要权限。
- 外部模型、数据集和依赖必须检查许可证、来源和安全风险。
- 关键操作必须记录审计日志，包括参数修改、模型部署、Agent 调用、评分结算、Replay、导出和人工干预。
- 模型、参数、插件和评分规则必须可回滚；上线前需通过 Replay / Shadow Replay 或灰度验证。

## Tool Autonomy And Confirmation

在本地开发、测试、文档、代码修改、浏览器验证和 Git 本地提交范围内，agent 可以默认自动调用相关工具并自主推进任务，无需用户逐步确认。

默认可自动执行：

- 读取、搜索、比较和修改本仓库文件。
- 使用 `rg`、Shell、`apply_patch`、Git diff 等工具进行代码和文档开发。
- 安装或使用项目已声明的本地依赖。
- 运行当前 `package.json` 中真实存在且与变更范围相关的命令，例如 `npm run check:hidden-unicode`、`npm run format:check`、`npm run lint`、`npm run security:audit`、`npm run typecheck`、`npm test`、`npm run test:contract`、`npm run test:postgres-replay`、`npm run build`。规划中的命令必须先确认已经落地再运行。
- 启动、检查或停止本地开发服务，例如 API、教师端、学员端和本地依赖容器。
- 使用 Browser / Playwright 等工具验证本地页面、交互流程、控制台错误和响应式表现。
- 根据 `DEVELOPMENT_PLAN.md` 中的模块推荐工具自动选择实现、验证、安全和质量工具。
- 在任务完成后进行本地 Git 检查；如任务明确要求提交，可按 Conventional Commits 创建本地提交。

以下操作必须先说明风险并等待用户明确指令：

- 外部账号授权或连接器授权，例如 GitHub、Google Drive、Gmail、Google Calendar、Supabase、Figma、Canva 等首次登录或 OAuth 授权。
- 生产环境、预发布环境、真实客户环境或远端数据库操作。
- 删除数据库、清空目录、批量删除文件、重写 Git 历史、强制推送、覆盖远端分支等不可逆或高破坏性操作。
- 发布 PR、推送远端、发送邮件、创建日程、共享文档、公开发布内容或触发付费资源。
- 处理真实密钥、令牌、真实用户数据、企业敏感数据、模型私有权重或未授权内容。
- 任何可能让 AI 或 Agent 绕过真值保护、权限边界、审计链路或 Replay / Shadow Replay 门禁的操作。

即使用户授权自动执行，仍必须遵守本文件的真值保护、安全合规、测试和文档规则。若推荐工具不可用，应说明原因并采用安全替代方案。

## Git And Review Rules

- 提交信息使用 Conventional Commits，例如 `feat: add market agent contract`。
- 每次只提交本任务相关文件；不要把无关工作区改动带入提交。
- 提交前必须确认 `git status` 和 `git diff`，并能说明变更范围、测试结果、风险和回滚方式。
- 文档、契约、业务代码、migration、CI 配置应尽量分 commit 提交。
- 每个 PR 应说明变更范围、测试结果、风险和回滚方式。
- 接口或真值模型变更必须附带契约更新和回放验证说明。
- 不要提交密钥、令牌、真实用户数据、模型私有权重或本地环境文件。
- 不要使用 destructive git 命令回滚用户或其他 agent 的改动，除非用户明确要求。

## Audit-driven Pull Request Governance

All pull requests must use the repository PR template. Audit remediation work
must follow `docs/governance/audit-remediation-process.md`.

## Documentation Rules

- 架构方案、里程碑和长篇背景资料放入 `docs/`，不要塞进本文件。
- 本文件只保留 agent 开发所需的可执行规则和约束。
- 若命令、目录、服务名或契约发生变化，更新代码的同一变更中必须更新对应文档。
- `AGENTS.md` 应保持短路径、强约束、可执行；细节证明和长表格应链接到 `docs/`。
