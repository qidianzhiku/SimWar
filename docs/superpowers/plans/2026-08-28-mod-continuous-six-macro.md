# MOD 连续六轮 Support 宏任务实施计划

## 目标

在不创建第二 Truth/Settlement/Runtime/Registry/Model-Governance writer 的前提下，交付一个独立的 `@simwar/mod-support` 候选编译包。该包将六个 MOD 宏任务统一编译为可审计、可复现、可 Join 的 candidate/evidence 结果：

- R1 Full Vertical Model Binding Reality Qualification
- R2 Stakeholder Model Response Shadow
- R3 Executive Strategy Experiment Matrix
- R4 Robustness Uncertainty Tradeoff（仅有 fresh Need proof 时执行，否则 tombstone）
- R5 Regional Model Portability Version Evolution
- R6 Recalibration Drift Rollback Lifecycle（仅有 fresh Need proof 时执行，否则 tombstone）

实现必须是 candidate-only、provider-off、JSON-only、exact-ref、no-implicit-latest，并保留 role-safe projection、conflict/OOD/expiry/fallback、non-write 和 replay/non-overwrite 证据。

## 当前边界与复用

- 复用仓库既有的 W5/M8 qualification、W4/O4 dynamics、D6/M4 transfer、model-governance 与 Shanghai full-vertical 绑定概念；不复制这些正式 authority 或 runtime。
- 新包不写 `packages/shared-contracts` 的 index，不新增 API route，不修改 `services/simulation-core`、`services/api`、Settlement、Replay hash 或任何现有 authority writer。
- 只新增 lane-owned `packages/mod-support`、一个专用 JSON Schema/fixture、专用 unit/contract tests 和说明文档；根 `tsconfig.build.json` 与根 `package.json` 只做最小 workspace build wiring。
- 不将当前 #455/#456 的历史快照当作当前完成证据；最终报告只绑定执行时 fresh `HEAD`/tree/PR 状态。

## 文件范围

预计新增：

- `packages/mod-support/package.json`
- `packages/mod-support/tsconfig.json`
- `packages/mod-support/src/index.ts`
- `contracts/schemas/mod-support-macro.v1.json`
- `contracts/fixtures/mod-support-macro.valid.json`
- `tests/unit/mod-support-macro.test.ts`
- `tests/contract/mod-support-macro-contract.test.ts`
- `docs/architecture/mod-support-macro-program.md`
- `docs/quality/mod-support-macro-verification.md`

预计最小修改：

- `tsconfig.build.json`：加入包 project reference。
- `package.json`：把该包加入 `build:test-prerequisites` 和 `build`，保持 npm workspace 约定。

禁止修改：

- `services/api/src/**`、`services/simulation-core/src/**`、`packages/shared-contracts/src/index.ts`、正式 Settlement/Replay/Model Governance/ParameterSet writer、OpenAPI 路由、数据库迁移、前端运行时。

## TDD 顺序

1. 先写单元测试和契约测试，覆盖六个宏的 State B、exact ref 拒绝 floating latest、R4/R6 fresh-proof tombstone、R2 conflict/OOD abstention、R5 rights/expiry fail-closed、role visibility、authority non-write、稳定 digest 和 fixture 阈值。
2. 运行新增测试，确认在实现缺失时失败。
3. 实现纯函数 candidate compiler、exact-ref guard、canonical digest、宏任务 payload builders、role projections 和 invariant validator。
4. 运行新增测试并修复类型/行为问题；再跑 package build、根 typecheck、相关 contract/unit gate。
5. 生成六宏当前现实与 Join evidence pack，校验每个宏的 required artifact、JSON、hash、unsafe path/duplicate/member 规则，压缩为唯一外部 `FINAL-results.zip`。

## 验证门禁

- `npm run build -w @simwar/mod-support`
- `npm run typecheck`
- `npx vitest run tests/unit/mod-support-macro.test.ts tests/contract/mod-support-macro-contract.test.ts`
- `npm run test:contract`
- `npm run lint -- packages/mod-support/src/index.ts tests/unit/mod-support-macro.test.ts tests/contract/mod-support-macro-contract.test.ts`
- `npm run format:check`（如仓库基线存在无关失败，单独记录）
- `git diff --check`
- 任务相关完整 `npm test`/`npm run build` 结果与 pre-existing failure 分离记录。

## 集成与交付

- 保持一条独立 `codex/` 分支、一个 Product PR、普通合并；不 force push、不修改分支保护、不关闭或合并不属于本任务的 PR。
- Product PR body 必须含 Summary、Validation、Scope Notes，并明确 candidate-only/no formal write/known limits。
- CI/CodeQL 只读回读；只有 required checks green 且 P0=0 才普通合并。
- 合并后以 detached current master 复验 package build/tests/evidence archive。
- 最终只交付一个 canonical `SIMWAR-MOD-CONTINUOUS-6-MACRO-FINAL-results.zip` 及 SHA-256；内部包含 Program Control readback、六宏结果目录、manifest/hash/verification/hand-off，不包含 node_modules、repo clone、secrets、raw restricted data 或临时缓存。
