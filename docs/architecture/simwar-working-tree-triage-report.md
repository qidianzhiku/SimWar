# SimWar Working Tree Triage Report

更新时间：2026-05-27

适用范围：当前 SimWar 工作区中所有已修改、未跟踪、待分流文件。本文只记录未提交改动分流审计结果，不代表已提交任何文件，也不修改业务代码、CI、package scripts、schema 或 migration。

## 1. 当前工作区总体结论

当前工作区不适合继续直接开发 CI。

当前同时混有质量治理、Phase 2/3 业务实现、契约 / 迁移 / 测试、新旧文档和未确认 E2E。继续在这个状态下修改 `.github/workflows/ci.yml` 会扩大上下文风险，使后续 PR 拆分和 review 变得更困难。

在分流完成前，不应继续修改 `.github/workflows/ci.yml`。

不能执行批量 `git clean` 或批量 `git restore`。当前有大量未跟踪文件可能属于真实 Phase 2/3 主线成果，批量清理或批量恢复都有误删有效工作的风险。

## 2. A 类：已完成并应保留的质量治理配置

建议动作：保留，后续按小 PR 审查提交，不与业务代码混提。

| 文件 | 建议动作 |
| --- | --- |
| `.github/workflows/ci.yml` | 保留；单独审查 workflow diff 后再提交 |
| `.gitignore` | 保留；与格式 / 产物治理一起审查 |
| `.prettierignore` | 保留；与格式治理一起审查 |
| `eslint.config.js` | 保留；与 lint 配置一起审查 |
| `package.json` | 保留；与 `package-lock.json` 一起单独审查 |
| `package-lock.json` | 保留；必须和 `package.json` 一起审查 |
| `packages/shared-contracts/package.json` | 保留；与 workspace build / typecheck 配置一起审查 |
| `services/api/package.json` | 保留；与 API scripts / runtime 依赖一起审查 |
| `services/api/tsconfig.json` | 保留；与 TypeScript build 配置一起审查 |
| `tsconfig.build.json` | 保留；与 typecheck / build gate 一起审查 |
| `vitest.config.ts` | 保留；与 coverage / test gate 一起审查 |
| `scripts/check-contracts.mjs` | 保留；与 contract / schema drift gate 一起审查 |
| `scripts/check-architecture-boundaries.mjs` | 保留；与 architecture boundary lint 一起审查 |
| `scripts/check-migrations.mjs` | 保留；与 migration static check 一起审查 |
| `scripts/check-postgres-migration-apply.mjs` | 保留；与 real Postgres apply gate 一起审查 |
| `docs/architecture/simwar-development-quality-toolchain-roadmap.md` | 保留；已作为长期质量工具链路线图 |
| `docs/architecture/understand-anything-usage-log.md` | 保留；用于 Understand Anything 使用记录和图谱治理 |
| `docs/devops/security-scanning.md` | 保留；与 security / CodeQL / SCA 规划一起审查 |
| `docs/quality/phase-2-3-baseline-checklist.md` | 保留；与 Phase 2/3 baseline gate 一起审查 |

特别说明：

- `.github/workflows/ci.yml`、`package.json`、`package-lock.json` 风险最高。
- 提交前必须单独 review diff。
- `package.json` / `package-lock.json` 会影响全仓依赖、scripts、CI 和本地开发命令，不能只凭路径直接提交。

## 3. B 类：学员端角色化决策 / Phase 2/3 主线业务改动

建议动作：保留；拆成 contracts/schema/fixtures、db/migration、API/repository、simulation-core/plugin、frontend、tests 多个提交或 PR；不要和质量治理配置混提。

### 3.1 apps 前端三端改动

| 文件 | 归属 |
| --- | --- |
| `apps/admin/src/App.tsx` | admin 前端业务流 |
| `apps/admin/src/styles.css` | admin 样式 |
| `apps/student/src/App.tsx` | student 角色化决策流 |
| `apps/student/src/styles.css` | student 样式 |
| `apps/teacher/src/App.tsx` | teacher 课程 / 队伍 / 回合 / 发布流 |
| `apps/teacher/src/styles.css` | teacher 样式 |

### 3.2 contracts/openapi、contracts/schemas、contracts/fixtures

已修改契约文件：

```text
contracts/openapi/p0-api.openapi.yaml
contracts/schemas/audit-log.v1.json
contracts/schemas/rbac.v1.json
contracts/schemas/settlement-result.v1.json
contracts/schemas/user.v1.json
```

新增 schemas：

```text
contracts/schemas/case-candidate.v1.json
contracts/schemas/case-consent.v1.json
contracts/schemas/coach-output.v1.json
contracts/schemas/course-data-policy.v1.json
contracts/schemas/course.v1.json
contracts/schemas/decision-merge-commit.v1.json
contracts/schemas/decision.v1.json
contracts/schemas/domain-event.v1.json
contracts/schemas/entitlement-access-decision.v1.json
contracts/schemas/entitlement-ledger.v1.json
contracts/schemas/model-call-log.v1.json
contracts/schemas/parameter-set.v1.json
contracts/schemas/payment-order.v1.json
contracts/schemas/plugin-manifest.v1.json
contracts/schemas/plugin-package.v1.json
contracts/schemas/replay-diff-report.v1.json
contracts/schemas/replay-input-manifest.v1.json
contracts/schemas/replay-report.v1.json
contracts/schemas/replay-run.v1.json
contracts/schemas/role-decision-section.v1.json
contracts/schemas/round.v1.json
contracts/schemas/run.v1.json
contracts/schemas/scenario-package.v1.json
contracts/schemas/settlement-plugin-trace.v1.json
contracts/schemas/state-snapshot.v1.json
contracts/schemas/team-confirmation.v1.json
contracts/schemas/team.v1.json
contracts/schemas/wellness-parameters.v1.json
```

新增 fixtures：

```text
contracts/fixtures/case-consent-withdrawn.valid.json
contracts/fixtures/coach-output.valid.json
contracts/fixtures/course.valid.json
contracts/fixtures/decision-merge-commit.valid.json
contracts/fixtures/decision.valid.json
contracts/fixtures/entitlement-access-decision.valid.json
contracts/fixtures/model-call-log.valid.json
contracts/fixtures/parameter-set.valid.json
contracts/fixtures/plugin-manifest.valid.json
contracts/fixtures/plugin-package.valid.json
contracts/fixtures/replay-diff-report.valid.json
contracts/fixtures/replay-input-manifest.valid.json
contracts/fixtures/replay-report.valid.json
contracts/fixtures/replay-run.valid.json
contracts/fixtures/role-decision-section.valid.json
contracts/fixtures/round.valid.json
contracts/fixtures/run.valid.json
contracts/fixtures/scenario-package.valid.json
contracts/fixtures/team.valid.json
contracts/fixtures/wellness-parameters.valid.json
```

### 3.3 packages/shared-contracts

```text
packages/shared-contracts/src/index.ts
```

### 3.4 db/migrations

```text
db/migrations/20260519_001_create_repository_identity_course_tables.sql
db/migrations/20260519_002_create_repository_decision_tables.sql
db/migrations/20260519_003_create_repository_billing_entitlement_tables.sql
db/migrations/20260519_004_create_repository_data_governance_tables.sql
db/migrations/20260519_005_create_repository_ledger_replay_tables.sql
db/migrations/20260522_006_create_plugin_replay_ai_contract_tables.sql
db/migrations/20260524_007_add_parameter_set_parameters_jsonb.sql
db/migrations/20260525_008_create_auth_session_table.sql
```

### 3.5 services/api auth / repository / routes / settlement / replay

已修改 API 文件：

```text
services/api/src/auth.ts
services/api/src/server.ts
services/api/src/simulation.ts
services/api/src/store.ts
```

新增 API / repository / service 文件：

```text
services/api/src/auth-context.ts
services/api/src/foundation-services.ts
services/api/src/http.ts
services/api/src/json-repository-adapter.ts
services/api/src/postgres-repository-adapter.ts
services/api/src/replay-service.ts
services/api/src/repositories.ts
services/api/src/repository-facade.ts
services/api/src/repository-ports.ts
services/api/src/routes/agent-routes.ts
services/api/src/routes/audit-routes.ts
services/api/src/routes/auth-routes.ts
services/api/src/routes/course-routes.ts
services/api/src/routes/decision-routes.ts
services/api/src/routes/foundation-routes.ts
services/api/src/routes/governance-routes.ts
services/api/src/routes/health-routes.ts
services/api/src/routes/rbac-routes.ts
services/api/src/routes/replay-routes.ts
services/api/src/routes/round-routes.ts
services/api/src/routes/settlement-routes.ts
services/api/src/routes/tenant-routes.ts
services/api/src/routes/types.ts
services/api/src/routes/user-routes.ts
services/api/src/settlement-service.ts
```

### 3.6 services/simulation-core

```text
services/simulation-core/README.md
services/simulation-core/package.json
services/simulation-core/src/finance.ts
services/simulation-core/src/index.ts
services/simulation-core/src/market.ts
services/simulation-core/src/operations.ts
services/simulation-core/src/scoring.ts
services/simulation-core/src/toy-logit-engine.ts
services/simulation-core/src/types.ts
services/simulation-core/src/wellness-parameters.ts
services/simulation-core/src/wellness-plugin.ts
services/simulation-core/tsconfig.json
```

### 3.7 plugins

```text
plugins/wellness/plugin.manifest.json
```

### 3.8 tests/unit、tests/integration、tests/contract

已修改 integration tests：

```text
tests/integration/p0-flow.test.ts
tests/integration/p1-auth-rbac.test.ts
```

新增 tests：

```text
tests/contract/repository-adapter-contract.ts
tests/integration/async-repository-facade.test.ts
tests/integration/p2-engineering-foundation.test.ts
tests/integration/postgres-repository-adapter.test.ts
tests/unit/auth-token.test.ts
tests/unit/decision-schema.test.ts
tests/unit/json-repository-adapter.test.ts
tests/unit/simulation-core.test.ts
```

## 4. C 类：可能属于旧任务或历史遗留的改动

建议动作：需要人工确认；不应直接提交；需要判断是否仍服务当前 Phase 2/3 主线。

已修改文档：

```text
DEVELOPMENT_PLAN.md
README.md
docs/architecture/adr.md
docs/architecture/bpmn-workflows.md
docs/architecture/database-design.md
docs/architecture/event-driven-architecture.md
docs/architecture/industry-plugin-model-report.md
docs/architecture/parameter-set-management.md
docs/architecture/simwar-architecture-overview.md
docs/architecture/system-architecture.md
docs/contracts/api-contract.md
docs/contracts/api-legacy-notes.md
docs/contracts/model-engineering-contract.md
docs/contracts/student-rbac-decision-refactor.md
docs/devops/ci-cd-pipeline.md
docs/devops/env-setup.md
docs/devops/monitoring-alerting.md
docs/devops/runtime-build-environment.md
docs/devops/tech-stack.md
docs/frontend/component-library.md
docs/frontend/figma-prototype-spec.md
docs/frontend/frontend-state-flow.md
docs/frontend/teacher-student-architecture.md
docs/product/billing-entitlement-plan.md
docs/product/data-privacy-case-community-rules.md
docs/product/feature-refinement.md
docs/product/non-functional-requirements.md
docs/product/requirements.md
docs/product/user-stories.md
docs/quality/replay-shadow-replay-test-plan.md
docs/quality/test-coverage.md
docs/research/benchmark-report.md
docs/research/cesim-benchmark.md
docs/research/executive-model-study.md
docs/research/marketplace-simulations-benchmark.md
docs/research/marketplace-simulations-upgrade-plan.md
```

新增文档：

```text
docs/architecture/industry-plugin-development-guide.md
docs/architecture/post-document-change-impact-assessment.md
docs/architecture/repository-adapter-plan.md
docs/architecture/student-role-based-decision-phase-1-contract-plan.md
docs/research/small-model-performance-optimization.md
```

未确认 E2E / legacy 命名测试：

```text
tests/e2e-ui/sprint8-product-flow.spec.ts
tests/e2e/p1-frontdoor-smoke.test.ts
```

说明：`sprint8` / `p1` 命名测试需要确认是否改名、迁移到正式 smoke/full E2E 分层，或撤销。

## 5. D 类：生成产物或不应提交文件

本轮没有发现以下生成产物或典型不应提交文件：

```text
coverage/
dist/
build/
test-results/
playwright-report/
tmp/
.understand-anything/
logs/
```

当前无需执行清理。

## 6. 下一步最安全操作建议

建议顺序：

1. 暂停新增功能和 CI 修改。
2. 先提交本 triage report 文档。
3. 单独审查 A 类中的 `.github/workflows/ci.yml`。
4. 单独审查 `package.json` / `package-lock.json`。
5. 单独审查 `vitest.config.ts` / `tsconfig.build.json` / `eslint.config.js` / `.prettierignore` / `.gitignore`。
6. 把 B 类拆成 contracts/schema/fixtures、db/migration、API/repository、simulation-core/plugin、frontend、tests。
7. C 类逐个确认是否保留。
8. 禁止 `git clean` / `git restore` 批量操作。

## 7. 建议的提交拆分路线

后续建议按以下 commit / PR 边界拆分：

```text
docs: add working tree triage report
ci: harden GitHub Actions workflow
chore: update quality tooling configuration
chore: standardize npm scripts
contracts: add role decision schemas and fixtures
db: add repository and decision migrations
api: add repository and decision routes
core: add simulation settlement and plugin foundations
test: add repository and decision test coverage
frontend: update role-based decision workflows
docs: reconcile legacy architecture documents
```

## 8. 风险提醒

- 当前不能把 A/B/C 混在一个提交。
- `package-lock.json` 必须和 `package.json` 一起审查。
- migration 必须单独审查。
- contracts 和 shared-contracts 必须保持一致。
- E2E 测试命名需要标准化。
- 不要让 role draft 污染 canonical Decision。
- 不要让 plugin 直接写 SettlementResult。
- 不要让 Replay truth hash 包含 AI advisory 或 learning evidence。
