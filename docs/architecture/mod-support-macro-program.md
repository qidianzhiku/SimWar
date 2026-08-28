# MOD 连续六轮 Support 宏任务候选编译器

## 范围

`@simwar/mod-support` 是一个离线、纯确定性的 MOD support lane compiler。它把 R1–R6 的结构化输入编译为 `mod-support-macro.v1` candidate/evidence envelope，供 MAIN 后续做消费者、需求和 Join 复核。它不是新的行业内核、运行时、Registry、ParameterSet writer 或 Model Governance writer。

当前实现只依赖结构化输入和 Node `sha256`，不读取真实企业数据、不调用 Provider、不写 JSON store/数据库/API route，不触碰 SettlementResult、正式评分、排名或 Replay truth hash。所有结果显式带 `provider=OFF`、`runtime_authority=JSON_INTERNAL_ONLY`、`official_truth_write=false`、`settlement_write=false`、`parameter_set_formal_write=false`、`replay_truth_write=false`。

## 六宏状态

| 宏  | State B candidate                              | 最小 MJP fixture | 当前条件                                                                                      |
| --- | ---------------------------------------------- | ---------------: | --------------------------------------------------------------------------------------------- |
| R1  | `FullVerticalModelBindingCandidate`            |               12 | 默认 `JOIN_WITH_LIMITS`；现实资格保持 `NOT_CALIBRATED`，回退 `CORE_ELDERCARE_V1`              |
| R2  | `StakeholderModelResponseShadowCandidate`      |               15 | 五类 stakeholder 信号的 bounded diagnostic delta；冲突、过期、OOD 明确 abstain                |
| R3  | `ExecutiveExperimentManifest`                  |               18 | WANT/CAN/dynamics/finance/portfolio 的可比非官方 variants；不产生正式建议                     |
| R4  | `RobustnessRegimeCandidate`                    |               18 | 只有结构化、exact-bound、time-limited 的 `fresh_need_proof` 才执行；否则 `SKIP_TOMBSTONED`    |
| R5  | `RegionalTransferModelCandidate`               |               16 | Shanghai→synthetic public-safe Hangzhou compatibility envelope；rights/expiry/OOD fail-closed |
| R6  | `RecalibrationDriftRollbackLifecycleCandidate` |               15 | 只有结构化、exact-bound、time-limited 的 `fresh_need_proof` 才执行；否则 `SKIP_TOMBSTONED`    |

条件宏的 tombstone 是能力复用和需求治理证据，不代表 State B 已实现，也不表示 calibrated、eligible、activated 或 production-ready。

## 共享不变量

### Exact binding

所有输入资源都必须是四字段 exact reference：`resource_id`、`resource_type`、三段式 `version`、64 位小写 SHA-256 `content_digest`。`latest`、`current`、`default`、`fallback`、`next`、`unresolved` 和 wildcard 等浮动 token 在编译前拒绝。binding digest 由宏 ID、mission ID 和 exact refs 的稳定 JSON 计算，数组顺序保留，object key 按字典序排序。

### Transformation ledger

每条变换都记录 input、rule、assumption、output、unit、time scope、geography、confidence 和 provenance。默认输入为 synthetic-only，confidence 为 LOW，不把 unsupported claim 提升为事实；`conflicts` 只显式登记，不静默合并。

### Role safety

Teacher 可见 candidate、provenance、conflicts 和 known limits；Admin 只获得治理/绑定/审计字段；Student projection 只暴露 candidate type、bounded diagnostic、confidence 和 known limits。Student projection 不含 `state_true`、市场份额、收入、利润、现金流、评分、排名、结算、raw、secret 或 private 字段。

### Sole-authority firewall

MOD support compiler 的唯一写入者身份是 `MOD_SUPPORT_CANDIDATE_COMPILER`，其 formal writer 是 `NONE`。`candidate_digest` 只证明候选 envelope 自身的确定性，不是正式 Replay truth hash。MAIN 仍需重新验证消费者 exact binding、Need-by、rights、expiry、visibility、non-overwrite 和运行时接入条件。

## 复用与限制

实现复用当前仓库已存在的 W5/M8 exact-reference/qualification 语义、W4/O4 cross-round candidate 语义、D6/M4 transfer/provenance 语义和 MOD-06 model governance 的 provider-off/no-activation 边界；没有复制这些 authority 的 writer 或 runtime。当前实现没有新增前端面或 API route，因为现有 MAIN consumer seam 尚未证明允许该 candidate 进入产品运行路径；这属于明确的 integration limit，而不是伪造 full product completion。

## 接入前置条件

MAIN 接入前至少需要：

1. 重新绑定当前 HEAD/tree 与每个 candidate 的 exact refs 和 digest；
2. 对 R2/R4/R6 复核 fresh Need proof、conflict/uncertainty/lifecycle evidence；
3. 由正式 authority 复核 ParameterSet、ModelVersion、ScenarioPackage、Course/Run 的权限和版本，不接受 MOD 编译器激活；
4. 复跑 schema、role/security、non-write、replay non-overwrite、rights/expiry/OOD 负例；
5. 在独立 MAIN PR 中完成真正消费者绑定。该 PR 不由本包自动创建。
