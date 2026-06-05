# Write-Path Migration Guardrails

本文档定义 SimWar 后续把 command / write paths 迁入 repository facade 或 command-oriented repository ports 前必须遵守的护栏。它承接 `repository-facade-migration-checkpoint.md`，但聚焦写路径风险，而不是 read-only facade migration。

当前 repository provider 已经接入 `ApiRuntime`，并且 read-only course、run、round、settlement result、audit log 读取路径已经开始通过 repository facade。下一步不能直接迁移写路径。写路径不仅是 persistence 操作，还同时承载权限、状态机、幂等、审计、truth-chain 和 replay 证据。

## 1. 为什么当前阶段不能直接迁移写路径

当前 `server.ts` 和 `simulation.ts` 中的写路径仍然保存了大量隐式行为：

- 通过当前 `SimWarStore` 数组顺序决定 latest decision、audit log 顺序和重复提交版本。
- 通过 `nextId(store, ...)` 生成对外可见 id。
- 通过直接修改对象保持现有 response body 和后续 handler 读取一致。
- 通过 `appendAudit(store, ...)` 记录 before / after 和 request id。
- 通过 `settleRound(store, input)` 同时完成幂等检查、仿真计算、round 状态更新、`replay_hash` 写入和 `SettlementResult` 写入。

如果在没有测试刻画的情况下把这些写路径迁到 facade 或 repository ports，可能出现外部 API 没有编译错误但行为已经漂移的情况。例如 status code 不变但 audit 内容变化，response body 不变但 replay hash 输入变化，或者 settlement result 可读但重复 settle 不再幂等。

因此，写路径迁移的第一原则是：先写 characterization tests，再迁移 implementation。

## 2. Characterization Tests 是迁移前置条件

Characterization tests 的目的不是设计新行为，而是锁定当前行为。它们应在迁移前回答：

- 当前 route 在成功和失败情况下返回什么 status code。
- 当前 response body 包含哪些字段。
- 当前错误 code 和 message 是否稳定。
- 当前写入哪些 store 集合。
- 当前是否写 audit，audit 的 action、resource、before / after 是否稳定。
- 当前是否改变 round status、decision version、`replay_hash` 或 `SettlementResult`。
- 当前重复请求是否幂等，或是否按现有规则产生新版本。

只有这些测试存在并通过，后续 PR 才能把某一个 command path 从 store 直写迁到 facade-backed command port。否则迁移会同时改变结构和行为，无法 review，也难以回滚。

## 3. 写路径风险与保护原则

### 3.1 Decision Submit

Decision submit 当前承担多重职责：

- 验证 actor 只能为自己的 team 提交。
- 校验 payload 不包含 truth-protected fields。
- 运行 `validateDecisionPayload`。
- 基于已有 decisions 计算 version。
- 创建可进入后续结算链的 decision。
- 写入 audit log。

迁移风险：

- version 计算可能改变；
- latest decision 选择可能改变；
- learner / team boundary 可能松动；
- canonical decision 与 role draft 的边界可能变模糊；
- audit action 或 resource id 可能变化。

保护原则：

- 不改变 canonical decision 选择逻辑；
- 不接受 role draft、AI advisory 或 learning evidence 作为 official decision；
- 不改变 invalid payload 的错误结构；
- 不改变 decision response shape；
- 不迁移前先补 decision submit characterization tests。

### 3.2 Round Lock

Round lock 当前是 settlement 前置门禁的一部分。它直接检查 round status，写入 `locked` 状态和 `decision_batch_id`，并记录 audit。

迁移风险：

- `open -> locked` 状态机被放宽或收紧；
- `decision_batch_id` 生成规则变化；
- audit before / after 变化；
- 后续 settlement 对 locked round 的判断被影响；
- 未来 canonical decision preflight 插入点被误改。

保护原则：

- 不改变当前 lock status code 和错误 code；
- 不改变 `decision_batch_id` 格式；
- 不改变 audit action 和 before / after；
- 不在同一个 PR 里引入新的 canonical preflight；
- 不迁移前先补 round lock characterization tests。

### 3.3 Round Publish

Round publish 当前只允许从 `settled` 进入 `published`。它影响结果展示、发布后只读和教学可见性。

迁移风险：

- 发布前状态校验变化；
- published 后结果可见性变化；
- round 对象引用变化导致后续 response 不一致；
- audit before / after 变化。

保护原则：

- 不改变 `settled -> published` 前置条件；
- 不改变 published response body；
- 不改变 result view 可见性；
- 不和 settlement write 或 replay hash 改动混在一个 PR；
- 不迁移前先补 round publish characterization tests。

### 3.4 settleRound

`settleRound(store, input)` 是当前 official settlement adapter。它虽然调用 simulation-core 计算，但仍负责关键 runtime side effects：

- 查找已有 `SettlementResult`，保持重复 settle 行为；
- 构造 replay hash；
- 创建 `SettlementResult`；
- 写 `round.status = "settled"`；
- 写 `round.replay_hash`；
- 写 `store.settlementResults`。

迁移风险：

- 重复 settle 不再返回同一结果；
- replay hash 输入结构变化；
- round status 和 settlement result 写入顺序变化；
- `SettlementResult` id 生成变化；
- settlement read model 与 write model 混在一起；
- plugin trace 或非 truth 输入误入 official result。

保护原则：

- 不直接改 `settleRound` 签名；
- 不直接改 replay hash 生成逻辑；
- 不把 write path 拆散到多个未测试 side effects；
- 不把 role draft、AI advisory 或 learning evidence 纳入 settlement input；
- 不迁移前先补 settlement result write 和 replay hash characterization tests。

### 3.5 Settlement Result Write

Settlement result write 是 truth-chain 的最终输出之一。当前 read model 已经可以通过 facade，但 write model 仍必须保持受控。

迁移风险：

- `SettlementResult` 结构漂移；
- result 写入和 round status 更新不同步；
- 幂等检查与写入之间出现竞争或重复结果；
- replay hash 与 settlement result 绑定关系变化；
- future Postgres adapter 写入行为与 JSON store 行为不一致。

保护原则：

- settlement read model 和 settlement write model 必须分离；
- write migration 必须有 idempotency tests；
- write migration 必须有 replay hash stability tests；
- write migration 必须验证 result response shape 不变；
- write migration 不应和 DB migration、Postgres runtime 或 package dependency 变更混在一起。

### 3.6 replay_hash Write

`replay_hash` 是正式结果可复现的核心证据。当前写入点包括 settlement result 和 round。

迁移风险：

- hash 输入字段变化；
- JSON serialization 顺序或字段集合变化；
- canonical decisions、scenario、parameter set、seed 或 team results 纳入方式变化；
- role draft、AI advisory、learning evidence 被误纳入 hash；
- Shadow Replay 证据无法和 official result 对齐。

保护原则：

- 不改变 replay hash 输入结构；
- 不改变 hash 算法；
- 不改变 hash 写入时机；
- 不把治理上下文混入 official truth hash；
- replay / shadow replay 必须能复现同一 official input。

### 3.7 Canonical Decision Selection

当前 settlement 会从每个 team 的 decisions 中选择现有 latest decision。后续角色化链路会更严格地要求 `RoleDecisionSection -> DecisionMergeCommit -> TeamConfirmation -> canonical Decision`，但迁移 repository command ports 时不能顺手改变当前 selection 逻辑。

迁移风险：

- latest decision 选择规则变化；
- role draft 被误当作 canonical decision；
- AI advisory 或 learning evidence 被误纳入 settlement；
- lock / settle 缺少 per-team canonical decision 的行为变化；
- future stricter canonical preflight 和 repository migration 混在一起。

保护原则：

- 不改变 canonical decision 选择逻辑；
- 不在同一 PR 中引入新的 role merge / confirmation gating；
- 不把 draft / advisory / learning evidence 作为 official decision；
- canonical selection 变更必须是单独 PR，并有正反向 characterization tests。

### 3.8 appendAudit Write

`appendAudit(store, ...)` 当前承担审计 id 生成、tenant 归属、actor、action、resource、request id、before / after 和 persist。

迁移风险：

- audit id 生成变化；
- tenant id 归属变化；
- audit 顺序变化；
- before / after clone 语义变化；
- 某些 command 写入忘记 audit；
- audit write 和 domain write 之间的失败语义变化。

保护原则：

- audit read 可以走 facade，但 audit write 不应在没有 tests 时迁移；
- append behavior 必须先有 characterization tests；
- audit order 和 filter 行为必须保持可解释；
- audit write migration 不应和 command domain write migration 混在一个 PR。

## 4. Truth-Chain Guardrails

后续所有写路径迁移都必须遵守以下 truth-chain 护栏：

- 不改变 replay hash 输入结构。
- 不改变 canonical decision 选择逻辑。
- 不改变 `SettlementResult` 结构。
- 不把 role draft、AI advisory、learning evidence 混入 settlement truth。
- settlement write model 和 read model 必须分离。
- replay / shadow replay 必须能复现相同 official input。
- Plugin 不得直接写 `state_true`、score、rank 或 `SettlementResult`。
- API route 不得绕过 service / repository 边界直接引入新的 truth side effect。
- 任何 command path 迁移都必须有 characterization tests、最小 diff 和独立回滚路径。

这些规则优先级高于“减少 store 访问数量”。如果为了减少一处 store write 而改变了 truth-chain，应该停止迁移。

## 5. 后续小 PR 顺序建议

### PR 1: add characterization tests for decision submit

目标：锁定当前 decision submit 成功、失败、版本、权限和 audit 行为。

建议覆盖：

- learner 只能提交自己 team；
- invalid payload 仍返回当前错误；
- truth-protected fields 被拒绝；
- duplicate submit 仍按当前版本规则处理；
- response body shape 不变；
- audit action 和 resource id 不变。

### PR 2: add characterization tests for round lock and publish

目标：锁定 round status mutation 当前行为。

建议覆盖：

- lock 只能在当前允许状态下执行；
- publish 只能在 `settled` 后执行；
- status code / error code 不变；
- `decision_batch_id` 不变；
- audit before / after 不变。

### PR 3: add characterization tests for settlement result write and replay hash

目标：锁定 settlement write 和 replay hash。

建议覆盖：

- missing scenario / parameter set / decisions 的错误；
- settle success response body；
- repeat settle idempotency；
- `round.status` 写入；
- `round.replay_hash` 写入；
- replay hash stability；
- role draft / AI advisory / learning evidence 不进入 official settlement truth。

### PR 4: add characterization tests for audit append behavior

目标：锁定 `appendAudit` 写入语义。

建议覆盖：

- audit id 生成；
- tenant id 默认值和 override；
- actor id / role；
- action / resource type / resource id；
- request id；
- before / after；
- audit ordering。

### PR 5: only after tests, introduce command-oriented repository ports

目标：在 tests 已经锁定行为后，再设计 command-oriented ports。

原则：

- ports 以 command use case 命名，而不是暴露任意 collection mutation；
- command port 不应改变 route contract；
- command port 不应拥有 simulation truth 解释权；
- command port 应明确 audit、idempotency、before / after 和 error behavior。

### PR 6: migrate one command path at a time

目标：每次只迁一个 command path，保持 PR 可 review、可回滚。

推荐顺序：

1. 低风险 audit append 或 non-truth metadata command；
2. course / team / run 普通 command；
3. round start / lock / publish；
4. decision submit；
5. settlement write；
6. replay / shadow replay command。

任何涉及 settlement write、replay hash 或 canonical decision selection 的迁移都应最后做。

## 6. 明确禁止事项

在 characterization tests 完成前，禁止：

- 一次性大改 `server.ts`；
- 直接改 `simulation.ts`；
- 直接改 `settleRound` 签名；
- 直接改 `replay_hash` 生成逻辑；
- 直接改 DB migration；
- 直接引入 Postgres adapter runtime；
- 直接修改 route contracts；
- 直接修改 package dependencies；
- 将 read model 和 write model 混在一个 PR；
- 将 settlement、replay、decision、audit 多条 command path 混在一个 PR；
- 借迁移 repository facade 的名义改变业务状态机。

## 7. 当前建议

下一步不要继续迁写路径。推荐先执行 PR 1 到 PR 4 的 characterization tests，把当前 command behavior 锁住。只有这些测试通过并成为 CI 门禁的一部分后，才进入 command-oriented repository ports 和逐个 command path 迁移。

这条路线会让 SimWar 的 repository facade 迁移保持小步、安全、可回滚，同时保护 canonical Decision、`SettlementResult`、`replay_hash` 和 audit chain 的长期可信度。
