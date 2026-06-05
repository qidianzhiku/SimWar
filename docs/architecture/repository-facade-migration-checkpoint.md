# Repository Facade Migration Checkpoint

本文档记录 SimWar 当前 repository facade 迁移进度，以及进入 command / write path 迁移前必须保留的 truth-chain 护栏。

## 1. 当前迁移状态

截至本 checkpoint，SimWar 已经完成 repository 访问边界的第一轮收口：

- `repository-ports.ts` 定义 API 数据访问端口。
- `json-repository-adapter.ts` 将当前 JSON / memory store 适配为 repository ports。
- `repository-facade.ts` 为 API use case 暴露异步 facade。
- `repository-provider.ts` 将 ports 与 facade 组合为 runtime provider。
- `server.ts` 已经创建 `ApiRuntime`，并挂载 `repositoryProvider`。
- 部分低风险 read-only path 已经开始通过 `runtime.repositoryProvider.facade` 读取数据。

这个阶段的目标不是切换完整 runtime，也不是把 command path 一次性迁到 repository facade，而是先证明 provider 可以进入 API runtime，并让低风险读路径逐步脱离直接 store lookup。

## 2. 已迁移的 Read-Only Paths

当前已经迁移到 facade 的路径均为只读路径，且保持 response shape、status code、route contract 不变。

| Read path | 当前迁移方式 | 行为边界 |
| --- | --- | --- |
| `GET /api/v1/courses/:id` | 通过 `facade.courses.getCourse` 做只读 lookup，再从现有 store hydrate 原 response shape。 | 不修改 course create / publish / team / run 写入逻辑。 |
| result view 中的 run / round lookup | 通过 `facade.runs.getRun` 和 `facade.rounds.listRoundsForRun` 查找 result view 所需 round。 | 不修改 round start / lock / publish / settle 写入逻辑。 |
| settlement result read model | 通过 `facade.settlements.listSettlementResultsForRound` 读取 public result view 所需 settlement result。 | 不修改 `settleRound`、`SettlementResult` 写入或 replay hash。 |
| audit log reads | 通过 `facade.auditLogs.listAuditLogs` 读取 audit logs，并保留既有 `tenant_id` / `action` / `actor_id` / `resource_type` 过滤语义。 | 不修改 `appendAudit` 或 audit write path。 |

这些迁移共同遵守一个原则：facade 只用于只读访问，不改变 API 对外行为，不改变 mutation side effect，不改变 truth-chain。

## 3. 仍保留在 Store / Runtime 直接路径中的 Write Paths

以下核心 write paths 仍然应保留在当前 store / runtime 直接路径中，直到 characterization tests 和 command port 设计完成：

- auth login / logout session 写入；
- tenant / user 创建和更新；
- course create / publish；
- team create 与 captain 绑定；
- run create 和 initial round create；
- round start / lock / publish；
- decision submit；
- settlement request；
- internal settlement execution；
- `appendAudit` 审计写入；
- `settleRound(store, input)` 内部幂等检查、round 状态更新、`replay_hash` 写入和 `SettlementResult` 写入。

这些路径不只是数据访问，它们还承载状态机、权限、审计、幂等、truth-chain 和 replay 稳定性。迁移前必须先用测试锁住当前行为。

## 4. 当前阶段不能直接迁移的区域

### Decision Submit

`decision submit` 当前同时负责权限检查、team boundary、payload validation、版本递增、canonical decision 写入和 audit 记录。若直接迁到 facade-backed command port，可能改变：

- version 计算；
- duplicate submit 行为；
- canonical decision 来源；
- learner 只能提交自己 team 的约束；
- lock / settle 读取最新 decision 的语义。

因此，迁移前应先补 characterization tests，确认现有行为被锁定。

### Round Lock

`round lock` 当前直接修改 `round.status` 和 `decision_batch_id`，并记录 audit。它是 settlement 前置门禁。直接迁移可能改变：

- `draft` / `open` / `locked` 状态校验；
- decision completeness preflight 的未来插入点；
- batch id 生成方式；
- audit before / after 结构。

第一轮不应迁移 lock command。

### Round Publish

`round publish` 当前要求 round 已经 `settled`，然后直接把 round 置为 `published`。该路径影响 result visibility 和只读状态。直接迁移可能改变：

- 发布前状态校验；
- 发布后只读边界；
- result visibility timing；
- audit before / after 结构。

迁移前应先补 publish characterization tests。

### settleRound

`settleRound(store, input)` 仍然是 official settlement 的 runtime adapter。它负责：

- 查找已有 `SettlementResult`，保持幂等；
- 调用 simulation-core engine；
- 构造 replay hash；
- 生成 `SettlementResult`；
- 写入 `round.status = "settled"`；
- 写入 `round.replay_hash`；
- push `store.settlementResults`。

该函数不应在没有 settlement idempotency 和 replay hash characterization tests 的情况下改签名、改输入、改 hash、改写入路径。

### Settlement Result Write

settlement read model 已经可以通过 facade 读取，但 write model 必须继续和 settlement runtime 分离。当前 `SettlementResult` 写入不只是 persistence，它还和 round status、replay hash、idempotency 绑定。

迁移 write model 前必须先证明：

- 重复 settle 返回同一正式结果或稳定等价结果；
- replay hash 输入结构没有变化；
- settlement result 不被 role draft、AI advisory 或 learning evidence 污染；
- plugin trace 不直接写 truth fields。

### replay_hash

`replay_hash` 是正式结果可复现性的核心证据。任何变动都可能导致历史回放、Shadow Replay 和参数审批证据失效。当前阶段不得改变：

- replay hash 输入字段；
- canonical decisions 的纳入方式；
- team result truth state 的纳入方式；
- seed / scenario / parameter set 的纳入方式；
- role draft / AI advisory / learning evidence 的排除边界。

### Canonical Decision Selection

当前 settlement 仍依赖 runtime 中的 latest decision selection。后续角色化决策链会要求 `RoleDecisionSection -> DecisionMergeCommit -> TeamConfirmation -> canonical Decision -> official settlement`，但在 characterization tests 完成前，不应改变当前 selection 逻辑。

## 5. Truth-Chain 保护原则

后续所有 repository facade 迁移必须遵守以下原则：

- 不改变 replay hash 输入结构。
- 不改变 canonical decision 选择逻辑。
- 不把 role draft、AI advisory、learning evidence 混入 settlement truth。
- settlement read model 和 settlement write model 必须分离。
- facade read migration 不应隐式改变 command side effects。
- Plugin 不得直接写 `state_true`、score、rank 或 `SettlementResult`。
- Replay / Shadow Replay 不得覆盖 official `SettlementResult`。
- Audit read 可以走 facade，audit write 仍应保持受控、可追踪。

换句话说，repository facade 是数据访问边界，不是业务真值解释权。正式真值仍由受控 runtime、simulation-core 和后续明确的 command services 管理。

## 6. 后续 PR 拆分路线

### PR A: document write-path migration guardrails

目标：补充 command path 迁移守则，明确每个写路径的 invariants、测试要求和禁止事项。

范围：

- 只改文档；
- 不改 `server.ts`、`simulation.ts`、routes、DB、package dependencies；
- 明确 decision、round、settlement、audit write 的迁移前置条件。

### PR B: add characterization tests for decision submit

目标：锁定当前 decision submit 行为。

应覆盖：

- learner 只能提交自己 team；
- invalid payload 返回原错误；
- version 递增行为；
- audit 记录；
- response body shape；
- 不写 truth-protected fields。

### PR C: add characterization tests for round lock / publish

目标：锁定 round 状态机当前行为。

应覆盖：

- start 只能从 `draft` 到 `open`；
- lock 只能从 `open` 到 `locked`；
- publish 只能从 `settled` 到 `published`；
- audit before / after；
- status code 和 route contract 不变。

### PR D: add characterization tests for settle result write and replay hash

目标：在迁移 settlement write 之前锁定 truth-chain。

应覆盖：

- settle 前置状态；
- missing scenario / parameter set / decisions；
- repeated settle idempotency；
- replay hash stability；
- `round.replay_hash` 写入；
- `SettlementResult` response shape；
- 不纳入 role draft、AI advisory、learning evidence。

### PR E: only after tests, consider facade-backed command ports

目标：在上述 characterization tests 通过后，才评估 command ports。

原则：

- 每个 command path 单独 PR；
- 每个 PR 只迁一个 command；
- 保留 API 行为和 response contract；
- 不同时改 DB、Postgres adapter、replay hash 和 package dependencies；
- 迁移 write path 时必须有 rollback-friendly scope。

## 7. 禁止一次性大改

后续任何一个 PR 都不应一次性大改以下区域：

- `server.ts` 大规模重构；
- `simulation.ts`；
- settlement runtime；
- replay hash；
- DB migration；
- route contract；
- package dependencies；
- Postgres adapter；
- billing / entitlement / case governance；
- Playwright / Knip / E2E 配置。

如果某个改动需要同时修改多条 truth-chain 路径，应先拆成文档、characterization tests、adapter/facade read path、command path 四类 PR。

## 8. 当前 Checkpoint 结论

当前 repository facade 迁移已经完成了低风险 read-only path 的第一轮收口。下一阶段不应继续直接迁写路径，而应先补文档和 characterization tests，把现有 command behavior 固化为可回滚、可验证的边界。

推荐下一步是先做 `PR A: document write-path migration guardrails`，再进入 decision、round、settlement 的 characterization tests。只有这些测试完成后，才考虑 facade-backed command ports。
