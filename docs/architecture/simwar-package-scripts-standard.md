# SimWar Package Scripts 标准化设计

更新时间：2026-05-27

适用范围：SimWar 根目录 `package.json`、npm workspaces 下的各 `package.json`、质量门禁脚本、GitHub Actions / Harness 命令入口，以及后续 AGENTS / CI 文档中的默认命令写法。

本文基于当前 package scripts 只读检查结果、`AGENTS.md`、`docs/architecture/simwar-development-quality-toolchain-roadmap.md` 和 `docs/architecture/student-role-based-decision-test-strategy.md` 整理。本文只定义脚本标准化方案，不代表新增了任何脚本、依赖或 CI 配置。

## 1. 当前包管理器结论

当前 SimWar 项目使用 npm workspaces。

| 检查项 | 当前结论 |
| --- | --- |
| 根包管理器 | npm |
| workspace 配置 | 根 `package.json` 的 `workspaces` 字段：`apps/*`、`services/*`、`packages/*` |
| `package-lock.json` | 存在 |
| `pnpm-workspace.yaml` | 不存在 |
| `pnpm-lock.yaml` | 不存在 |
| 当前默认安装命令 | `npm ci` 用于 CI，`npm install` 用于本地依赖安装 |
| 当前默认质量命令 | `npm run quality` |

因此，当前不能假设任何 pnpm 命令存在。后续 Codex、CI、Harness、AGENTS.md 和质量文档中的默认命令应优先使用 npm。

如果未来要迁移到 pnpm，应先引入 `pnpm-workspace.yaml`、锁文件、CI 安装策略、AGENTS 命令说明和 package scripts 映射，再逐步替换文档中的当前命令。

## 2. 当前已有 scripts 清单

### 2.1 根目录 scripts

| 命令 | 来源 | 当前用途 | 对应质量门禁 | 适合本地运行 | 适合 CI | 环境变量 | 阻断合并 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `npm run dev` | 根 `package.json` | 默认启动 API dev 入口 | E2E 支撑 | 是 | 否 | 无 | 否 |
| `npm run dev:api` | 根 `package.json` | 启动 API 开发服务 | E2E 支撑 | 是 | Playwright webServer 间接使用 | 可通过 API 相关环境变量覆盖 | 否 |
| `npm run dev:admin` | 根 `package.json` | 启动 admin 前端 | E2E 支撑 | 是 | 可作为 E2E 支撑 | `VITE_API_BASE_URL` 可选 | 否 |
| `npm run dev:teacher` | 根 `package.json` | 启动 teacher 前端 | E2E 支撑 | 是 | Playwright webServer 间接使用 | `VITE_API_BASE_URL` 可选 | 否 |
| `npm run dev:student` | 根 `package.json` | 启动 student 前端 | E2E 支撑 | 是 | Playwright webServer 间接使用 | `VITE_API_BASE_URL` 可选 | 否 |
| `npm run build` | 根 `package.json` | 构建 shared-contracts、simulation-core、API、三端 apps | typecheck、quality | 是 | 是 | 无 | 是 |
| `npm run quality` | 根 `package.json` | 聚合 format、lint、unused、安全、typecheck、coverage、contract、schema、migration、Postgres adapter、build、E2E | quality | 是 | 可作为本地等价门禁，也可拆成 CI jobs | `DATABASE_URL` 影响部分 DB 子命令 | 是 |
| `npm run format` | 根 `package.json` | Prettier 写入格式化 | lint 辅助 | 是 | 通常否 | 无 | 否 |
| `npm run format:check` | 根 `package.json` | Prettier 格式检查 | lint、quality | 是 | 是 | 无 | 是 |
| `npm run lint` | 根 `package.json` | ESLint 全仓检查 | lint、quality | 是 | 是 | 无 | 是 |
| `npm run lint:boundaries` | 根 `package.json` | 架构边界检查 | lint、settlement、plugin boundary、replay | 是 | 是 | 无 | 是 |
| `npm run check:unused` | 根 `package.json` | Knip unused files / dependencies / binaries 检查 | lint、quality | 是 | 是 | 无 | 建议阻断 |
| `npm run security:audit` | 根 `package.json` | `npm audit --audit-level=high` | quality、安全 | 是 | 是 | 无 | high 级别建议阻断 |
| `npm run typecheck` | 根 `package.json` | TypeScript project references 检查 | typecheck、quality | 是 | 是 | 无 | 是 |
| `npm test` | 根 `package.json` | Vitest 全量测试 | unit、integration、contract、replay、settlement、plugin boundary | 是 | 是 | 无 | 是 |
| `npm run test:coverage` | 根 `package.json` | Vitest coverage，输出 `coverage/vitest` | unit、quality | 是 | 是 | 无 | 是 |
| `npm run test:contract` | 根 `package.json` | 检查 OpenAPI 路径、JSON Schema、fixtures、shared-contracts、domain events | contract、schema、OpenAPI | 是 | 是 | 无 | 是 |
| `npm run test:schema-drift` | 根 `package.json` | 当前同样调用 contract/schema 检查脚本 | schema、contract | 是 | 是 | 无 | 是 |
| `npm run test:migration` | 根 `package.json` | 静态检查 migration 文件、表、索引、RLS、关键 SQL 片段 | migration | 是 | 是 | 无 | 是 |
| `npm run test:migration:apply` | 根 `package.json` | 在真实 Postgres 测试库 apply migration 两次并校验结构 | migration | 本地需准备测试库 | 是 | 需要 `DATABASE_URL` | 是 |
| `npm run test:postgres-adapter` | 根 `package.json` | 运行 Postgres repository adapter integration test | migration、contract | 本地需准备测试库 | 是 | 通常需要 `DATABASE_URL` | 是 |
| `npm run test:e2e:ui` | 根 `package.json` | Playwright 三端 UI E2E | E2E | 是 | 是 | Playwright webServer 内部设置测试端口和 `VITE_API_BASE_URL` | 是，至少 smoke 应阻断 |

### 2.2 apps 三端 scripts

| 命令 | 来源 | 当前用途 | 对应质量门禁 | 适合本地运行 | 适合 CI | 环境变量 | 阻断合并 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `npm run dev -w @simwar/admin` | `apps/admin/package.json` | 启动 admin Vite dev server | E2E 支撑 | 是 | 可由 E2E 间接使用 | `VITE_API_BASE_URL` 可选 | 否 |
| `npm run build -w @simwar/admin` | `apps/admin/package.json` | admin TypeScript + Vite build | typecheck、quality | 是 | 是 | 无 | 是 |
| `npm run preview -w @simwar/admin` | `apps/admin/package.json` | admin build preview | E2E / 手动验收辅助 | 是 | 可选 | 无 | 否 |
| `npm run dev -w @simwar/teacher` | `apps/teacher/package.json` | 启动 teacher Vite dev server | E2E 支撑 | 是 | Playwright webServer 使用 | `VITE_API_BASE_URL` 可选 | 否 |
| `npm run build -w @simwar/teacher` | `apps/teacher/package.json` | teacher TypeScript + Vite build | typecheck、quality | 是 | 是 | 无 | 是 |
| `npm run preview -w @simwar/teacher` | `apps/teacher/package.json` | teacher build preview | E2E / 手动验收辅助 | 是 | 可选 | 无 | 否 |
| `npm run dev -w @simwar/student` | `apps/student/package.json` | 启动 student Vite dev server | E2E 支撑 | 是 | Playwright webServer 使用 | `VITE_API_BASE_URL` 可选 | 否 |
| `npm run build -w @simwar/student` | `apps/student/package.json` | student TypeScript + Vite build | typecheck、quality | 是 | 是 | 无 | 是 |
| `npm run preview -w @simwar/student` | `apps/student/package.json` | student build preview | E2E / 手动验收辅助 | 是 | 可选 | 无 | 否 |

### 2.3 packages / services scripts

| 命令 | 来源 | 当前用途 | 对应质量门禁 | 适合本地运行 | 适合 CI | 环境变量 | 阻断合并 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `npm run build -w @simwar/shared-contracts` | `packages/shared-contracts/package.json` | shared contracts TypeScript build | typecheck、contract | 是 | 是 | 无 | 是 |
| `npm run dev -w @simwar/api` | `services/api/package.json` | 构建依赖包后用 `tsx watch` 启动 API | E2E 支撑 | 是 | Playwright webServer 间接使用 | API 端口、store 文件、DB 相关变量可选 | 否 |
| `npm run build -w @simwar/api` | `services/api/package.json` | API TypeScript build | typecheck、quality | 是 | 是 | 无 | 是 |
| `npm run start -w @simwar/api` | `services/api/package.json` | 启动 API dist/server.js | 部署 / smoke 辅助 | 是 | 可用于发布后 smoke | 运行时环境变量 | 发布门禁可阻断 |
| `npm run build -w @simwar/simulation-core` | `services/simulation-core/package.json` | simulation-core TypeScript build | typecheck、settlement、plugin boundary | 是 | 是 | 无 | 是 |

## 3. 当前已有质量门禁能力

SimWar 当前已经具备 npm-based 质量门禁雏形，不是没有 quality。

| 能力 | 当前命令或配置 | 保护重点 |
| --- | --- | --- |
| format check | `npm run format:check` | 防止格式噪音进入 review |
| lint | `npm run lint` | TypeScript / JavaScript 基础静态规则 |
| architecture boundary lint | `npm run lint:boundaries` | 阻止前端导入 simulation-core、route 直写 store、agent 越界 truth writer、plugin 直写真值 |
| unused / dependency check | `npm run check:unused` | 未使用文件、依赖、二进制、未声明依赖 |
| security audit | `npm run security:audit` | high 级别 npm 依赖漏洞 |
| typecheck | `npm run typecheck` | 全仓 TypeScript project references |
| Vitest | `npm test` | unit / integration / repository / simulation-core 测试 |
| coverage | `npm run test:coverage` | coverage 输出和阈值 |
| contract / schema check | `npm run test:contract`、`npm run test:schema-drift` | OpenAPI、JSON Schema、fixtures、shared-contracts、domain events |
| migration static check | `npm run test:migration` | SQL migration 文件、表、索引、RLS、关键约束 |
| migration apply / idempotency | `npm run test:migration:apply` | migration 在真实 Postgres 测试库可重复 apply |
| Postgres adapter integration | `npm run test:postgres-adapter` | repository adapter 与 Postgres 行为 |
| Playwright UI E2E | `npm run test:e2e:ui` | teacher / student UI 主流程和失败 trace artifact |
| build | `npm run build` | shared-contracts、simulation-core、API、三端 apps 构建 |

当前短板不是缺少综合质量门禁，而是若干关键风险还缺少更显式的专项命令。Replay、settlement idempotency、plugin boundary、OpenAPI Spectral 等能力需要从“被包含在综合测试里”升级为“可单独调用、可单独进入 CI 的门禁”。

## 4. 当前缺失但建议新增的 scripts

### 4.1 P0：近期优先补齐

| 拟新增命令 | 当前是否存在 | 设计目的 | 适合保护的风险点 | 是否进入 CI | 是否阻断合并 | 前置条件 | 推荐阶段 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `npm run test:unit` | 不存在 | 显式只跑 unit tests | pure functions、schema parser、simulation-core deterministic 行为 | 是 | 是 | 测试文件命名或 Vitest include 约定稳定 | 现在 |
| `npm run test:integration` | 不存在 | 显式只跑 integration tests | route/service/repository 组合链路、decision 状态机 | 是 | 是 | 区分 `tests/integration/**/*.test.ts` | 现在 |
| `npm run test:e2e` | 不存在 | 作为 `test:e2e:ui` 的标准别名 | 三端主流程入口命令统一 | 是 | smoke 阻断 | 保留现有 Playwright 配置 | 现在 |
| `npm run schema:check` | 不存在 | 作为 schema drift / fixture validation 标准别名 | shared-contracts、JSON Schema、fixtures 漂移 | 是 | 是 | 可先映射到 `test:schema-drift` | 现在 |
| `npm run openapi:lint` | 不存在 | Spectral lint OpenAPI | 字段命名、status enum、response schema、truth fields 暴露 | 是 | 稳定后阻断 | 增加 Spectral 配置和依赖，或选择已有 OpenAPI lint 工具 | Phase 1 / 2 |

### 4.2 P1：真值链专项命令

| 拟新增命令 | 当前是否存在 | 设计目的 | 适合保护的风险点 | 是否进入 CI | 是否阻断合并 | 前置条件 | 推荐阶段 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `npm run test:replay` | 不存在 | 运行 Replay / Shadow Replay 专项测试 | replay manifest、truth hash、official result 只读 | 是 | 是 | replay fixtures 和测试目录稳定 | Phase 2 / 3 |
| `npm run test:replay:golden` | 不存在 | 运行 golden replay matrix | 相同输入稳定输出、参数差异可解释 | 是 | 是 | golden fixtures、seed、engine id 固定 | Phase 2 / 3 |
| `npm run test:settlement-idempotency` | 不存在 | 单独验证重复 settle 幂等 | 重复 SettlementResult、重复 StateSnapshot、重复 ledger side effect | 是 | 是 | settlement integration 测试可独立筛选 | Phase 2 / 3 |
| `npm run test:plugin-boundary` | 不存在 | 单独验证插件边界 | plugin 直写 `state_true`、score、rank、SettlementResult | 是 | 是 | plugin hook test 和 boundary lint 稳定 | Phase 2 / 3 |
| `npm run test:adapter-contract` | 不存在 | JSON/Postgres repository adapter contract 统一入口 | adapter 行为漂移、migration 与 port 不一致 | 是 | 是 | repository adapter contract 可复用 | Phase 2 / 3 |

### 4.3 P2：中期增强命令

| 拟新增命令 | 当前是否存在 | 设计目的 | 适合保护的风险点 | 是否进入 CI | 是否阻断合并 | 前置条件 | 推荐阶段 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `npm run test:pact` | 不存在 | consumer-driven contract testing | student / teacher / admin 对 API 的真实消费契约漂移 | 是 | 稳定后阻断 | Pact 工具链、consumer/provider pact 文件 | Phase 1 到 Phase 3 后半 |
| `npm run ci` 或 `npm run quality:ci` | 不存在 | CI 专用聚合，避免本地 `quality` 与 CI jobs 重复或过重 | 本地与 CI 命令语义不清 | 是 | 是 | 明确 CI job 拆分策略 | Phase 2 / 3 |
| Storybook 相关命令 | 不存在 | UI 组件工作台和静态构建 | 三端复杂状态组件退化 | 是，前端稳定后 | 可先不阻断 | Storybook 配置和 stories | 前端稳定后 |
| Chromatic 相关命令 | 不存在 | 视觉回归 | 样式和复杂表格视觉变化 | 是，Storybook 稳定后 | 关键组件稳定后阻断 | Chromatic 项目和 token | 前端稳定后 |
| Lighthouse 相关命令 | 不存在 | 性能和可访问性 | student 首屏、teacher 大表格、移动端可访问性 | 是 | 先报告型 | Lighthouse CI 配置 | 前端稳定后 |
| Sonar 相关命令 | 不存在 | 代码质量和安全扫描 | 复杂度、重复、隐性漏洞 | 是 | 先报告型 | SonarQube / SonarCloud 配置 | Phase 1 到 Phase 3 |
| Snyk 相关命令 | 不存在 | 供应链安全 | transitive dependency、许可证、高危漏洞 | 是 | high / critical 稳定后阻断 | Snyk 配置和 token，或选择 OWASP Dependency-Check | Phase 1 到 Phase 3 |

## 5. 不能假设已经存在的命令

以下命令当前不能作为 SimWar 的真实命令入口。若文档、Codex 提示词或 CI 草案中出现，应明确标注为未来可选或拟新增命令，而不是当前项目命令。

```text
pnpm install
pnpm run quality
pnpm test
pnpm run test:*
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:replay
npm run test:settlement-idempotency
npm run test:plugin-boundary
npm run openapi:lint
npm run schema:check
npm run test:pact
Storybook / Chromatic / Lighthouse / Sonar / Snyk 相关命令
```

当前推荐的真实命令入口应写成：

```text
npm ci
npm run quality
npm run typecheck
npm test
npm run test:contract
npm run test:e2e:ui
```

## 6. 推荐进入 GitHub Actions / Harness 的门禁

### 6.1 GitHub Actions PR 基础门禁

建议进入 PR 基础门禁：

```text
npm ci
npm run format:check
npm run lint
npm run lint:boundaries
npm run check:unused
npm run security:audit
npm run typecheck
npm run test:coverage
npm run test:contract
npm run test:schema-drift
npm run test:migration
npm run build
```

这些命令适合在每个 PR 上阻断合并。它们保护格式、静态规则、架构边界、依赖健康、类型、测试覆盖、契约、schema、migration 静态结构和构建结果。

### 6.2 GitHub Actions DB 门禁

建议 DB 门禁：

```text
npm run test:migration:apply
npm run test:postgres-adapter
```

要求：

- GitHub Actions 提供 Postgres service。
- 设置 `DATABASE_URL` 指向 disposable test database。
- migration apply 必须证明 migration 可重复运行，不破坏 idempotency。
- Postgres adapter test 必须证明 adapter 行为与 repository port 语义一致。

### 6.3 GitHub Actions E2E

建议 E2E 门禁：

```text
npx playwright install --with-deps chromium
npm run test:e2e:ui
```

artifact 建议：

- 上传 `playwright-report`。
- 上传 `test-results`。
- 保留 trace，用于失败定位。

E2E 初期建议只让主流程 smoke 阻断合并；复杂矩阵可先作为报告型或 nightly job。

### 6.4 未来补齐后进入 CI

以下命令补齐后建议进入 CI：

```text
npm run openapi:lint
npm run schema:check
npm run test:replay
npm run test:settlement-idempotency
npm run test:plugin-boundary
npm run test:adapter-contract
```

推荐策略：

- `schema:check` 可先映射到当前 `test:schema-drift`，作为标准别名。
- `openapi:lint` 初期可报告型，OpenAPI 规则稳定后阻断。
- `test:replay`、`test:settlement-idempotency`、`test:plugin-boundary` 属于真值链门禁，稳定后应阻断。
- `test:adapter-contract` 应保护 JSON / Postgres adapter 行为一致性。

### 6.5 Harness 更适合

Harness 更适合承载发布治理，而不是替代当前 npm scripts。

适合 Harness 的能力：

- staging / prod deploy。
- 审批。
- 回滚。
- 环境变量治理。
- migration apply。
- 发布后 smoke / E2E。
- 质量报告聚合。

推荐分工：

- npm scripts 提供可复用命令入口。
- GitHub Actions 负责 PR 阻断型质量门禁。
- Harness 负责环境、审批、发布、回滚和发布后验证。

## 7. 对 AGENTS.md 的修订建议

`AGENTS.md` 当前已经明确当前仓库使用 npm workspaces 与 `package-lock.json`，并提醒不要假设 pnpm 命令可运行。后续仍建议做以下收口：

1. 如果 `AGENTS.md` 中仍有 pnpm 默认命令，应改为 npm。
2. 如果保留 pnpm，应明确标注为“未来可选，不是当前项目命令”。
3. 建议在涉及工具链、CI、E2E 或质量门禁的读取顺序中加入：
   - `.github/workflows/ci.yml`
   - `.github/dependabot.yml`
   - `.github/workflows/codeql.yml`
   - `playwright.config.ts`
   - `vitest.config.ts`
   - `knip.json`
4. 建议把后续文档中的当前命令统一成：
   - `npm ci`
   - `npm run quality`
   - `npm run typecheck`
   - `npm test`
   - `npm run test:contract`
   - `npm run test:e2e:ui`
5. 建议将未来命令统一标注为“拟新增命令”，避免 Codex 或 CI 草案误用。

## 8. 实施顺序建议

推荐按以下顺序推进：

1. 先提交 `AGENTS.md`。
2. 生成并提交 `docs/architecture/simwar-package-scripts-standard.md`。
3. 审查 CI。
4. 生成 GitHub Actions 质量门禁计划。
5. 小步新增 package scripts。
6. 小步接入 CI。
7. 再考虑 Harness / SonarQube / Codecov / Sentry / OpenTelemetry。

这个顺序的核心是先把“当前项目真实可运行的 npm 命令”写清楚，再让 Codex、CI 和后续治理文档围绕同一套命令工作。不要先改 CI 或 package scripts，再回头补文档，否则容易把拟新增命令误当成当前能力。

## 9. 结论

SimWar 当前已经有 npm-based 质量门禁雏形，短板不是“没有 quality”，而是 Replay、settlement idempotency、plugin boundary、OpenAPI Spectral 等专项命令还不够显式，需要从“被包含在综合测试里”升级为“可单独调用、可单独进入 CI 的门禁”。

短期应把当前命令统一为 npm 语义，避免继续扩散 pnpm 默认命令。中期应把真值链专项测试拆成稳定脚本。长期再把 Harness、SonarQube、Codecov、Sentry、OpenTelemetry 等工具接入发布治理和运行时质量闭环。
