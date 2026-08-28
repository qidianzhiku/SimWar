# MOD 连续六轮 Support 宏任务验证说明

## 本任务可复验门禁

```text
npm run build -w @simwar/mod-support
npm run typecheck
npx vitest run tests/unit/mod-support-macro.test.ts tests/contract/mod-support-macro-contract.test.ts
npm run lint -- packages/mod-support/src/index.ts tests/unit/mod-support-macro.test.ts tests/contract/mod-support-macro-contract.test.ts
npx prettier --check packages/mod-support/src/index.ts packages/mod-support/package.json packages/mod-support/tsconfig.json contracts/schemas/mod-support-macro.v1.json contracts/fixtures/mod-support-macro.valid.json tests/unit/mod-support-macro.test.ts tests/contract/mod-support-macro-contract.test.ts docs/architecture/mod-support-macro-program.md docs/quality/mod-support-macro-verification.md
git diff --check
```

单元测试覆盖：六宏 State A→State B、MJP thresholds、exact ref/floating token 拒绝、R4/R6 tombstone、结构化 fresh Need proof 的 issuer/scope/source/expiry/digest 绑定、R2 conflict/stale/OOD abstention、R5 rights/expiry/calibration limits、Student visibility、authority firewall 和 stable digest。契约测试使用 Ajv 2020 验证 canonical fixture 与所有六宏生成结果，并拒绝 `official_truth_write=true` 的漂移。

## 全仓库门禁解释

根 `npm test`、`npm run test:contract`、`npm run build` 仍是最终工程门禁。若失败，必须把本任务定向结果与当前 master 的 pre-existing failure 分开记录。基线 fresh run 已有一项无关失败：`tests/unit/store-snapshot-persistence.test.ts` 的 migration dry-run planner 测试在 5 秒超时；不能把这项失败归因于 MOD support。根 `format:check` 目前报告仓库已有大量文件不符合格式（fresh count 106），因此采用上述新增文件定向格式检查，并保留全仓库结果。

## Archive gate

最终 evidence generator 必须在 ZIP 前完成：每个宏的 required artifact 清单、所有 JSON parse、manifest member set、SHA-256 覆盖、ZIP testzip、duplicate/unsafe path 检查、禁止 `node_modules`/repo clone/raw restricted data/secrets/temp cache 检查。外层只保留一个 canonical `FINAL-results.zip`；其内部含 Program Control readback、R1–R6 macro folders、current-reality/PR reconciliation、reuse/tombstone、validation、known limits、handoff 和 archive verification。
