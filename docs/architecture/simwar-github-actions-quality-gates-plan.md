# SimWar GitHub Actions 质量门禁改造计划

更新时间：2026-05-27

适用范围：SimWar GitHub Actions、Dependabot、CodeQL、Playwright、Knip、package scripts、数据库迁移门禁、Replay / settlement / plugin boundary 质量门禁，以及后续 Harness release gates。

本文基于当前 CI 只读审查结果、`AGENTS.md`、`docs/architecture/simwar-package-scripts-standard.md`、`docs/architecture/simwar-development-quality-toolchain-roadmap.md` 和 `docs/architecture/student-role-based-decision-test-strategy.md` 整理。本文只定义改造计划，不代表修改了 CI、package scripts、依赖或业务代码。

## 1. 当前 CI 总体结论

当前本地版 CI 方向是对的，已经能支撑 SimWar 的基础质量门禁。它以 npm 为命令入口，覆盖安装、格式、lint、架构边界、unused/dependency、security audit、typecheck、coverage、contract/schema、migration、Postgres adapter、build 和 Playwright UI E2E。

但当前 CI 还不能说完整覆盖 Phase 2 / Phase 3 的 truth chain。最大缺口是专项命令还没有拆出来：Replay、settlement idempotency、plugin boundary、adapter contract 目前仍主要隐藏在综合测试或边界 lint 里，缺少可单独调用、可单独阻断的门禁。

当前 OpenAPI / schema 校验偏存在性检查：它能确认关键文件、OpenAPI 路径、schema JSON、fixtures、shared-contracts 类型和 domain events 存在并保持基本同步，但不能等同于完整 JSON Schema validation，也不能等同于 Spectral OpenAPI lint。

当前 `.github/dependabot.yml`、`.github/workflows/codeql.yml`、`playwright.config.ts`、`knip.json` 仍是本地未跟踪文件。只有提交后，它们才会进入仓库治理并真正成为团队和远端 CI 的共同能力。

短期重点不是重做 CI，而是把本地已有质量配置纳入仓库、让 CI 分层、把隐含在综合测试中的能力拆成显式专项命令，并避免所有重型门禁都压到每个 PR 上。

## 2. 当前 CI 已覆盖的门禁

| 门禁                            | 当前文件位置                   | 当前作用                                                             | 对应质量门禁                              | 阻断型                                | 环境变量或 service                         | PR 必跑                      | 建议拆到 nightly / release      |
| ------------------------------- | ------------------------------ | -------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------- | ------------------------------------------ | ---------------------------- | ------------------------------- |
| `npm ci`                        | `.github/workflows/ci.yml`     | 使用 lockfile 安装依赖                                               | install、quality                          | 是                                    | 无                                         | 是                           | 否                              |
| `npm run format:check`          | `.github/workflows/ci.yml`     | Prettier 格式检查                                                    | lint、quality                             | 是                                    | 无                                         | 是                           | 否                              |
| `npm run lint`                  | `.github/workflows/ci.yml`     | ESLint 全仓静态检查                                                  | lint、quality                             | 是                                    | 无                                         | 是                           | 否                              |
| `npm run lint:boundaries`       | `.github/workflows/ci.yml`     | 架构边界检查，防止 route / agent / plugin 越界                       | lint、settlement、plugin boundary、replay | 是                                    | 无                                         | 是                           | 否                              |
| `npm run check:unused`          | `.github/workflows/ci.yml`     | Knip unused files / dependencies / binaries 检查                     | lint、quality                             | 是                                    | 依赖 `knip.json`                           | 是                           | 否                              |
| `npm run security:audit`        | `.github/workflows/ci.yml`     | npm high 级别漏洞检查                                                | security、quality                         | 是                                    | npm registry 可用性                        | 可先 PR 必跑，也可路径触发   | security 深扫可 nightly         |
| `npm run typecheck`             | `.github/workflows/ci.yml`     | TypeScript project references 检查                                   | typecheck、quality                        | 是                                    | 无                                         | 是                           | 否                              |
| `npm run test:coverage`         | `.github/workflows/ci.yml`     | Vitest coverage 和阈值检查                                           | unit、quality                             | 是                                    | 依赖 `vitest.config.ts`                    | 是                           | 否                              |
| `npm run test:contract`         | `.github/workflows/ci.yml`     | contract baseline、OpenAPI 路径、schema、fixtures、shared types 检查 | contract、schema、OpenAPI                 | 是                                    | 无                                         | 是                           | 未来可拆更细                    |
| `npm run test:schema-drift`     | `.github/workflows/ci.yml`     | 当前与 contract check 共用脚本                                       | schema、contract                          | 是                                    | 无                                         | 是                           | 未来可替换为更严格 schema check |
| `npm run test:migration`        | `.github/workflows/ci.yml`     | migration 静态结构、RLS、索引和关键 SQL 检查                         | migration                                 | 是                                    | 无                                         | 是                           | 否                              |
| `npm run test:migration:apply`  | `.github/workflows/ci.yml`     | 对真实 Postgres 测试库 apply migration 两次                          | migration、idempotency                    | 是                                    | Postgres service、`DATABASE_URL`           | 可按路径触发                 | 是                              |
| `npm run test:postgres-adapter` | `.github/workflows/ci.yml`     | Postgres repository adapter integration test                         | migration、contract                       | 是                                    | Postgres service、`DATABASE_URL`           | 可按路径触发                 | 是                              |
| `npm run build`                 | `.github/workflows/ci.yml`     | 构建 shared-contracts、simulation-core、API、三端 apps               | build、typecheck、quality                 | 是                                    | 无                                         | 是                           | 否                              |
| Playwright install              | `.github/workflows/ci.yml`     | 安装 chromium 浏览器依赖                                             | E2E                                       | 是                                    | 依赖 runner 环境                           | PR smoke 时需要              | full E2E 可 nightly             |
| `npm run test:e2e:ui`           | `.github/workflows/ci.yml`     | teacher / student UI E2E                                             | E2E                                       | 是                                    | Playwright webServer、测试端口、测试 store | 建议 smoke PR 必跑或路径触发 | full suite nightly / release    |
| coverage artifact               | `.github/workflows/ci.yml`     | 上传 `coverage/vitest`                                               | coverage、quality                         | 不阻断，辅助诊断                      | `actions/upload-artifact`                  | 是                           | 否                              |
| `playwright-report` artifact    | `.github/workflows/ci.yml`     | 上传 Playwright HTML report                                          | E2E diagnosis                             | 不阻断，辅助诊断                      | `actions/upload-artifact`                  | E2E 运行时上传               | 否                              |
| `test-results` artifact         | `.github/workflows/ci.yml`     | 上传 trace、junit、失败上下文                                        | E2E diagnosis                             | 不阻断，辅助诊断                      | `actions/upload-artifact`                  | E2E 运行时上传               | 否                              |
| Postgres service                | `.github/workflows/ci.yml`     | 为 migration apply 和 adapter test 提供 disposable DB                | migration、adapter contract               | 支撑阻断命令                          | postgres container                         | 可按路径触发                 | release 必跑                    |
| `DATABASE_URL`                  | `.github/workflows/ci.yml`     | 指向 CI Postgres service                                             | migration、adapter contract               | 支撑阻断命令                          | Postgres service                           | 可按路径触发                 | release 必跑                    |
| CodeQL 草案                     | `.github/workflows/codeql.yml` | JS/TS security-extended 与 quality scan                              | security、code quality                    | GitHub code scanning 结果可阻断或报告 | GitHub code scanning 权限                  | 可 PR 跑                     | weekly + release 前建议跑       |
| Dependabot 草案                 | `.github/dependabot.yml`       | npm 与 GitHub Actions weekly update                                  | dependency governance                     | 不直接阻断，依赖 PR 受 CI 阻断        | GitHub Dependabot                          | 不适用                       | weekly                          |

## 3. 当前缺失的门禁

| 缺失项                        | 当前是否存在 | 为什么缺失                             | 保护的 SimWar 风险                                     | 需要先补 package script | 现在接入 | Phase 2+ 接入 | 阻断型建议                 |
| ----------------------------- | ------------ | -------------------------------------- | ------------------------------------------------------ | ----------------------- | -------- | ------------- | -------------------------- |
| `openapi:lint` / Spectral     | 不存在       | 未见 Spectral 配置和脚本               | API 字段命名、enum、response schema、truth fields 暴露 | 是                      | 可报告型 | 是            | 规则稳定后阻断             |
| `schema:check` 标准别名       | 不存在       | 当前只有 `test:schema-drift`           | schema / fixtures / shared-contracts 命令入口不统一    | 是                      | 是       | 否            | 是，可先别名               |
| `test:unit`                   | 不存在       | Vitest 只有全量入口                    | unit 反馈不够快，难以定位 pure function 失败           | 是                      | 是       | 否            | 是                         |
| `test:integration`            | 不存在       | integration 未独立入口                 | route / service / repository 组合链路难以单独验证      | 是                      | 是       | 否            | 是                         |
| `test:e2e` 标准别名           | 不存在       | 当前只有 `test:e2e:ui`                 | E2E 命令入口不统一                                     | 是                      | 是       | 否            | smoke 阻断                 |
| `test:replay`                 | 不存在       | Replay 专项测试尚未拆分                | Replay truth hash、official result 只读                | 是                      | 可先规划 | 是            | 是                         |
| `test:replay:golden`          | 不存在       | golden matrix 尚未拆分                 | 相同输入稳定输出、参数差异可解释                       | 是                      | 否       | 是            | 是                         |
| `test:settlement-idempotency` | 不存在       | settlement 幂等仍在综合测试内          | 重复 SettlementResult、重复 StateSnapshot、副作用重复  | 是                      | 可先规划 | 是            | 是                         |
| `test:plugin-boundary`        | 不存在       | plugin boundary 主要靠 lint / 综合测试 | plugin 直写真值、绕过 hook、热替换风险                 | 是                      | 可先规划 | 是            | 是                         |
| `test:adapter-contract`       | 不存在       | adapter contract 没有统一脚本名        | JSON / Postgres adapter 行为漂移                       | 是                      | 可先规划 | 是            | 是                         |
| `test:pact`                   | 不存在       | Pact 工具链未配置                      | student / teacher / admin consumer contract 漂移       | 是                      | 否       | 是            | 稳定后阻断                 |
| Storybook                     | 不存在       | UI 组件工作台未配置                    | 三端复杂状态组件退化                                   | 是                      | 否       | 前端稳定后    | 先不阻断                   |
| Chromatic                     | 不存在       | Storybook 未稳定，未配置项目 token     | 视觉回归                                               | 是                      | 否       | 前端稳定后    | 关键组件稳定后阻断         |
| Lighthouse                    | 不存在       | 性能预算和配置未建立                   | student 首屏、teacher 大表格、可访问性                 | 是                      | 否       | 前端稳定后    | 先报告型                   |
| SonarQube                     | 不存在       | Sonar 配置和项目未建立                 | 复杂度、重复、安全味道                                 | 是                      | 否       | 是            | 先报告型                   |
| Snyk / OWASP Dependency-Check | 不存在       | SCA 工具未配置                         | transitive dependency、许可证、高危漏洞                | 是                      | 可先规划 | 是            | high / critical 稳定后阻断 |
| Harness release gates         | 不存在       | 当前尚未进入发布治理平台               | staging/prod 审批、回滚、环境治理                      | 否，需 pipeline         | 否       | 上线前        | 阻断发布                   |

## 4. 必须先有 package script 才能接入的门禁

| 命令                                  | 推荐脚本语义                                         | 可先做别名                       | 需要新增测试文件           | 需要新增依赖               | 适合层级                     |
| ------------------------------------- | ---------------------------------------------------- | -------------------------------- | -------------------------- | -------------------------- | ---------------------------- |
| `npm run test:unit`                   | 只运行 `tests/unit/**/*.test.ts` 或 unit 命名集合    | 否                               | 不一定，取决于现有测试命名 | 否                         | PR                           |
| `npm run test:integration`            | 只运行 `tests/integration/**/*.test.ts`              | 否                               | 不一定                     | 否                         | PR / nightly                 |
| `npm run test:e2e`                    | 标准 E2E 入口，先映射到 `test:e2e:ui`                | 是                               | 否                         | 否                         | PR smoke / nightly full      |
| `npm run schema:check`                | 标准 schema drift / fixture validation 入口          | 是，先映射到 `test:schema-drift` | 否                         | 否                         | PR                           |
| `npm run openapi:lint`                | 运行 OpenAPI lint，建议后续用 Spectral               | 否                               | 否                         | 可能需要 OpenAPI lint 工具 | PR report / nightly          |
| `npm run test:replay`                 | 运行 Replay / Shadow Replay 专项测试                 | 否                               | 是                         | 通常否                     | nightly / release            |
| `npm run test:replay:golden`          | 运行 golden replay matrix                            | 否                               | 是                         | 通常否                     | nightly / release            |
| `npm run test:settlement-idempotency` | 运行 settlement 幂等专项测试                         | 否                               | 是                         | 通常否                     | nightly / release，稳定后 PR |
| `npm run test:plugin-boundary`        | 运行 plugin hook / truth write 防护测试              | 否                               | 是                         | 通常否                     | nightly / release，稳定后 PR |
| `npm run test:adapter-contract`       | 统一运行 JSON / Postgres repository adapter contract | 否                               | 可能需要补调用入口         | 否                         | PR / nightly                 |
| `npm run test:pact`                   | 运行 consumer/provider contract tests                | 否                               | 是                         | 需要 Pact 工具链           | Phase 2+ / release           |

优先级建议：

1. 先做别名类脚本：`schema:check`、`test:e2e`。
2. 再做不新增依赖的拆分脚本：`test:unit`、`test:integration`、`test:adapter-contract`。
3. 再做需要新工具或新测试矩阵的脚本：`openapi:lint`、Replay、settlement、plugin boundary、Pact。

## 5. PR / nightly / release 分层策略

### 5.1 PR 必跑

建议 PR 必跑：

```text
npm ci
npm run format:check
npm run lint
npm run lint:boundaries
npm run check:unused
npm run typecheck
npm run test:coverage
npm run test:contract
npm run test:schema-drift
npm run test:migration
npm run build
```

这些门禁适合 PR 必跑，因为它们反馈快、覆盖面广、对每次代码变更都有基础保护价值：

- format / lint 降低 review 噪音。
- boundary lint 保护 route、agent、plugin 和 truth chain 边界。
- typecheck 和 build 证明 workspace 基础可编译。
- coverage 和 Vitest 保护核心服务、shared contracts、simulation-core。
- contract / schema / migration static 保护契约优先和数据库结构基线。

`security:audit` 当前已在 CI 中执行。若 npm registry 抖动或依赖生态噪音影响 PR 速度，可以改为路径触发、scheduled 或 release 前阻断；若团队希望安全强阻断，也可继续保留在 PR 必跑。

### 5.2 PR 可选或按路径触发

建议按路径触发或作为 PR 可选：

```text
npm run test:migration:apply
npm run test:postgres-adapter
npm run test:e2e:ui
future openapi lint report mode
```

触发建议：

| 变化范围                            | 建议触发                                                           |
| ----------------------------------- | ------------------------------------------------------------------ |
| `db/migrations/**` 变化             | migration apply、Postgres adapter                                  |
| `services/api/**` 变化              | Postgres adapter、API integration、E2E smoke                       |
| `services/simulation-core/**` 变化  | coverage、future replay、future settlement、future plugin boundary |
| `apps/**` 变化                      | E2E smoke、build                                                   |
| `contracts/**` 变化                 | contract、schema、future OpenAPI lint、E2E smoke                   |
| `packages/shared-contracts/**` 变化 | typecheck、contract、schema、build                                 |
| `package-lock.json` 变化            | full quality、security audit、E2E smoke                            |
| `.github/**` 变化                   | workflow syntax review、full CI                                    |

PR 可选不代表不重要，而是避免每次小文档或小前端改动都触发最慢的 DB / E2E / security 全套。关键路径变化时仍应阻断。

### 5.3 Nightly Full

建议 nightly full：

```text
完整 E2E
DB apply / idempotency
security audit 深扫
future replay golden matrix
future settlement idempotency
future plugin boundary
future adapter contract
```

nightly 的目标是发现跨域和慢速问题，例如：

- Playwright 全流程在干净环境是否稳定。
- Postgres migration 和 adapter 是否持续等价。
- Replay golden 是否因参数、插件或 engine drift 变化。
- settlement 幂等是否被新功能破坏。
- plugin hook 是否仍无法写入 truth fields。

### 5.4 Release 前 Full Gate

release 前 full gate 建议包括：

```text
完整 quality
完整 E2E
migration apply
Postgres adapter
Replay / Shadow Replay
settlement idempotency
plugin boundary
CodeQL / SCA
发布后 smoke
```

release gate 应比 PR 更严格，因为它保护的是环境发布、课程运行、教学结果和真实用户流程。Harness 更适合承载这一层，包括审批、环境变量治理、回滚和发布后 smoke。

## 6. 当前 CI 中“看似覆盖但不完整”的风险

当前 CI 已经覆盖很多基础门禁，但仍有以下不完整点：

- `test:contract` 和 `test:schema-drift` 当前都调用同一个脚本。
- 这两个命令不能等同于完整 JSON Schema validation。
- 这两个命令不能等同于 Spectral OpenAPI lint。
- 当前 OpenAPI 检查偏路径和文本基线，不足以证明 operation、request、response、status enum、naming convention 全部合规。
- Replay / settlement / plugin boundary 当前被部分包含在综合测试或 boundary lint 里，但没有独立证明。
- `quality` 脚本和 CI 不完全等价：CI 中 DB apply gate 设置了 Postgres service 和 `DATABASE_URL`，本地 `npm run quality` 不一定具备同等数据库环境。
- CI 中 DB apply gate 比本地 quality 更强。
- 当前未跟踪 CI 配置文件如果不提交，远端 CI 不会具备 Dependabot、CodeQL、Playwright config、Knip config 等能力。
- `security:audit` 只代表 npm audit high 级别，不代表 Snyk、OWASP Dependency-Check、license policy 或 container scan。
- Playwright artifact 能帮助诊断 E2E 失败，但不代表 E2E 覆盖了 teacher / student / admin 的完整 Phase 2 / 3 产品流程。

这些风险不意味着当前 CI 无效，而是说明下一阶段要把隐含能力拆成独立命令和独立 job，让每条 truth-chain 风险都有明确证据。

## 7. npm / pnpm 边界

当前 CI 应坚持 npm。当前仓库存在 `package-lock.json`，不存在 pnpm workspace 配置和 pnpm lockfile，因此不能在 CI 中引入 pnpm。

所有 CI 示例应使用：

```text
npm ci
npm run <script>
npm test
```

如果文档中出现 pnpm，只能出现在“不能假设存在”或“未来可选迁移”语境中。任何 CI 改造计划、AGENTS 规则或 Harness pipeline 草案都不应把 pnpm 系列命令写成当前项目命令。

## 8. 未跟踪文件治理建议

| 文件                                         | 当前价值                                         | 建议提交 | 是否单独 PR                  | 是否需要先审查                        | 和 CI / quality gate 的关系               |
| -------------------------------------------- | ------------------------------------------------ | -------- | ---------------------------- | ------------------------------------- | ----------------------------------------- |
| `.github/dependabot.yml`                     | npm 和 GitHub Actions 依赖更新治理               | 建议提交 | 是                           | 是，检查分组、频率、PR 数量           | 生成依赖升级 PR，依赖现有 CI 阻断         |
| `.github/workflows/codeql.yml`               | JS/TS CodeQL 安全和质量扫描                      | 建议提交 | 是                           | 是，检查权限、分支、schedule、queries | 补安全扫描门禁，可先报告型                |
| `playwright.config.ts`                       | E2E 项目、webServer、trace、report artifact 配置 | 建议提交 | 可与 E2E job 同 PR，也可单独 | 是，确认端口、store、artifact         | 支撑 `test:e2e:ui` 和 Playwright artifact |
| `knip.json`                                  | unused/dependency check 配置                     | 建议提交 | 可与 `check:unused` 同 PR    | 是，确认 ignoreFiles 不掩盖关键问题   | 支撑 `npm run check:unused`               |
| `.prettierignore`                            | 控制 format check 范围                           | 建议提交 | 可与 format PR 同 PR         | 是，避免忽略源码或契约                | 稳定 `format:check`                       |
| `scripts/check-architecture-boundaries.mjs`  | route / agent / plugin / store 访问边界检查      | 建议提交 | 是                           | 是，确认 budget 和误报                | 支撑 `lint:boundaries`，保护 truth chain  |
| `scripts/check-migrations.mjs`               | migration 静态结构检查                           | 建议提交 | 是                           | 是，确认 migration 列表和 RLS 检查    | 支撑 `test:migration`                     |
| `scripts/check-postgres-migration-apply.mjs` | 真实 Postgres migration apply / idempotency      | 建议提交 | 是                           | 是，确认只允许 disposable DB          | 支撑 `test:migration:apply`               |

治理原则：

- 质量配置文件不要混在业务功能 PR 里。
- Dependabot、CodeQL、Playwright、Knip 这类工具配置应能单独 review。
- 涉及数据库 apply 的脚本必须保留本地/CI disposable DB 防护。
- 架构边界脚本必须与 AGENTS truth protection 保持一致。

## 9. 推荐实施顺序

最小改造路径：

1. 提交 `docs/architecture/simwar-package-scripts-standard.md`。
2. 生成并提交本 CI 质量门禁计划。
3. 单独审查并提交 `.github/dependabot.yml`。
4. 单独审查并提交 `.github/workflows/codeql.yml`。
5. 单独审查并提交 `playwright.config.ts` / `knip.json`。
6. 先补轻量脚本别名：
   - `schema:check` -> `test:schema-drift`
   - `test:e2e` -> `test:e2e:ui`
7. 再补 `openapi:lint`。
8. 再补 `test:unit` / `test:integration`。
9. Phase 2+ 再补 replay / settlement / plugin boundary 专项命令。
10. 最后考虑 Harness release gates。

推荐 PR 拆分：

- PR A：文档和计划，只包含 scripts standard 与 CI quality gates plan。
- PR B：Dependabot / CodeQL。
- PR C：Playwright / Knip / artifact 配置。
- PR D：轻量 package scripts 别名。
- PR E：OpenAPI lint。
- PR F：unit / integration 拆分。
- PR G：Replay / settlement / plugin boundary 专项门禁。
- PR H：Harness release gates。

这个顺序能让每一步都可 review、可回滚，也能避免“工具越加越多，但每个门禁到底保护什么没人说得清”的问题。

## 10. 结论

SimWar 当前 CI 已经有较好的 npm-based 基础质量门禁，短期重点不是重做 CI，而是：

- 把已有本地 CI 配置文件纳入仓库治理。
- 让 CI 分层，区分 PR 必跑、按路径触发、nightly full 和 release 前 full gate。
- 把综合测试中的隐含能力拆成显式专项命令。
- 避免 PR 反馈过慢。
- 逐步保护 canonical Decision、SettlementResult、Replay truth hash 和 plugin boundary。

下一步最值得做的是先提交本计划文档，然后把 Dependabot、CodeQL、Playwright、Knip、migration apply 和 boundary lint 这些本地配置拆成清晰的小 PR。等基础治理收口后，再进入 OpenAPI lint、unit/integration 拆分、Replay / settlement / plugin boundary 专项门禁。
