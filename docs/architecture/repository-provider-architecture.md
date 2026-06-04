# Repository Provider Architecture

本文档说明 SimWar 当前 repository provider 架构的职责边界、未接入运行时的原因，以及后续从 JSON-backed provider 过渡到 Postgres adapter 的推荐路径。

## 1. 架构目标

SimWar 的 repository provider 不是新的业务服务，也不是新的 runtime 入口。它的目标是把 API 层的数据访问从具体存储实现中逐步抽离出来，为后续 JSON store、Postgres adapter、repository facade 和 use case 分层提供稳定边界。

当前阶段的关键原则：

- repository ports 只定义数据访问能力。
- JSON repository adapter 只适配当前 JSON / memory store。
- repository facade 只组合面向 API use case 的读写入口。
- repository provider 只把 ports 和 facade 组合成一个可注入对象。
- server runtime、routes、settlement、Replay hash、DB migration 暂不在本阶段改动。

## 2. 组件职责边界

| 组件 | 当前职责 | 不承担的职责 |
| --- | --- | --- |
| `repository-ports.ts` | 定义 `SimWarRepositoryPorts` 和各领域 repository port interface。 | 不实现 JSON、Postgres、HTTP、route、settlement 或 replay 逻辑。 |
| `json-repository-adapter.ts` | 将当前 JSON / memory store 映射为 repository ports。 | 不改变 store 数据模型，不引入 DB，不改变 truth-chain 行为。 |
| `repository-facade.ts` | 将 ports 组合成 route-facing / use-case-facing 的异步访问入口。 | 不做业务状态机，不绕过 canonical decision，不写 settlement truth。 |
| `repository-provider.ts` | 将 ports 和 facade 打包为 provider，并提供 JSON-backed provider factory。 | 不接入 server runtime，不修改 routes，不决定运行时使用哪个 adapter。 |

这个分层让后续 API use case 能先依赖 facade / provider，而不是直接依赖 JSON store。等 Postgres adapter 准备好后，可以替换 provider 的 ports 实现，而不要求所有 route 同时重写。

## 3. 当前 JSON-Backed Provider 为什么只是组合层

当前 `createJsonRepositoryProvider` 只是组合层，原因是现有 API runtime 仍以 `SimWarStore` 和既有 route/server 流程为主。直接把 provider 接入 server runtime 会带来更大的行为面变化，包括：

- route 读取路径变化；
- command 写入路径变化；
- settlement 幂等行为变化；
- Replay manifest 或 hash 输入变化；
- 既有 JSON store persistence 行为变化；
- 后续 Postgres adapter 的迁移顺序被打乱。

因此，当前 provider 的正确状态是“可构造、可测试、未接线”。它证明 ports / adapter / facade 可以组合，但不改变正式 runtime。

## 4. Postgres Adapter 的预留方式

后续 Postgres adapter 应实现与 JSON adapter 相同的 `SimWarRepositoryPorts`。

推荐路径：

1. 保持 `repository-ports.ts` 不依赖具体数据库。
2. 为 Postgres adapter 实现同一组 ports。
3. 复用 JSON adapter / provider 测试中沉淀的行为契约。
4. 在 repository facade 层验证读写语义一致。
5. 最后再让 runtime 通过 provider 选择 JSON 或 Postgres ports。

这条路径的好处是：Postgres adapter 可以先在测试和 staging 环境中证明行为等价，再逐步进入 runtime。

## 5. 为什么当前阶段不修改 Runtime

本阶段不修改以下区域：

- routes；
- `server.ts`；
- settlement runtime；
- replay hash；
- DB migrations；
- package dependencies。

原因是 repository provider 架构还处于边界稳定阶段。若同时改 runtime，很难区分失败来自 provider 组合、adapter 行为、route 状态机、settlement 幂等，还是 replay truth hash。

当前阶段先稳定文档和 provider 架构，可以降低后续迁移风险。

## 6. Truth-Chain 保护原则

Repository provider 不得改变 SimWar truth-chain：

- canonical Decision 仍然是 official settlement 的唯一正式决策输入。
- `RoleDecisionSection`、draft、ready、learning evidence 和 AI advisory 不能污染 canonical Decision。
- `SettlementResult` 仍由受控 API / service / repository 路径持久化。
- Replay truth hash 只应覆盖正式回放输入，不应包含 AI advisory、learning evidence、billing、entitlement 或 case governance。
- plugin hook 只能返回结构化调整和 trace，不能直接写 `state_true`、score、rank 或 `SettlementResult`。

Provider 只负责组合 repository 访问边界，不拥有业务真值解释权。

## 7. 与 API、simulation-core、shared-contracts 的关系

### API 层

API 层仍然负责认证、授权、状态机、输入校验、审计触发和 runtime wiring。Repository provider 只是 API 层未来可使用的数据访问组合对象。

### simulation-core

`services/simulation-core` 负责市场、运营、财务、评分和插件 hook 计算。Repository provider 不计算 settlement，不执行 plugin hook，也不生成排名。

### shared-contracts

`packages/shared-contracts` 定义 Course、Team、Run、Round、Decision、SettlementResult、Replay、AI advisory 等结构化类型。Repository ports、adapter、facade 和 provider 应使用这些 shared types，避免每层定义一套不一致模型。

## 8. 后续分阶段推进建议

### Phase 1: 文档与 Provider 架构稳定

- 保持 provider 未接入 runtime。
- 用文档记录 ports、adapter、facade、provider 的职责边界。
- 保持 tests 只验证 provider 组合和 adapter 语义，不引入 runtime 行为变化。

### Phase 2: API Use Case 逐步改用 Facade / Provider

- 选择低风险读路径迁移到 facade。
- 每次只迁一小组 route 或 use case。
- 保持 route 状态机和 settlement 行为不变。

### Phase 3: Postgres Repository Adapter

- 实现 Postgres adapter 的 `SimWarRepositoryPorts`。
- 使用与 JSON adapter 相同的契约测试。
- 验证 tenant isolation、idempotency、audit ledger、state snapshot 和 replay report 语义。

### Phase 4: Runtime Wiring

- 在 API runtime 中通过 provider 选择 JSON 或 Postgres ports。
- 保持 runtime 配置显式，避免隐式切换存储。
- 加入 smoke tests，确认 server 启动、核心 route 和 settlement 仍稳定。

### Phase 5: Replay / Shadow Replay 回归验证

- 对 provider / adapter 切换后的 settlement 输入输出做 replay 验证。
- 对 ParameterSet、PluginPackage、ReplayRun、ReplayReport 做回归检查。
- 确认 Replay / Shadow Replay 不写 official truth state。

## 9. 当前 PR 范围

本文档 PR 只记录 repository provider 架构，不修改 TypeScript 源码、routes、server runtime、settlement logic、replay hashing、migrations、package dependencies、Postgres adapter、billing、entitlement、case governance、Playwright、Knip 或 E2E 配置。
