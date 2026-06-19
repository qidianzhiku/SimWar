# SimWar GitHub Actions 质量门禁改造计划

更新时间：2026-05-27

适用范围：SimWar GitHub Actions、Dependabot、CodeQL、Playwright、Knip、package scripts、数据库迁移门禁、Replay / settlement / plugin boundary 质量门禁，以及后续 Harness release gates。

本文基于当前 CI 只读审查结果、`AGENTS.md`、`package.json`、`.github/workflows/ci.yml`、`.github/workflows/codeql.yml`、`knip.json`、`playwright.config.ts` 和相关质量文档整理。本文只定义改造计划，不代表新增 package scripts、依赖或业务代码。

## 1. 当前 CI 总体结论

当前远端 CI 已经有可用的 npm-based 基础门禁，但覆盖范围比早期计划文档更窄。当前 `.github/workflows/ci.yml` 实际执行：

```text
npm ci
npm run check:hidden-unicode
npm run lint
npm run typecheck
npm test
npm run test:postgres-replay
npm run test:contract
npm run build
```

当前本地 `package.json` 还提供 `npm run format:check` 和 `npm run security:audit`，但这两个命令没有进入当前 CI workflow。

Knip 和 Playwright 已有配置文件，但尚未形成可运行门禁：`knip` 和 `@playwright/test` 依赖不存在，相关 package scripts 不存在，CI job 不存在，Playwright E2E 测试目录也尚未在当前主线形成正式 gate。

短期重点不是扩大 CI，而是先把“当前已执行”“本地存在但未进入 CI”“配置存在但未启用”“计划中”四类状态写清楚，避免把 Issue #116 的后续计划误读为已经落地。

## 2. 当前能力状态分类

### 2.1 Implemented and enforced in CI

| 门禁                           | 当前文件位置                   | 当前作用                                                                   | 环境变量或 service                           | PR / push 状态 |
| ------------------------------ | ------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------- | -------------- |
| `npm ci`                       | `.github/workflows/ci.yml`     | 使用 lockfile 安装依赖                                                     | 无                                           | CI 执行        |
| `npm run check:hidden-unicode` | `.github/workflows/ci.yml`     | 扫描 tracked source/config/document files 中的 bidi、零宽字符和 BOM        | 无                                           | CI 执行        |
| `npm run lint`                 | `.github/workflows/ci.yml`     | ESLint 全仓静态检查                                                        | 无                                           | CI 执行        |
| `npm run typecheck`            | `.github/workflows/ci.yml`     | TypeScript project references 检查                                         | 无                                           | CI 执行        |
| `npm test`                     | `.github/workflows/ci.yml`     | Vitest unit / integration / characterization 测试                          | 无                                           | CI 执行        |
| `npm run test:postgres-replay` | `.github/workflows/ci.yml`     | Disposable PostgreSQL 16 replay / migration / adapter verification harness | Postgres service、`SIMWAR_TEST_DATABASE_URL` | CI 执行        |
| `npm run test:contract`        | `.github/workflows/ci.yml`     | contract baseline、OpenAPI 路径、schema、fixtures、shared types 存在性检查 | 无                                           | CI 执行        |
| `npm run build`                | `.github/workflows/ci.yml`     | 构建 shared-contracts、API、admin、teacher、student                        | 无                                           | CI 执行        |
| CodeQL pull request scan       | `.github/workflows/codeql.yml` | JS/TS CodeQL security-extended 与 security-and-quality scan                | GitHub CodeQL                                | PR 执行        |

### 2.2 Implemented locally but not enforced in CI

| 命令                     | 当前文件位置   | 当前作用                           | CI 状态 | 备注                                         |
| ------------------------ | -------------- | ---------------------------------- | ------- | -------------------------------------------- |
| `npm run format:check`   | `package.json` | Prettier 格式检查                  | 未执行  | 可作为 Issue #116 后续 CI gate 候选          |
| `npm run security:audit` | `package.json` | `npm audit --audit-level=critical` | 未执行  | 当前阈值为 critical；不能写成 high 级别 gate |

### 2.3 Configuration present but not operational

| 能力                                | 当前文件位置                                               | 缺口                                                                                                      | 当前状态              |
| ----------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------- |
| Knip unused/dependency check        | `knip.json`、Dependabot quality-tooling pattern            | `knip` 依赖不存在；`check:unused` script 不存在；CI 未执行                                                | 配置存在但未形成 gate |
| Playwright UI E2E                   | `playwright.config.ts`、Dependabot quality-tooling pattern | `@playwright/test` 依赖不存在；`test:e2e:ui` script 不存在；`tests/e2e-ui` 未形成当前主线 gate；CI 未执行 | 配置存在但未形成 gate |
| Dependabot quality-tooling grouping | `.github/dependabot.yml`                                   | 能分组未来工具更新，但不会自行创建门禁                                                                    | 配置存在              |

### 2.4 Planned / not yet implemented

| 缺失项                           | 当前状态                                            | 保护的 SimWar 风险                        | 后续归属 |
| -------------------------------- | --------------------------------------------------- | ----------------------------------------- | -------- |
| `npm run quality`                | script 不存在                                       | 本地聚合门禁入口不统一                    | #116     |
| `npm run lint:boundaries`        | script 不存在                                       | route / agent / plugin / truth-chain 越界 | #116     |
| `npm run check:unused`           | script 不存在                                       | unused files / dependencies / binaries    | #116     |
| `npm run test:coverage`          | script 不存在                                       | coverage 输出和阈值                       | #116     |
| dedicated schema check           | `check:schemas` / `test:schema-drift` script 不存在 | JSON Schema / OpenAPI 深度验证不足        | #116     |
| dedicated migration static check | `check:migrations` / `test:migration` script 不存在 | migration 静态结构和历史保护              | #116     |
| `npm run test:migration:apply`   | script 不存在                                       | migration apply / idempotency 专项证明    | #116     |
| `npm run test:postgres-adapter`  | script 不存在                                       | Postgres adapter integration 专项证明     | #116     |
| E2E gate                         | script、dependency、tests、CI job 均未完成          | teacher / student / admin 真实 UI 流程    | #116     |
| branch protection / ruleset      | 当前文档不应声称已启用                              | required check enforcement                | #116     |

## 3. 当前缺失的门禁

当前缺失项不应写成已经被 CI 覆盖。它们的后续实现需要独立小 PR，且每个 PR 先补真实 package script、依赖、测试或 workflow，再更新本文件：

- boundary lint；
- Knip unused / dependency gate；
- coverage gate；
- dedicated schema check；
- dedicated migration static check；
- dedicated migration apply；
- dedicated Postgres adapter integration gate；
- Playwright E2E gate；
- branch protection / ruleset documentation。

这些缺口不代表当前 CI 无效，而是说明当前 CI 仍是基础门禁，不是完整的 Phase 2 / Phase 3 truth-chain release gate。

## 4. 必须先有 package script 才能接入的门禁

| 命令                            | 推荐脚本语义                                     | 可先做别名                                | 需要新增测试文件 | 需要新增依赖               | 适合层级                           |
| ------------------------------- | ------------------------------------------------ | ----------------------------------------- | ---------------- | -------------------------- | ---------------------------------- |
| `npm run quality`               | 聚合当前可运行检查，再逐步纳入新增 gate          | 否                                        | 否               | 否                         | 本地 / CI                          |
| `npm run lint:boundaries`       | route / agent / plugin / store 访问边界检查      | 否                                        | 可能需要 fixture | 否                         | PR                                 |
| `npm run check:unused`          | Knip unused files / dependencies / binaries 检查 | 否                                        | 否               | 是，`knip`                 | PR / nightly                       |
| `npm run test:coverage`         | Vitest coverage 和阈值                           | 否                                        | 否               | 可能需要 coverage provider | PR / nightly                       |
| `npm run schema:check`          | 标准 schema / fixture validation 入口            | 可先映射到现有 contract baseline 后再强化 | 否               | 否或 OpenAPI tooling       | PR                                 |
| `npm run test:migration:apply`  | 真实 Postgres migration apply / idempotency      | 否                                        | 是               | 否                         | DB PR / release                    |
| `npm run test:postgres-adapter` | Postgres repository adapter integration test     | 否                                        | 是               | 否                         | DB PR / release                    |
| `npm run test:e2e:ui`           | Playwright UI E2E                                | 否                                        | 是               | 是，`@playwright/test`     | nightly / release，稳定后 PR smoke |

## 5. PR / nightly / release 分层策略

### 5.1 当前 PR / push CI 已执行

```text
npm ci
npm run check:hidden-unicode
npm run lint
npm run typecheck
npm test
npm run test:postgres-replay
npm run test:contract
npm run build
```

### 5.2 当前本地可运行但未进入 CI

```text
npm run format:check
npm run security:audit
```

是否把它们加入 CI 应作为 Issue #116 的独立 PR 决策；本计划不得再声称它们已经被 CI 阻断。

### 5.3 配置存在但未启用为 gate

```text
knip.json
playwright.config.ts
```

这些文件支撑后续治理，但在依赖、script、测试目录和 workflow job 落地前，不能作为通过/失败门禁引用。

### 5.4 Nightly / release 候选

建议后续 nightly 或 release gate 逐步纳入：

- Playwright E2E；
- migration apply / idempotency；
- security audit 或更强 SCA；
- future replay golden matrix；
- future settlement idempotency；
- future plugin boundary；
- future adapter contract。

## 6. 当前 CI 中“看似覆盖但不完整”的风险

当前 CI 已经覆盖基础门禁，但仍有以下不完整点：

- `test:contract` 是 baseline / presence check，不能等同于完整 JSON Schema validation。
- 当前没有 Spectral OpenAPI lint。
- 当前没有 dedicated schema drift script。
- 当前没有 dedicated migration static script；真实 DB 验证集中在 `test:postgres-replay`。
- Replay / settlement / plugin boundary 当前没有独立命令。
- `quality` 聚合脚本不存在。
- `format:check` 和 `security:audit` 可本地运行，但没有进入 CI。
- Knip 和 Playwright 只有配置，尚未形成可执行 gate。
- Playwright 当前配置只声明 API、teacher、student webServer；不能声称 admin E2E 已覆盖。
- branch protection / ruleset 不应在未验证前写成已启用。

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

## 8. 已入库配置的后续治理建议

| 文件                           | 当前价值                                         | 当前门禁状态                                        | 后续治理                                                 |
| ------------------------------ | ------------------------------------------------ | --------------------------------------------------- | -------------------------------------------------------- |
| `.github/dependabot.yml`       | npm 和 GitHub Actions 依赖更新治理               | 已入库；不直接阻断                                  | 保持依赖 PR 受 CI 阻断                                   |
| `.github/workflows/codeql.yml` | JS/TS CodeQL 安全和质量扫描                      | PR 和 schedule 可运行；push 应指向默认分支 `master` | 继续由 #116 跟踪 required-check / ruleset 文档           |
| `playwright.config.ts`         | E2E 项目、webServer、trace、report artifact 配置 | 已入库但不可运行 gate                               | 后续补 `@playwright/test`、E2E script、测试目录和 CI job |
| `knip.json`                    | unused/dependency check 配置                     | 已入库但不可运行 gate                               | 后续补 `knip` 依赖、`check:unused` script 和 CI job      |

治理原则：

- 质量配置文件不要混在业务功能 PR 里。
- Dependabot、CodeQL、Playwright、Knip 这类工具配置应能单独 review。
- 配置文件存在不等于门禁已启用。
- 涉及数据库 apply 的脚本必须保留本地/CI disposable DB 防护。
- 架构边界脚本必须与 AGENTS truth protection 保持一致。

## 9. 推荐实施顺序

最小改造路径：

1. 对齐 CodeQL push 分支到默认分支 `master`。
2. 明确当前 CI 和 package scripts 的真实状态，避免计划能力被误读为已落地。
3. 独立评估是否把 `format:check` 和 `security:audit` 加入 CI。
4. 独立补 Knip 依赖、`check:unused` script 和 CI job。
5. 独立补 Playwright 依赖、E2E script、测试目录和 CI job。
6. 再补 boundary lint、coverage、schema、migration、adapter 专项门禁。
7. Phase 2+ 再补 replay / settlement / plugin boundary 专项命令。
8. 最后考虑 branch protection / ruleset 和 Harness release gates。

推荐 PR 拆分：

- PR A：CodeQL default branch 和质量文档状态对齐。
- PR B：format/security audit 是否进入 CI。
- PR C：Knip gate。
- PR D：Playwright E2E gate。
- PR E：boundary lint / coverage / schema / migration / adapter 专项门禁。
- PR F：Replay / settlement / plugin boundary 专项门禁。
- PR G：branch protection / ruleset 和 Harness release gates 文档。

这个顺序能让每一步都可 review、可回滚，也能避免“工具越加越多，但每个门禁到底保护什么没人说得清”的问题。

## 10. 结论

SimWar 当前 CI 已经有可用的 npm-based 基础质量门禁，短期重点不是重做 CI，而是：

- 保持当前已执行门禁稳定；
- 修正文档和实际 workflow / scripts 的漂移；
- 让 CI 分层，区分 PR 必跑、按路径触发、nightly full 和 release 前 full gate；
- 把综合测试中的隐含能力拆成显式专项命令；
- 避免 PR 反馈过慢；
- 逐步保护 canonical Decision、SettlementResult、Replay truth hash 和 plugin boundary。

下一步最值得做的是围绕 Issue #116 逐个补齐缺失门禁。每个门禁应先证明 package script、依赖、测试数据和 CI job 均真实存在，再把它写成已实施能力。
