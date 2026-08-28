# MOD 连续六轮候选能力编译与验证包

## 范围

`@simwar/mod-support` 是一个离线、纯确定性的 MOD lane capability compiler。它把 R1–R6 的结构化输入编译为 `mod-support-macro.v1` candidate/evidence envelope，并为 R2/R3/R5 执行可复核的影子/候选计算；R1 记录当前 MAIN-SH-FV 能力的复用证明。它不是新的行业内核、运行时、Registry、ParameterSet writer 或 Model Governance writer。

当前实现只依赖结构化输入和 Node `sha256`，不读取真实企业数据、不调用 Provider、不写 JSON store/数据库/API route，不触碰 SettlementResult、正式评分、排名或 Replay truth hash。所有结果显式带 `provider=OFF`、`runtime_authority=JSON_INTERNAL_ONLY`、`official_truth_write=false`、`settlement_write=false`、`parameter_set_formal_write=false`、`replay_truth_write=false`。

## 六宏状态

| 宏  | State B candidate                              | 最小 MJP fixture | 当前条件                                                                                              |
| --- | ---------------------------------------------- | ---------------: | ----------------------------------------------------------------------------------------------------- |
| R1  | `FullVerticalModelBindingCandidate`            |               12 | 复用当前 MAIN-SH-FV 只读组合服务；exact binding 与现实资格仍保持 `NOT_CALIBRATED`                     |
| R2  | `StakeholderModelResponseShadowCandidate`      |               15 | 五类 stakeholder 信号的 bounded diagnostic delta；去重、冲突、过期、OOD 明确 abstain                  |
| R3  | `ExecutiveExperimentManifest`                  |               18 | 五个实验族的可复现 shadow envelope；未知/不可行显式不执行，不产生正式建议                             |
| R4  | `RobustnessRegimeCandidate`                    |               18 | 只有结构化、exact-bound、time-limited 的 `fresh_need_proof` 才执行；否则 `SKIP_TOMBSTONED`            |
| R5  | `RegionalTransferModelCandidate`               |               16 | Shanghai→synthetic public-safe Hangzhou compatibility/version envelope；rights/expiry/OOD fail-closed |
| R6  | `RecalibrationDriftRollbackLifecycleCandidate` |               15 | 只有结构化、exact-bound、time-limited 的 `fresh_need_proof` 才执行；否则 `SKIP_TOMBSTONED`            |

条件宏的 tombstone 是能力复用和需求治理证据，不代表 State B 已实现，也不表示 calibrated、eligible、activated 或 production-ready。

## 共享不变量

### Exact binding

所有输入资源都必须是四字段 exact reference：`resource_id`、`resource_type`、三段式 `version`、64 位小写 SHA-256 `content_digest`。`latest`、`current`、`default`、`fallback`、`next`、`unresolved` 和 wildcard 等浮动 token 在编译前拒绝。binding digest 由宏 ID、mission ID 和 exact refs 的稳定 JSON 计算，数组顺序保留，object key 按字典序排序。

### Transformation ledger

每条变换都记录 input、rule、assumption、output、unit、time scope、geography、confidence 和 provenance。默认输入为 synthetic-only，confidence 为 LOW，不把 unsupported claim 提升为事实；`conflicts` 只显式登记，不静默合并。

### MJP fixture evidence

每个结果的 `mjp.fixtures` 都保存结构化 fixture input、fixture result 及两者的 SHA-256。fixture result 必须包含 `mod-mjp-runner.v1` 的执行证据，并由编译前校验按相同 input 重放；篡改执行标记、digest 或输出会拒绝整个 request。只有可复核的 input/result pairs 达到该宏门槛时才允许 `mjp.status=PASS`；不足时结果为 `EVIDENCE_INSUFFICIENT`/`SKIP`，不会用阈值或占位 ID 冒充执行证据。该门禁只代表本地确定性 fixture 验证，不等同于正式校准。

### Role safety

Teacher 可见 candidate、provenance、conflicts 和 known limits；Admin 只获得治理/绑定/审计字段；Student projection 只暴露 candidate type、bounded diagnostic、confidence 和 known limits。Student projection 不含 `state_true`、市场份额、收入、利润、现金流、评分、排名、结算、raw、secret 或 private 字段。

### Sole-authority firewall

MOD support compiler 的唯一写入者身份是 `MOD_SUPPORT_CANDIDATE_COMPILER`，其 formal writer 是 `NONE`。`candidate_digest` 只证明候选 envelope 自身的确定性，不是正式 Replay truth hash。MAIN 仍需重新验证消费者 exact binding、Need-by、rights、expiry、visibility、non-overwrite 和运行时接入条件。

Evidence assembler 只允许写入专用的新目录：新目录必须使用 `simwar-mod-support-evidence-*` 命名并写入精确 ownership marker；任何既有目录（即使带 marker）都拒绝复用。仓库根目录、仓库内路径、文件系统根、文件和未拥有目录均拒绝，assembler 不执行递归删除。

## 具体能力与复用边界

实现复用当前仓库已存在的 MAIN-SH-FV 只读组合服务、W5/M8 exact-reference/qualification 语义、W4/O4 cross-round candidate 语义、D6/M4 transfer/provenance 语义和 MOD-06 model governance 的 provider-off/no-activation 边界；没有复制这些 authority 的 writer 或 runtime。R2 仅生成去重后的诊断影子响应，R3 仅生成五实验族的非官方比较 envelope，R5 仅生成 public-safe 区域/版本兼容性 envelope。当前主线没有被证明存在 STK、ESL、RT 的可消费运行时 seam，所以这些输出保持 lane-local candidate/diagnostic，不声称已经接入产品运行路径；这是能力边界，而不是把候选包装成正式 Truth。

R1 的 `consumer_evidence` 指向当前已存在的 `ShanghaiFullVerticalService.requireExactBinding` 与 `isShanghaiFullVerticalBound` 只读守卫；R4/R6 在没有当前结构化 fresh Need proof 时是显式 capability tombstone。所有 MJP fixture 都是 synthetic-only、可重放的结构化执行证据；所有输出仍不具备 `MODEL_CALIBRATED`、official recommendation 或 activation 含义。

## 接入前置条件

MAIN 接入前至少需要：

1. 重新绑定当前 HEAD/tree 与每个 candidate 的 exact refs 和 digest；
2. 对 R2/R4/R6 复核 fresh Need proof、conflict/uncertainty/lifecycle evidence；
3. 由正式 authority 复核 ParameterSet、ModelVersion、ScenarioPackage、Course/Run 的权限和版本，不接受 MOD 编译器激活；
4. 复跑 schema、role/security、non-write、replay non-overwrite、rights/expiry/OOD 负例；
5. 在独立 MAIN PR 中完成真正消费者绑定。该 PR 不由本包自动创建。
