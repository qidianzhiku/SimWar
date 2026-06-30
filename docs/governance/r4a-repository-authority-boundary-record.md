# R4a Repository Authority Boundary Record

Mission:
`AUD-R4A-REPOSITORY-AUTHORITY-AND-DIRECT-STORE-BOUNDARY-REWORK`

状态：
R4a settlement command path 边界记录。本文件不关闭 #111、#114 或 #115。

## 范围

本次 R4a 变更仅覆盖当前 JSON active runtime 下的 settlement command path：

```text
settlement request
-> authorized and frozen input reads
-> official calculation invocation
-> formal result persistence
-> Round state transition
-> audit append
-> Replay Evidence read/projection
-> response/error projection
```

`services/api/src/simulation.ts` 继续只负责结算计算与
`prepareSettlementOutcome(...)`。正式结算持久化与 Round 状态迁移归属于既有
RepositoryFacade / RepositoryPort / JSON adapter 边界：

```text
API route
-> prepareSettlementOutcome(...)
-> runtime.repositoryProvider.facade.commitSettlementOutcome(...)
-> SettlementOutcomePersistencePort
-> createJsonSettlementOutcomePersistencePort(...)
```

## Direct-Store Boundary 变化

变更前，direct-store boundary manifest 中仍批准了两个
`services/api/src/simulation.ts` 的 settlement target exception：

| 已移除 target exception        | concrete-store access          | 移除原因                                                                                                                            |
| ------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `findExistingSettlementResult` | `store.settlementResults.find` | active route 已通过 `runtime.repositoryProvider.facade.settlements.listSettlementResultsForRound(...)` 读取既有 settlement result。 |
| `writeSettlementResult`        | `store.settlementResults.push` | active route 已通过 `runtime.repositoryProvider.facade.commitSettlementOutcome(...)` 提交 settlement outcome。                      |

变更后，`npm run check:direct-store-boundaries` 报告：

```text
approved-legacy-exception: 57
new-unapproved-runtime-direct-store-access: 0
stale-approved-exception: 0
```

这只是从本次 settlement command target baseline 的 59 个 approved legacy
exception 中减少 2 个，不是全量 `server.ts` direct-store cleanup。

## 保持不变的语义

本次变更不修改：

- `SettlementResult` shape；
- legacy `replay_hash` 的输入、算法、值或含义；
- `manifest_hash`、`truth_hash` 或 canonical evidence digest 语义；
- historical published result、manifest、Replay Evidence 或历史 hash；
- tenant、role、Team membership、permission、RBAC 或 Student visibility 规则；
- JSON active default runtime 状态。

RepositoryFacade 与 JSON adapter 不声明 transaction safety、row locking、
cross-process idempotency、crash recovery、backup/restore 或 durable
settlement。

## 剩余边界

本次 target path 以外仍存在 approved legacy direct-store exceptions，主要位于
legacy `server.ts` route code。这些例外继续由 #114 及其 closeout matrix 管理。

本文件不证明：

- PostgreSQL adapter parity；
- PostgreSQL active runtime；
- R9 PostgreSQL read runtime；
- R10 durable settlement；
- production readiness；
- #111、#114 或 #115 closeout。

后续 R4b / R9 / R10 工作仍需要独立 gate-lift authorization、验证、PR scope
review 与成功 checks。
