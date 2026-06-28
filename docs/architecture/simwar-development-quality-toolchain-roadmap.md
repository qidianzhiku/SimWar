# SimWar 开发质量工具链路线图

更新时间：2026-05-27  
适用范围：SimWar monorepo，包括 `apps` 三端前端、`services` 后端服务、`db` migration、`packages/shared-contracts`、`plugins` 插件机制，以及 Replay / settlement 真值链路。

本文基于当前 Understand Anything 子图谱、架构总览、重构方案、实施计划和测试策略整理。它是长期项目治理路线图，不代表所有工具已经落地；所有建议应按阶段接入，并始终服从 SimWar 的真值保护、契约优先和 Replay 可复现原则。

## 1. 第一层：必须先做，成本最低、收益最大

第一层应该最先做，因为它用最低成本建立“每次变更都必须被验证”的基础质量门禁。SimWar 的核心风险不是单个页面样式错误，而是 canonical Decision、SettlementResult、Replay truth hash、shared-contracts、db migration、plugin hook、AI advisory-only 边界之间出现漂移。一旦这些边界被破坏，系统会出现“结果看似正常，但真值链路不可审计、不可复现”的问题。

这一层的目标是先把最小质量闭环跑起来：类型检查、单元测试、契约校验、迁移校验、核心结算测试、插件边界测试和基础 E2E。

### 1.1 GitHub Actions / Harness：CI 质量门禁

GitHub Actions 适合作为当前阶段的轻量 CI。它和 GitHub PR 流程天然集成，配置成本低，适合快速把本地质量命令变成合并前门禁。对 SimWar 当前阶段来说，GitHub Actions 应承担“每个 PR 都跑基础质量检查”的职责。

Harness 更适合中后期作为完整 CI/CD、审批、环境发布和回滚治理平台。等 SimWar 进入多人协作、staging / production 环境、制品管理、人工审批和灰度发布阶段后，再把 GitHub Actions 的质量结果接入 Harness 或迁移到 Harness pipeline 会更稳妥。

当前建议：先基于 GitHub Actions 建立阻断型质量门禁，后续再接 Harness 做发布治理。

SimWar 的 CI 门禁至少应覆盖：

- `pnpm install`
- `pnpm run typecheck`
- `pnpm run quality`
- `pnpm test`
- contract / schema 校验
- migration 校验
- replay golden test
- settlement idempotency test
- plugin boundary test

这些门禁对 SimWar 特别重要：

- canonical Decision 是正式结算唯一输入，CI 必须阻止 role draft、AI advisory 或未确认 merge 进入 settlement。
- SettlementResult 是教学评价、排名和财务模拟的真值输出，CI 必须验证幂等、只读和可审计。
- Replay truth hash 决定历史结果是否可复算，CI 必须验证 hash 输入不包含 AI advisory、learning evidence、billing 或 data governance 上下文。
- `packages/shared-contracts`、OpenAPI、JSON Schema 和 fixtures 是跨前端、API、测试、adapter 的共同语言，CI 必须阻止字段漂移。
- db migration 是 Postgres runtime 的正式边界，CI 必须验证 migration 可以 apply，且 adapter contract 与表结构一致。
- plugin hook 只能在白名单内影响结构化计算，CI 必须验证插件不能直接写 `state_true`、score、rank 或 SettlementResult。
- AI 在当前阶段只能 advisory-only，CI 必须验证 CoachOutput / ModelCallLog 不能写入 truth fields。

建议 CI 结构：

```text
install
  -> format / lint / typecheck
  -> unit / integration / contract
  -> schema drift / migration
  -> simulation-core golden / settlement idempotency
  -> replay golden / plugin boundary
  -> build / e2e smoke
```

### 1.2 Vitest：单元测试 / 服务测试 / shared-contracts 测试

Vitest 是 SimWar 当前阶段最适合的测试基础设施。它与 TypeScript、Vite、monorepo 和现有测试目录匹配，适合快速覆盖纯函数、服务状态机、repository adapter 和 shared-contracts 逻辑。

Vitest 在 SimWar 中应重点覆盖：

- `RoleDecisionSection`：角色草稿保存、ready、撤回 ready、权限边界、重复提交。
- `DecisionMergeCommit`：merge 来源、冲突处理、validated 状态、版本递增、canonical input 生成。
- `TeamConfirmation`：团队确认、重复确认、锁轮前校验、确认后只读。
- `SettlementResult`：幂等写入、发布后只读、StateSnapshot 写入、Replay manifest 记录。
- repository adapter：JSON adapter / Postgres adapter 的同一行为契约，包括自然键 upsert、ledger append、tenant isolation、ReplayRun / ReplayReport、CoachOutput / ModelCallLog。
- `simulation-core` pure functions：market、operations、finance、scoring、toy-logit adapter、wellness 参数解析。
- plugin adapter：manifest、hook 白名单、参数 schema、settlement hook trace。
- shared-contracts 类型与 schema 相关逻辑：枚举一致性、字段必填、fixture 可验证。

适合目录：

- `tests/unit/*`
- `tests/integration/*`
- `tests/contract/*`
- `services/simulation-core/src/*`
- `services/api/src/*`
- `packages/shared-contracts/src/*`

可能涉及的测试文件：

- `tests/unit/decision-schema.test.ts`
- `tests/unit/simulation-core.test.ts`
- `tests/unit/json-repository-adapter.test.ts`
- `tests/integration/p2-engineering-foundation.test.ts`
- `tests/integration/postgres-repository-adapter.test.ts`
- `tests/integration/async-repository-facade.test.ts`
- `tests/contract/repository-adapter-contract.ts`

进入 CI 的建议方式：

```text
pnpm test
pnpm run test:coverage
pnpm run test:contract
pnpm run test:postgres-adapter
```

早期不必追求覆盖率数字漂亮，先保证真值链、状态机、adapter contract 和 schema drift 被测试锁住。

### 1.3 Playwright：E2E 测试

SimWar 有 student、teacher、admin 三端，浏览器端到端测试是必要的。Vitest 能证明服务和状态机正确，但不能证明用户真的能从登录、协作、提交、结算、发布到查看结果完整走通。

重点 E2E 流程：

- 学员登录。
- 进入角色工作区。
- 提交角色决策。
- 教师端查看。
- merge / confirm。
- settlement 只消费 canonical Decision。
- Replay 不受角色草稿污染。
- 管理端权限边界检查。

建议分阶段接入：

- 当前建议：只做少量 frontdoor smoke 和一条 teacher -> student -> settlement -> publish 主流程。
- 近期接入：补齐错误态，如重复提交、锁轮后只读、发布后只读、跨角色越权。
- 中期接入：覆盖 admin 权限、Replay / Shadow Replay、参数审批和插件治理入口。

避免 E2E 一开始过重的原则：

- 每条 E2E 只验证一个用户价值链，不在 E2E 中重复所有服务层断言。
- 复杂状态机优先用 Vitest integration 覆盖，E2E 只验证页面和真实 API 协作。
- 使用固定 fixture 或测试 runtime，避免依赖本地开发快照。
- 把 trace、screenshot、video 作为失败诊断 artifact，而不是每次人工查看。

## 2. 第二层：强烈建议做，保护“契约优先”架构

第二层的目标是保护 SimWar 的 shared contracts、OpenAPI、JSON Schema、fixtures、TypeScript types 不发生漂移。SimWar 的系统形态决定了契约不是文档装饰，而是前端、API、repository adapter、db migration、simulation-core、Replay 和 AI advisory 的共同边界。

### 2.1 OpenAPI + Spectral：API 规范校验

OpenAPI 定义 REST API 的公开契约，Spectral 负责规则化检查。它们用于防止：

- API 字段命名不一致。
- `role_key` / `roleKey` 混用。
- status 枚举漂移。
- response schema 和 shared-contracts 不一致。
- services route 与 OpenAPI 文档不一致。

可能涉及：

- `contracts/openapi/*`
- `contracts/schemas/*`
- `packages/shared-contracts/src/*`
- `services/*/routes/*`
- `tests/contract/*`

建议规则方向：

- 路径、方法、operationId 命名稳定。
- response envelope 一致。
- enum 必须引用统一 schema 或共享定义。
- truth fields 不出现在不该暴露给学员或 AI 的 response schema 中。
- error code、audit event、status transition 使用统一命名。

Spectral 适合在近期接入，先作为报告型检查运行；当 OpenAPI 与 shared-contracts 更稳定后，再升级为阻断合并门禁。

### 2.2 Pact：前后端契约测试

Pact 或 consumer-driven contract testing 适合验证前端消费者真正需要的 API 契约，而不仅是服务端文档是否自洽。

适合验证：

- student app 需要哪些 role decision API。
- teacher app 需要哪些 confirmation API。
- admin app 需要哪些 entitlement / governance API。
- services 是否真的满足前端请求与响应契约。

在 SimWar 中，Pact 的价值尤其体现在三端分离：

- student 不能看到未发布的 truth fields。
- teacher 可以查看教学管理需要的聚合状态，但不能让前端写正式结果。
- admin 可以做治理和权限配置，但不能绕过 settlement truth chain。

Pact 不一定要立刻接入。建议 Phase 1 到 Phase 3 在 contracts / API 稳定后作为增强质量门禁引入。早期可以先用 Playwright smoke + Vitest route tests 承担主流程验证。

### 2.3 JSON Schema / schema drift 检查

SimWar 必须防止以下漂移：

- OpenAPI、JSON Schema、shared TypeScript types、fixtures 不一致。
- DB migration 与 contract schema 脱节。
- decision、confirmation、settlement、replay 相关状态枚举不一致。
- 新增字段没有同步 fixture 和测试。

建议门禁：

- schema drift check。
- fixtures validation。
- OpenAPI schema validation。
- shared-contracts typecheck。
- contracts tests。

建议检查链路：

```text
packages/shared-contracts/src/index.ts
  -> contracts/schemas/*.v1.json
  -> contracts/fixtures/*.valid.json
  -> contracts/openapi/p0-api.openapi.yaml
  -> tests/contract/*
  -> services/api/src/routes/*
  -> db/migrations/*
```

关键对象应优先纳入漂移检查：

- Course / Team / Run / Round / Decision。
- RoleDecisionSection / DecisionMergeCommit / TeamConfirmation。
- SettlementResult / StateSnapshot / ReplayInputManifest。
- ReplayRun / ReplayReport / ReplayDiffReport。
- ScenarioPackage / PluginPackage / ParameterSet。
- CoachOutput / ModelCallLog。
- PaymentOrder / EntitlementLedger / CourseDataPolicy / CaseConsent。

## 3. 第三层：前端质量工具

第三层主要保护 student、teacher、admin 三端 UI、交互和视觉稳定性。它不应阻塞早期契约开发，但在产品流程开始稳定后非常有价值。

### 3.1 Storybook：三端 UI 组件工作台

Storybook 可用于隔离开发、测试和文档化 UI 组件。它让前端组件脱离完整后端流程也能被审查、复用和视觉验证。

适合沉淀的 SimWar 组件：

- student 角色工作区组件。
- teacher 决策确认组件。
- admin 权限配置组件。
- role readiness 状态组件。
- settlement result 展示组件。
- replay / comparison / history 相关组件。

建议组件分层：

- 通用状态组件：Badge、EmptyState、ErrorState、LoadingState。
- 业务状态组件：RoundStatus、RoleReadiness、DecisionProgress、ParameterSetStatus。
- 真值展示组件：SettlementResultPanel、PublishedResultTable、ReplayDiffSummary。
- 权限裁剪组件：RoleBasedActionBar、ReadOnlyNotice、TruthFieldGuardView。

Storybook 适合在前端组件逐渐稳定后接入，不一定在 Phase 1 立刻做。它的最佳接入点是教师端/学员端主流程完成后，开始需要多人维护 UI 状态时。

### 3.2 Chromatic：视觉回归测试

Chromatic 适合在 Storybook 稳定后接入，用于防止：

- Codex 修改组件时破坏样式。
- student / teacher / admin 三端 UI 发生意外视觉变化。
- 状态组件、结果展示组件、复杂表格页面出现视觉回归。

重点保护页面：

- student 角色工作区。
- teacher course / team / run / round 工作台。
- admin governance / entitlement / user management。
- ReplayReport 详情页。
- SettlementResult 发布页。

Chromatic 属于中后期增强项。建议先让 Playwright E2E 和基础 CSS/组件结构稳定，再把视觉回归纳入 PR 检查。

### 3.3 Lighthouse CI：性能与可访问性门禁

Lighthouse CI 可用于：

- 学生端首屏性能。
- 教师端大表格页面性能。
- 移动端可访问性。
- 页面加载速度。
- 交互延迟。
- 基础 accessibility 检查。

SimWar 中优先关注：

- student app 首屏和决策表单可用时间。
- teacher app 大量团队、回合、结果列表的加载性能。
- admin app 权限配置和治理列表的可访问性。
- 发布结果页的可读性和移动端布局。

Lighthouse CI 适合前端稳定后再接入，不应该阻塞早期契约开发。早期只需保留人工或 Playwright smoke 验证，等页面形态稳定后再设置性能预算。

## 4. 第四层：代码质量、安全和依赖治理

第四层用于防止 Codex 或人工提交引入低质量代码、安全漏洞和依赖风险。它不替代业务测试，但能持续发现复杂度、重复、漏洞和依赖风险。

### 4.1 SonarQube：代码质量与安全扫描

SonarQube 适合发现：

- bugs。
- vulnerabilities。
- code smells。
- 复杂度过高。
- 重复代码。
- 隐性安全问题。

SimWar 重点扫描区域：

- `services`。
- `services/simulation-core`。
- settlement。
- replay。
- `packages/shared-contracts`。
- `plugins`。
- `apps` 三端关键逻辑。

重点规则建议：

- 高复杂度 route / service 需要拆分。
- settlement / replay / adapter 中重复逻辑需要评估抽象。
- 任何 truth fields 写入路径都应可追踪。
- API 输入解析不能绕过 schema 或权限校验。
- AI advisory 相关代码不得调用 truth write helper。

SonarQube 建议在 Phase 1 到 Phase 3 接入，先作为质量报告和 PR 注释，等误报收敛后再设置阻断门槛。

### 4.2 Codecov：覆盖率趋势和 PR 覆盖率

Codecov 的价值不是追求 100% 覆盖率，而是保护关键链路不被无意削弱。

SimWar 关键覆盖区域：

- decision merge。
- team confirmation。
- settlement idempotency。
- replay truth hash。
- plugin boundary。
- shared-contracts schema。
- migration repository adapter。

建议策略：

- 对全仓设置温和覆盖率阈值。
- 对关键目录设置更高要求，例如 `services/api/src/settlement-service.ts`、`services/api/src/replay-service.ts`、`services/simulation-core/src/*`。
- 对 PR 覆盖率变化做提醒，避免新增代码没有测试。
- 不在早期强行设置过高门槛，防止开发节奏被低价值覆盖率拉慢。

Codecov 适合现在立刻做，至少把 coverage artifact 和 PR trend 建起来。

### 4.3 Renovate / Dependabot：依赖自动更新

小团队可以先用 Dependabot，因为配置简单、和 GitHub 集成直接。等 monorepo 依赖复杂、更新策略需要分组、自动合并和版本策略时，可以升级到 Renovate。

自动依赖升级必须配合 CI 门禁。依赖升级 PR 不应绕过：

- replay tests。
- settlement tests。
- contract tests。
- schema drift checks。
- migration checks。
- Playwright smoke。

适用范围：

- npm / pnpm 依赖。
- GitHub Actions 版本。
- 前端工具链。
- testing libraries。
- security patch。

建议策略：

- security patch 单独分组，优先处理。
- testing / lint / build toolchain 单独分组，降低变更风险。
- React / Vite / Playwright 等前端关键工具升级必须跑 E2E。
- DB / pg / schema tooling 升级必须跑 migration apply 和 adapter contract。

### 4.4 Snyk / OWASP Dependency-Check：供应链安全

如果 SimWar 商业化或交付客户，建议至少接入一个 SCA 工具，用于：

- 依赖漏洞扫描。
- 开源许可证风险。
- transitive dependency 漏洞。
- 高危包预警。

建议分阶段：

- 当前建议：保留 `security:audit` 和 Dependabot security update。
- 近期接入：选择 Snyk 或 OWASP Dependency-Check 作为报告型门禁。
- 中期接入：对 high / critical 漏洞升级为阻断型门禁。
- 上线前接入：加入许可证策略、例外审批和制品安全报告。

SCA 不应只扫生产依赖。Playwright、Vite、test runner、GitHub Actions 和 build tooling 的漏洞也可能影响供应链安全。

## 5. 第五层：运行时质量与发布治理

第五层适合 SimWar 准备上线、多人协作或进入真实用户环境后接入。它关注的是上线后的错误发现、链路追踪、发布审批和回滚能力。

### 5.1 Sentry：前后端错误监控

Sentry 可用于发现：

- 学生端提交失败。
- 教师端发布失败。
- 管理端权限异常。
- API 500。
- 前端白屏。
- settlement 接口异常。
- replay 相关异常。

适合接入环境：

- staging。
- production。
- 内测课程环境。

建议事件标签：

- `tenant_id`。
- `course_id`。
- `run_id`。
- `round_no`。
- `team_id`。
- `actor_role`。
- `route_group`。
- `engine_id`。
- `replay_hash`。

敏感字段必须脱敏，尤其是学生信息、企业数据、未发布结果、AI prompt 和内部 truth state。

### 5.2 OpenTelemetry：全链路可观测性

OpenTelemetry 适合追踪：

```text
request -> decision -> merge -> confirmation -> settlement -> replay
```

它能帮助排查：

- 为什么某个 Run 结果不一致。
- settlement 为什么不可复现。
- replay truth hash 为什么变化。
- plugin hook 是否影响了不该影响的链路。
- AI advisory 是否越界影响 truth chain。

建议 span 设计：

- `api.request`。
- `decision.role_section.save`。
- `decision.merge_commit.create`。
- `decision.team_confirmation.create`。
- `decision.canonical_submit`。
- `settlement.input_manifest.build`。
- `settlement.engine.run`。
- `settlement.result.persist`。
- `replay.official.run`。
- `replay.shadow.run`。
- `plugin.hook.execute`。
- `ai.advisory.generate`。

OpenTelemetry 适合上线前或多人协作时接入。早期可以先通过 audit ledger 和 replay manifest 保证审计，再逐步补全 tracing。

### 5.3 Harness：中后期发布治理平台

Harness 适合在以下场景接入：

- 多人共同开发。
- 需要 staging / production 环境。
- 需要自动部署。
- 需要人工审批流。
- 需要发布回滚。
- 需要质量门禁报告。
- 需要安全扫描和制品管理。

Harness 不替代 Codex，而是和 Codex 分工：

- Codex 负责“做”。
- Harness 负责“验”。
- Understand Anything 负责“懂”。

建议 Harness pipeline：

```text
build artifact
  -> quality gate
  -> contract / migration / replay gate
  -> security scan
  -> deploy staging
  -> smoke / E2E
  -> manual approval
  -> deploy production
  -> health check
  -> rollback guard
```

上线前必须把 SettlementResult、Replay truth hash、ParameterSet approval、PluginPackage approval 和 AI advisory-only 边界纳入发布门禁报告。

## 6. 推荐接入优先级

### 6.1 现在立刻做

| 工具                   | 用途                                 | 接入时机 | 适合保护的 SimWar 风险点                                                         | 需要配置的文件                           | 建议 CI 门禁                                                                       | 是否阻断合并                    | 优先级 |
| ---------------------- | ------------------------------------ | -------- | -------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------- | ------ |
| GitHub Actions CI 门禁 | PR 自动质量检查                      | 当前建议 | canonical Decision、SettlementResult、Replay hash、schema drift、migration drift | `.github/workflows/ci.yml`               | install、typecheck、quality、test、contract、schema、migration、replay、settlement | 是                              | P0     |
| Vitest 单元测试        | 纯函数、服务、adapter、contract 测试 | 当前建议 | role decision、merge、confirmation、settlement idempotency、plugin hook          | `vitest.config.ts`、`tests/**/*`         | `pnpm test`、`pnpm run test:coverage`                                              | 是                              | P0     |
| Playwright 基础 E2E    | 三端主流程浏览器测试                 | 当前建议 | 学员提交、教师查看、发布结果、权限只读态                                         | `playwright.config.ts`、`tests/e2e-ui/*` | `pnpm run test:e2e:ui`                                                             | 先 smoke 阻断，完整套件可报告型 | P0     |
| OpenAPI + Spectral     | API 规范校验                         | 当前建议 | 字段命名、enum、response envelope、truth fields 暴露                             | `contracts/openapi/*`、`.spectral.yaml`  | `pnpm run lint:openapi`                                                            | 先报告型，稳定后阻断            | P0     |
| Codecov                | 覆盖率趋势与 PR 覆盖提醒             | 当前建议 | 关键链路测试退化                                                                 | `codecov.yml`、coverage artifact         | `pnpm run test:coverage`                                                           | 先提醒，关键链路可阻断          | P1     |

### 6.2 Phase 1 到 Phase 3 做

| 工具                           | 用途                 | 接入时机 | 适合保护的 SimWar 风险点                               | 需要配置的文件                              | 建议 CI 门禁                          | 是否阻断合并                | 优先级 |
| ------------------------------ | -------------------- | -------- | ------------------------------------------------------ | ------------------------------------------- | ------------------------------------- | --------------------------- | ------ |
| Pact contract testing          | 前后端消费者契约测试 | 近期接入 | student / teacher / admin 依赖的 API 响应漂移          | `tests/pact/*`、Pact broker 配置            | consumer tests、provider verification | 稳定后阻断                  | P1     |
| Renovate / Dependabot          | 自动依赖更新         | 近期接入 | security patch、GitHub Actions、testing libraries 漏洞 | `.github/dependabot.yml` 或 `renovate.json` | 依赖 PR 全量质量门禁                  | 是                          | P1     |
| SonarQube                      | 代码质量和安全扫描   | 近期接入 | route 复杂度、重复逻辑、隐性漏洞、truth write 风险     | `sonar-project.properties`                  | sonar scan                            | 先报告型，后续阻断 critical | P1     |
| OWASP Dependency-Check 或 Snyk | 供应链安全           | 近期接入 | transitive dependency、许可证、高危漏洞                | Snyk 配置或 dependency-check 配置           | SCA scan                              | high / critical 稳定后阻断  | P1     |

### 6.3 前端稳定后做

| 工具          | 用途               | 接入时机 | 适合保护的 SimWar 风险点                     | 需要配置的文件                            | 建议 CI 门禁           | 是否阻断合并       | 优先级 |
| ------------- | ------------------ | -------- | -------------------------------------------- | ----------------------------------------- | ---------------------- | ------------------ | ------ |
| Storybook     | 三端 UI 组件工作台 | 中期接入 | 角色工作区、确认组件、结果展示组件状态复杂   | `.storybook/*`、组件 stories              | build storybook        | 可先不阻断         | P2     |
| Chromatic     | 视觉回归测试       | 中期接入 | UI 意外变化、复杂表格和状态组件回归          | Chromatic project token、storybook config | chromatic visual check | 关键组件稳定后阻断 | P2     |
| Lighthouse CI | 性能和可访问性     | 中期接入 | student 首屏、teacher 大表格、移动端可访问性 | `lighthouserc.*`                          | lighthouse budgets     | 先报告型           | P2     |

### 6.4 准备上线或多人协作时做

| 工具          | 用途           | 接入时机   | 适合保护的 SimWar 风险点                                    | 需要配置的文件                             | 建议 CI 门禁           | 是否阻断合并             | 优先级 |
| ------------- | -------------- | ---------- | ----------------------------------------------------------- | ------------------------------------------ | ---------------------- | ------------------------ | ------ |
| Sentry        | 前后端错误监控 | 上线前接入 | 提交失败、发布失败、API 500、settlement / replay 异常       | Sentry SDK 配置、环境变量                  | release health check   | 不阻断合并，阻断发布可选 | P2     |
| OpenTelemetry | 全链路可观测性 | 上线前接入 | decision -> settlement -> replay 不一致、plugin hook 影响面 | otel SDK / collector config                | trace smoke            | 不阻断合并，阻断发布可选 | P2     |
| Harness       | 发布治理平台   | 上线前接入 | staging / production 发布、审批、回滚、质量报告             | Harness pipeline、environment、secret refs | quality + deploy gates | 阻断发布                 | P3     |

## 7. SimWar 最关键的质量闭环

SimWar 最终质量闭环应由以下角色分工组成：

- Understand Anything：理解项目结构和影响范围。
- Codex：小步生成方案、文档、代码和测试。
- GitHub Actions / Harness：自动质量门禁。
- Vitest / Playwright / Pact：测试正确性。
- OpenAPI / Spectral / JSON Schema：冻结契约。
- Codecov / SonarQube / Snyk：覆盖率、质量、安全。
- Sentry / OpenTelemetry：上线后的运行质量。

这条闭环必须保护以下边界：

- canonical Decision 不能被 role draft 污染。
- SettlementResult 必须可审计、可复现。
- Replay truth hash 不能包含 AI advisory / learning evidence。
- Plugin 不能直接写 `state_true` / score / rank / SettlementResult。
- shared-contracts、OpenAPI、JSON Schema、fixtures 必须一致。

推荐工作流：

```text
Understand Anything 定位影响面
  -> Codex 小步修改
  -> Vitest / contract / schema / migration 本地验证
  -> GitHub Actions PR 门禁
  -> Playwright 主流程验证
  -> Codecov / SonarQube / SCA 风险反馈
  -> Harness 发布治理
  -> Sentry / OpenTelemetry 运行反馈
  -> 回到 Understand Anything 更新图谱和架构文档
```

## 8. 输出与治理要求

本文是路线图文档，不修改业务代码、不新增 migration、不修改 schema、不修改 CI 配置文件、不新增 package 依赖、不新增测试文件。

后续维护规则：

- 当前建议：先补 GitHub Actions、Vitest、基础 Playwright、OpenAPI/Spectral、Codecov 的质量闭环。
- 近期接入：补 Pact、Dependabot/Renovate、SonarQube、Snyk 或 OWASP Dependency-Check。
- 中期接入：补 Storybook、Chromatic、Lighthouse CI。
- 上线前接入：补 Sentry、OpenTelemetry、Harness。
- 每次引入新工具前，应先用 Understand Anything 检查影响范围，再更新本路线图。
- 每个工具成为阻断门禁前，应先经历报告型运行期，降低误报和流程噪音。
- 所有门禁都应围绕 SimWar 的真值链、契约链、Replay 链和插件边界设计，而不是只追求工具数量。
