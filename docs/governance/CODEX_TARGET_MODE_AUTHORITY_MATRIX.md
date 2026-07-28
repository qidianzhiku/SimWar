# SimWar 主线牵引有限并行目标任务授权矩阵 V1.0

**Document ID:** `SIMWAR-CODEX-TARGET-AUTH-MATRIX-V1.0`
**建议仓库路径：** `docs/governance/CODEX_TARGET_MODE_AUTHORITY_MATRIX.md`
**文档状态：** `READY_FOR_OWNER_APPROVAL`
**适用模式：** `MAINLINE_LED_BOUNDED_PARALLEL_TARGET_MODE`
**适用对象：** Project Owner、Chief Architect、Product Owner、Engineering Lead、Model Owner、Scenario Owner、Course Owner、Learning Owner、Replay/QA Owner、Platform Owner、Codex/CodexPro
**政策解释：** 本文按“只有最高风险等级 T4 才需要人工复核”执行。T0—T3 使用自动化证据门、双重机器审查、知识图谱路径选择和串行 Closure；T4 使用人工复核。
**Current Authorization Register：** `NOT_ASSESSED`。本文定义长期规范，不直接授权任何当前 Mission。

---

## 1. Executive Authorization Decision

### 1.1 正式决策

SimWar 目标任务模式采用以下授权模型：

```text
唯一产品 Mainline
+ 一个共享 Support Code Slot
+ 0–1 Industry / Docs / Read-only Slot
+ 一个 Serial Closure Lane
+ 每主机一个 Heavy Validation Slot
```

默认授权原则：

1. **T0—T3 不要求人工复核。**
   Codex可在有效目标任务授权实例、资源锁和机器门禁内连续完成：事实读取、路径选择、worktree、TDD、代码修改、测试、commit、push、PR、PR内返工、exact-head机器复核、ordinary merge及post-merge closure。

2. **只有T4要求人工复核。**
   T4涵盖：Truth或正式Authority变更、Settlement/Score/Rank、财务核心算法、PostgreSQL active authority、migration、durable settlement、recovery、真实数据、外部Provider正式激活、Pilot、Production、Billing和收费。

3. **重要Gate或任务选择存在歧义时，必须先调用Graphify MCP与CodeGraph MCP。**
   输出仓库知识图谱、Authority/Dependency/Runtime/Test关系图、候选路径评分和资源锁建议，再选择最优开发路径。

4. **知识图谱不是运行时证明。**
   Graphify/CodeGraph用于缩小搜索空间、识别依赖和选择路径；最终通过源代码、RED/GREEN测试、集成测试、E2E、CI、CodeQL、exact-head和fresh clone形成工程证明。

5. **开发可以有限并行，正式主线状态转换必须串行。**
   任一时点最多一个PR进入`READY_FOR_CLOSURE`、`MERGE_EXECUTION`或`POST_MERGE_CLOSURE`。

6. **任务完成后停止。**
   Codex可以输出经知识图谱排序的下一目标建议，但不得自动创建下一目标分支或开始mutation。

### 1.2 目标

本矩阵解决两类历史问题：

- 避免早期“每一步都等待签署、重复读取相同门禁、治理正确但工程停滞”；
- 避免目标模式扩大为“Codex自动修改所有Authority和高风险运行时”。

本矩阵追求：

```text
高自治工程执行
+ 低人工触点
+ 单一Authority
+ 可复现证据
+ 串行主线收口
+ T4人工风险控制
```

---

## 2. Source Hierarchy and Current Reality Policy

### 2.1 证据优先级

```text
Authenticated GitHub / Runtime Facts
> Current Source and Repeatable Tests
> Graphify / CodeGraph Current Repository Graph
> Fresh Sealed Evidence
> Approved ADR / Governance
> L1 Definition of Done
> V3.0 Roadmap
> Mainline-led Bounded Parallel Plan
> Historical Mission Reports
> Recommendation
```

### 2.2 Current Reality规则

每个Portfolio Cycle、目标任务和Closure开始前，必须重新读取：

- default branch；
- current master SHA；
- current open PR；
- active branches / worktrees；
- current WIP；
- Ready-for-Closure队列；
- current Resource Lock Registry；
- CI / CodeQL；
- branch protection；
- runtime authority；
- active provider；
- Known Limits；
- unresolved P0/P1；
- L1 / L1+ / L2 / L3当前阶段。

历史文档中的SHA、PR状态和能力判断仅作为背景，不得直接写成当前PASS。

### 2.3 Freshness

| 事实                       |                      默认有效期 | 立即失效条件                           |
| -------------------------- | ------------------------------: | -------------------------------------- |
| exact base/head/files      |                          10分钟 | push、rebase、merge、changed files变化 |
| CI / CodeQL                |                      与head绑定 | head变化                               |
| open PR / WIP / locks      |                          30分钟 | 新PR、关闭PR、Owner重分配              |
| branch protection          |                          24小时 | ruleset变化                            |
| issue状态                  |                           4小时 | issue event                            |
| Graphify / CodeGraph graph |                 1次master merge | source、index scope或tracked files变化 |
| sealed local evidence      | source+lockfile+environment绑定 | 任一输入变化                           |
| T0—T3任务授权              |           14天或2次master merge | scope、risk、lock、base变化            |
| T4人工授权                 |            exact scope/head绑定 | 任一字段变化                           |

---

## 3. Long-Term Successful Engineering Practices

以下经验为目标模式的强制继承规则。

### 3.1 Value Chain Bundle优先

最高执行单元是**可识别系统状态转换**，而不是Gate节点、报告章节或命令清单。

一个目标任务必须只有：

```text
1 Primary Outcome
1 Track
1 Mutable Authority
1 Exact Allowlist
1 Evidence Root
1 Stop Condition
```

通常使用1—3个PR完成一个Value Chain Bundle；不得将同一状态转换拆成大量独立治理任务。

### 3.2 Current Reality First

任何开发判断必须从当前仓库、GitHub和运行时事实开始，不能继承过期Mission结论。

### 3.3 治理只阻断高风险动作

门禁必须限制：

- T4不可逆动作；
- 双Authority；-越权Truth；-真实数据；-正式runtime切换；
- Pilot / Production。

门禁不得在没有新事实时阻断：

-只读分析；-测试准备；-独立worktree；

- RED测试；-不触及Authority的工程实现；
  -PR准备。

### 3.4 TDD与失败分类

所有T1—T4代码任务使用：

```text
RED
→ Confirm Failure Matches Intended Gap
→ Minimal GREEN
→ Affected Validation
→ Full Closure Validation
```

失败必须分类为：

- `REGRESSION`；
- `BASELINE_DEFECT`；
- `ENVIRONMENT_FAILURE`；
- `INFRASTRUCTURE_BLOCKED`；
- `NOT_PROVEN_FLAKE`。

禁止无根因`run-until-pass`。

### 3.5 Exact-Head与Fresh Clone

每个合并状态必须完成：

```text
exact base/head/files
→ remote CI / CodeQL
→ scope / boundary review
→ ordinary merge
→ merge receipt
→ fresh clone
→ install / targeted / full / build / browser
→ clean and zero residue
```

### 3.6 CI失败是质量信号

CI或浏览器失败不得直接重跑。必须先：

1.读取失败日志；2.定位首个根因；3.区分当前PR回归、基线缺陷或环境失败；4.只做最小修复；5.保留失败与修复证据。

### 3.7 有限并行与单一Closure

成功结构：

```text
1 Mainline
+ 1 Recovery/Model/Stage4B shared code slot
+ 0–1 docs/read-only slot
+ 1 serial Closure
```

支持线不得成为第二产品主线；Recovery关闭后立即释放WIP。

### 3.8 Graphify / CodeGraph事实驱动

在模块齐全但接线不清、多个路径都合理、Authority边界复杂或进入重要Gate时，先生成知识图谱再选择路径，避免：

-重复建设已有能力；-只加强合同而遗漏runtime；-前端先于backend authority；-绕过正式writer；-修改错误的composition root；-重复Registry、Store或Router。

### 3.9 目标完成后停止

完成当前Primary Outcome、合并、fresh clone和Memory Delta后停止。只输出下一目标推荐，不自动启动下一任务。

---

## 4. Mainline-Led Bounded Parallel Topology

### 4.1 WIP Lane

| Lane                  | 默认WIP | 目标                                                      | 优先级                     | 禁止                      |
| --------------------- | ------: | --------------------------------------------------------- | -------------------------- | ------------------------- |
| `MAINLINE`            |       1 | 用户可操作状态和核心产品状态转换                          | 最高                       | 纯ADR、纯研究长期占用     |
| `SUPPORT_CODE`        |   1共享 | Recovery、Program M、Stage 4B Shadow                      | blocker recovery > M > STK | 同时启动两条支持代码线    |
| `INDUSTRY_DOCS`       |     0–1 | Context Pack、Requirement、Traceability、synthetic assets | 支持                       | 修改generic Core          |
| `DISCOVERY_READ_ONLY` |       1 | F0、TFR、Graph、risk map                                  | 支持                       | 产品mutation、heavy suite |
| `SERIAL_CLOSURE`      |       1 | exact-head、merge、post-merge                             | Mainline优先               | 并行merge                 |
| `HEAVY_VALIDATION`    |  1/host | full test/build/browser/security/Join                     | 按Closure队列              | 同主机并行heavy suite     |

### 4.2 冲突优先级

```text
Mainline > Model
Mainline > Industry
Direct Mainline Blocker Recovery > Mainline temporarily
Mainline > Stage4B
Program M and Stage4B share one code slot
Program F owns DB / migration / recovery
Closure serializes all formal master transitions
```

### 4.3 WIP扩大

从2条Active Code Branch扩大到3条，属于T4治理决策，需人工复核。必须连续两个周期满足：

- Parallel Overlap ≥30%；
- Lead-time Reduction ≥20%；
- File Conflict <5%；
- Join Rework <10%；
- Boundary Breach =0；
- Cleanup Residue =0；
- Closure Queue ≤1；
- Owner Touch ≤2 / VCB；-额外Independent Reviewer容量已证明。

---

## 5. Risk Tier and Review Mode

### 5.1 风险等级总表

| Tier | 典型范围                                                                                                                                          | Review Mode                        | 人工复核 | Merge                            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------- | -------------------------------- |
| `T0` | docs、read-only、Current Reality、Graph、Context Pack                                                                                             | `AUTO_REVIEW`                      | 否       | 自动或无需merge                  |
| `T1` | tests、fixtures、helpers、internal tooling、baseline hygiene                                                                                      | `AUTO_REVIEW`                      | 否       | 自动exact-head closure           |
| `T2` | contracts、schemas、DTO、domain model、read projections、non-authority BFF                                                                        | `ENHANCED_AUTO_REVIEW`             | 否       | 自动exact-head closure           |
| `T3` | runtime composition、tenant/visibility、product write、Run lifecycle、formal binding、Replay integration、UI/BFF链                                | `GRAPH_GATED_ENHANCED_AUTO_REVIEW` | 否       | 自动exact-head one-attempt merge |
| `T4` | Truth/Authority、Settlement/Score/Rank、财务核心、PG active、migration、durable、recovery、real data、provider active、Pilot、Production、billing | `HUMAN_REVIEW_REQUIRED`            | **是**   | 人工exact-head批准后执行         |

### 5.2 T0

包括：

-读取仓库、GitHub、Issue、PR、CI、CodeQL；
-Graphify与CodeGraph；-架构地图；
-Context Pack；
-ADR草案；
-Evidence整理；-只读差距分析。

授权：`AUTO_READ_ALLOWED`。

### 5.3 T1

包括：

-测试；
-fixture；
-helper；-内部验证脚本；-格式修复；-不改变运行时行为的基线卫生；-不改变权限的repo-native工具。

要求：targeted、affected suite、lint/typecheck、CI（如有PR）。

### 5.4 T2

包括：

- shared contract；
- JSON Schema；
- OpenAPI；
- domain type；
- BFF DTO；
- compiler contract；
- immutable read model；-不改变sole writer的产品投影。

要求：RED/GREEN、contract parity、unit、build、boundary、negative tests。

触及shared lifecycle时需要自动资源锁，不需要人工。

### 5.5 T3

包括：

- runtime composition；
- dependency wiring；
- tenant / role / team enforcement；
- Student visibility；
- Teacher/Student/Admin产品写路径；
- Run create/open/lock/publish；
- formal Run binding；
- Replay non-overwrite integration；-默认JSON runtime内的接线；-不改变正式Authority的Product Surface。

要求：

- Graph Gate；
- full suite；
- integration；
- E2E / Playwright；
- security negative；
- Student private field negative；
- exact-head自动双审查；
- one-attempt ordinary merge；
- post-merge fresh clone。

### 5.6 T4

包括：

-新增或改变sole writer；

- Truth-L1—L3算法或writer；
- SettlementResult / Score / Rank；-财务结算、计分和经营结果公式；
- settlement业务幂等与并发Authority；
- official Golden语义重置；
- PostgreSQL active authority；
- migration；
- durable settlement；
- recovery / backup / restore；
- external provider active；-真实个人、企业或客户数据；
- Stage 4B Limited Active；
- Pilot；
- Production；
- billing / entitlement / paid use；-分支保护或安全权限降级；
  -WIP扩大。

T4需要人工复核，采用最多两个触点：

1. `T4_SCOPE_AND_ROLLBACK_APPROVAL`：mutation前；
2. `T4_EXACT_HEAD_MERGE_APPROVAL`：merge前。

---

## 6. Authorization Status Model

| 状态                                  | 含义                             |       Mutation | Commit/Push/PR |  Merge | 人工 |
| ------------------------------------- | -------------------------------- | -------------: | -------------: | -----: | ---: |
| `AUTO_READ_ALLOWED`                   | 默认只读                         |             否 |             否 |     否 |   否 |
| `AUTO_PATH_SELECTION_ACTIVE`          | Graphify/CodeGraph路径选择中     |             否 |             否 |     否 |   否 |
| `TRACK_START_AUTO_AUTHORIZED`         | T0—T3满足WIP/锁后自动启动        |             是 |             是 |     否 |   否 |
| `BUNDLE_EXECUTION_AUTO_AUTHORIZED`    | T0—T3连续工程执行                |             是 |             是 |     否 |   否 |
| `PR_REWORK_AUTO_AUTHORIZED`           | 当前PR最小回归修复               |             是 |             是 |     否 |   否 |
| `EXACT_HEAD_AUTO_REVIEW`              | 自动双审查与范围核验             |             否 |             否 | 待门禁 |   否 |
| `AUTO_MERGE_AUTHORIZED`               | T0—T3 one-attempt ordinary merge |             否 |             否 |     是 |   否 |
| `POST_MERGE_AUTO_CLOSURE`             | fresh clone与收口                | 仅证据/cleanup |             否 | 已完成 |   否 |
| `SERIAL_RESOURCE_LOCK`                | 单一writer持锁                   |    仅持锁Track |             是 | 按队列 |   否 |
| `GRAPH_GATE_REQUIRED`                 | 必须先生成知识图谱               |             否 |             否 |     否 |   否 |
| `READ_ONLY_DOWNGRADED`                | 工具/锁不足时降级                |             否 |             否 |     否 |   否 |
| `T4_HUMAN_SCOPE_REVIEW_REQUIRED`      | T4 mutation前人工复核            |             否 |             否 |     否 |   是 |
| `T4_HUMAN_EXACT_HEAD_REVIEW_REQUIRED` | T4 merge前人工复核               |             否 |             否 |     否 |   是 |
| `EXPIRED_REAUTH_REQUIRED`             | 授权事实过期                     |             否 |             否 |     否 | T4是 |
| `BLOCKED`                             | 依赖、事实或锁不足               |             否 |             否 |     否 | 仅T4 |
| `CANCELLED`                           | 任务取消                         |   cleanup only |             否 |     否 |   否 |
| `COMPLETED_AND_CLOSED`                | merge/fresh clone/cleanup完成    |             否 |             否 | 已完成 |   否 |

---

## 7. Knowledge Graph Gate: Graphify MCP + CodeGraph MCP

### 7.1 强制触发条件

出现以下任一条件，必须调用**Graphify MCP和CodeGraph MCP**：

1. 两个或以上候选开发路径；2.需求描述含“完整”“收口”“接入”“激活”“统一”“重构”等模糊范围词；3.进入Program、VCB或阶段Gate；4.触及shared contracts、Authority、Run、Replay、Golden、tenant、Student visibility；5.触及composition root、runtime provider或正式binding；6.进入T3任务；7.进入T4人工复核包；8.发现现有代码与规划描述不一致；9.准备跨Track Join；
2. exact-head前发现changed files超出预测；11.出现重复Registry、Store、Router、Adapter或Writer风险；12.需要在“继续当前PR、Recovery、另开Bundle、延后”之间选择。

### 7.2 图谱必须包含的节点

- Program / VCB / Mission；
- domains；
- services；
- contracts / schemas / OpenAPI；
- Authority / sole writer；
- adapters / providers；
- composition roots；
- BFF / UI；
- routes；
- tests / fixtures；
- Golden / Replay；
- PR / commit；
- resource locks；
- Known Limits；
- gate / evidence；
- files / modules；
- runtime modes。

### 7.3 图谱必须包含的边

- `WRITES`；
- `READS`；
- `BINDS_EXACT_REF`；
- `CALLS`；
- `IMPLEMENTS`；
- `PROJECTS_TO`；
- `TESTED_BY`；
- `DEPENDS_ON`；
- `BLOCKED_BY`；
- `SHARES_LOCK_WITH`；
- `MUST_PRECEDE`；
- `MAY_PARALLEL_WITH`；
- `FORBIDDEN_TO_WRITE`；
- `INVALIDATES`；
- `MERGED_BY`；
- `EVIDENCED_BY`。

### 7.4 必须输出的Graph Evidence Pack

建议路径：

```text
artifacts/knowledge-graph/<mission-id>/
```

必须包含：

1. `repository-fact-graph.json`；
2. `repository-fact-graph.mmd`；
3. `authority-writer-map.md`；
4. `runtime-call-path.md`；
5. `candidate-paths.md`；
6. `route-scorecard.json`；
7. `selected-path.md`；
8. `rejected-paths.md`；
9. `resource-lock-manifest.json`；
10. `graph-query-log.md`；
11. `graph-freshness.json`；
12. `explicit-non-proofs.md`。

### 7.5 路径评分

候选路径总分：

| 因素                                | 权重 |
| ----------------------------------- | ---: |
| Product Surface Gain                |  25% |
| L1/L1+ blocker reduction            |  20% |
| Critical-path shortening            |  15% |
| Boundary safety                     |  15% |
| File/Authority independence         |  10% |
| Evidence reuse                      |  10% |
| Implementation cost / scope economy |   5% |

选择规则：

```text
Selected Path =
highest score
AND no Authority collision
AND no forbidden writer
AND required locks available
AND rollback/cancellation route exists
```

若Graphify与CodeGraph结论不同：

1.比较索引范围和freshness；2.以current source精确读取核验冲突节点；3.重建局部子图；4.仍不一致时选择更窄、可取消、Authority更少的路径；
5.T0—T3降级为只读或窄路径，不触发人工复核；
6.T4将差异纳入人工复核包。

### 7.6 Knowledge Graph Decision Record

```yaml
graph_gate_id:
mission_id:
trigger:
graphify_index:
codegraph_index:
source_anchor:
candidate_paths:
selected_path:
selection_score:
authority_writers:
resource_locks:
required_tests:
rejected_paths:
confidence:
unknowns:
freshness:
```

---

## 8. Automated Review Architecture for T0—T3

### 8.1 双重机器审查

T2—T3 exact-head至少执行两个相互独立的自动审查视角：

**Review A — Source / Architecture**

- changed-file scope；
- Authority writer；
- imports和bypass；
- runtime path；
- no second Registry/Store；
- no forbidden dependency；
- Graph path一致性。

**Review B — Behavior / Evidence**

- RED/GREEN；
- contract；
- negative；
- integration；
- E2E；
- Student/Tenant；
- Replay/non-overwrite；
- CI/CodeQL；
- Known Limits；
- fresh clone plan。

两个Review均PASS才可自动merge。

### 8.2 自动合并条件

T0—T3自动ordinary merge必须同时满足：

- exact base/head/files frozen；
- Primary Outcome未漂移；
- changed files全部在allowlist或已由自动策略批准；
- Resource Lock无冲突；
- Graph Gate（如适用）PASS；
- targeted + required full tests PASS；
- CI PASS；
- CodeQL PASS；
- review threads无unresolved blocking；
- branch protection未被绕过；
- no Truth/Authority breach；
- Student/Tenant negative=0；
- security critical=0；
- Known Limits未被删除或夸大；
- one-attempt merge budget=1；
- post-merge closure资源可用。

### 8.3 自动停止而非人工升级

T0—T3无法满足门禁时：

-不会自动升级为“请求人工批准绕过”；-状态转为`BLOCKED`、`READ_ONLY_DOWNGRADED`或`EXPIRED_REAUTH_REQUIRED`；-输出原因和恢复条件；-只有任务重新分类为T4时才进入人工复核。

---

## 9. Mission Lifecycle Authorization Matrix

| 阶段               | T0         | T1         | T2          | T3                 | T4                 |
| ------------------ | ---------- | ---------- | ----------- | ------------------ | ------------------ |
| Current Reality    | 自动       | 自动       | 自动        | 自动               | 自动               |
| Graph Gate         | 按需       | 按需       | 共享/模糊时 | **强制**           | **强制**           |
| Track Start        | 自动       | 自动       | 自动        | 自动               | 人工Scope批准      |
| RED                | N/A        | 自动       | 自动        | 自动               | 批准后自动         |
| Implementation     | 无mutation | 自动       | 自动        | 自动               | 批准范围内         |
| Commit / Push / PR | docs可自动 | 自动       | 自动        | 自动               | 批准范围内         |
| PR Rework          | 自动       | 自动       | 自动        | 自动               | 不扩大范围时自动   |
| Exact-Head Review  | 自动       | 自动       | 双机器      | 双机器+Graph delta | 人工               |
| Ordinary Merge     | 自动       | 自动       | 自动        | 自动one-attempt    | 人工批准           |
| Post-Merge         | 自动       | 自动       | 自动        | 自动               | 自动执行已批准范围 |
| Next Goal          | 推荐后停止 | 推荐后停止 | 推荐后停止  | Graph推荐后停止    | 人工重新选择       |

---

## 10. Action-Level Authorization Matrix

### 10.1 Facts, Graph and Environment

| ID      | Action                              |         Tier | Default             | Required Gate            |   Human |
| ------- | ----------------------------------- | -----------: | ------------------- | ------------------------ | ------: |
| ACT-001 | 读取GitHub/仓库/CI/CodeQL/Issue/PR  |           T0 | `AUTO_READ_ALLOWED` | Current Reality          |      否 |
| ACT-002 | Graphify MCP索引/查询               |           T0 | 自动                | Graph freshness          |      否 |
| ACT-003 | CodeGraph MCP索引/查询              |           T0 | 自动                | Graph freshness          |      否 |
| ACT-004 | 输出知识图谱和候选路径              |           T0 | 自动                | Graph Evidence Pack      |      否 |
| ACT-005 | 创建隔离worktree/temp/Evidence Root |        T0/T1 | 自动                | WIP+path isolation       |      否 |
| ACT-006 | 创建T0—T3 branch                    |           T1 | 自动                | Track Auto Authorization |      否 |
| ACT-007 | 安装lockfile已有依赖                |           T0 | 自动                | exact lockfile           |      否 |
| ACT-008 | 修改受保护主工作区                  | T4/Forbidden | `FORBIDDEN`         | 无                       | 是/禁止 |
| ACT-009 | 两个heavy suite同host并行           |    Forbidden | `FORBIDDEN`         | 无                       |      否 |

### 10.2 Tests and Tooling

| ID      | Action                             |      Tier | Default            | Required Gate              | Human |
| ------- | ---------------------------------- | --------: | ------------------ | -------------------------- | ----: |
| ACT-010 | 修改测试/fixture/helper            |        T1 | 自动               | affected tests             |    否 |
| ACT-011 | repo-native验证脚本                |        T1 | 自动               | no runtime behavior change |    否 |
| ACT-012 | baseline hygiene                   |        T1 | 自动               | prove baseline scope       |    否 |
| ACT-013 | CI workflow无权限扩大修改          |        T3 | 自动增强审查       | workflow lock + security   |    否 |
| ACT-014 | CI权限/secret/write capability扩大 |        T4 | 人工               | security/rollback          |    是 |
| ACT-015 | rerun失败job                       |     T1/T3 | 根因分类后最多一次 | failure classifier         |    否 |
| ACT-016 | run-until-pass                     | Forbidden | `FORBIDDEN`        | 无                         |    否 |

### 10.3 Dependency and Supply Chain

| ID      | Action                                             |       Tier | Default      | Required Gate           | Human |
| ------- | -------------------------------------------------- | ---------: | ------------ | ----------------------- | ----: |
| ACT-017 | 新增dev-only依赖                                   |         T2 | 自动         | TFR/license/CVE/exit    |    否 |
| ACT-018 | 新增普通runtime依赖                                |         T3 | 自动增强审查 | Graph+TFR+SBOM+fallback |    否 |
| ACT-019 | 新增影响Truth/Settlement/PG/security authority依赖 |         T4 | 人工         | ADR+rollback+SBOM       |    是 |
| ACT-020 | 修改lockfile                                       | 随依赖Tier | 自动或人工   | exact diff+TFR          |  仅T4 |

### 10.4 Contracts and Product Surfaces

| ID      | Action                             |  Tier | Default      | Required Gate                      | Human |
| ------- | ---------------------------------- | ----: | ------------ | ---------------------------------- | ----: |
| ACT-021 | shared contract/schema/OpenAPI/DTO |    T2 | 自动         | single-writer lock+contract parity |    否 |
| ACT-022 | domain model但不改变Authority      |    T2 | 自动         | RED/GREEN+boundary                 |    否 |
| ACT-023 | Teacher UI/BFF read/write surface  | T2/T3 | 自动         | Product Surface+Playwright         |    否 |
| ACT-024 | Student UI/BFF                     |    T3 | 自动增强审查 | privacy/zero-private-field         |    否 |
| ACT-025 | Admin UI/BFF                       |    T3 | 自动增强审查 | tenant/authority negative          |    否 |
| ACT-026 | Role/Team/Tenant enforcement       |    T3 | 自动增强审查 | Graph+E2E+security                 |    否 |
| ACT-027 | Learning Evidence draft/projection | T2/T3 | 自动         | dual-ledger non-overwrite          |    否 |
| ACT-028 | 正式Learning grade Authority       |    T4 | 人工         | Authority+privacy+appeal           |    是 |

### 10.5 Run, Replay and Golden

| ID      | Action                                       |  Tier | Default      | Required Gate                       | Human |
| ------- | -------------------------------------------- | ----: | ------------ | ----------------------------------- | ----: |
| ACT-029 | Run create/open/lock/publish lifecycle       |    T3 | 自动         | Graph+state machine+E2E             |    否 |
| ACT-030 | Formal Run exact binding/runtime composition |    T3 | 自动         | Graph mandatory+no second authority |    否 |
| ACT-031 | Replay integration/non-overwrite             |    T3 | 自动         | official unchanged+locked inputs    |    否 |
| ACT-032 | Replay验证                                   | T2/T3 | 自动         | digest reproducibility              |    否 |
| ACT-033 | 修改official Golden fixture但不改变语义      |    T3 | 自动增强审查 | single owner+exact parity           |    否 |
| ACT-034 | 重定义official Golden语义/expected Truth     |    T4 | 人工         | Truth/settlement impact             |    是 |
| ACT-035 | 历史Run迁移或重绑                            |    T4 | 人工         | non-overwrite+rollback              |    是 |

### 10.6 Authority, Truth, Settlement and Finance

| ID      | Action                                 |  Tier | Default | Required Gate                   | Human |
| ------- | -------------------------------------- | ----: | ------- | ------------------------------- | ----: |
| ACT-036 | 读取Authority projection               | T0/T2 | 自动    | privacy                         |    否 |
| ACT-037 | 新增非正式read facade                  |    T2 | 自动    | no second authority             |    否 |
| ACT-038 | Authority lifecycle或sole writer变化   |    T4 | 人工    | ADR+writer map+rollback         |    是 |
| ACT-039 | Truth-L1/L2/L3算法或writer             |    T4 | 人工    | model/Truth differential        |    是 |
| ACT-040 | SettlementResult/Score/Rank            |    T4 | 人工    | idempotency+concurrency+appeal  |    是 |
| ACT-041 | 财务结算、收入、成本、现金流、评分公式 |    T4 | 人工    | numerical golden+finance review |    是 |
| ACT-042 | settlement业务幂等/并发Authority       |    T4 | 人工    | concurrent tests+atomicity      |    是 |

### 10.7 PostgreSQL, Durable and Recovery

| ID      | Action                      | Tier | Default | Required Gate                   | Human |
| ------- | --------------------------- | ---: | ------- | ------------------------------- | ----: |
| ACT-043 | PG read-only discovery      |   T0 | 自动    | no SQL mutation                 |    否 |
| ACT-044 | inactive PG adapter/parity  |   T3 | 自动    | no active switch+Testcontainers |    否 |
| ACT-045 | provider opt-in但默认仍JSON |   T3 | 自动    | explicit mode+fail closed       |    否 |
| ACT-046 | PG active authority         |   T4 | 人工    | ADR+parity+rollback             |    是 |
| ACT-047 | migration                   |   T4 | 人工    | dry run+rollback+backup         |    是 |
| ACT-048 | durable event/snapshot      |   T4 | 人工    | retention+replay                |    是 |
| ACT-049 | durable settlement          |   T4 | 人工    | atomicity+idempotency           |    是 |
| ACT-050 | recovery/backup/restore     |   T4 | 人工    | RPO/RTO+drill                   |    是 |

### 10.8 AI, Provider and Stage 4B

| ID      | Action                            |      Tier | Default     | Required Gate                               | Human |
| ------- | --------------------------------- | --------: | ----------- | ------------------------------------------- | ----: |
| ACT-051 | deterministic/mock provider       |        T2 | 自动        | no external data                            |    否 |
| ACT-052 | external provider client inactive |        T3 | 自动        | TFR+redaction+fallback                      |    否 |
| ACT-053 | external provider active          |        T4 | 人工        | privacy+cost+rollback                       |    是 |
| ACT-054 | Stage 4B docs/Context Pack        |        T0 | 自动        | Current Reality                             |    否 |
| ACT-055 | Stage 4B contracts/fixtures       |        T2 | 自动        | STK single-writer lock                      |    否 |
| ACT-056 | Stage 4B SHADOW                   |        T3 | 自动        | Graph+plane-off parity+zero official impact |    否 |
| ACT-057 | Stage 4B LIMITED_ACTIVE           |        T4 | 人工        | STK-J0—J6+F/G                               |    是 |
| ACT-058 | Agent/AI写Truth/Settlement/Score  | Forbidden | `FORBIDDEN` | 无                                          |  禁止 |
| ACT-059 | official Replay重新调用provider   | Forbidden | `FORBIDDEN` | 无                                          |  禁止 |

### 10.9 Data, Pilot, Production and Commercial

| ID      | Action                        |  Tier | Default | Required Gate                  | Human |
| ------- | ----------------------------- | ----: | ------- | ------------------------------ | ----: |
| ACT-060 | synthetic/anonymized fixtures | T1/T2 | 自动    | classification                 |    否 |
| ACT-061 | 真实个人/企业/客户数据        |    T4 | 人工    | Data/Privacy/DLP/retention     |    是 |
| ACT-062 | Controlled Pilot              |    T4 | 人工    | staging/recovery/support/terms |    是 |
| ACT-063 | Production                    |    T4 | 人工    | security/SLO/DR/rollback       |    是 |
| ACT-064 | Billing/entitlement/paid use  |    T4 | 人工    | finance/legal/commercial       |    是 |
| ACT-065 | Public industry release       |    T4 | 人工    | product/data/commercial gate   |    是 |

### 10.10 Git, PR and Closure

| ID      | Action                      |       Tier | Default                 | Required Gate         | Human |
| ------- | --------------------------- | ---------: | ----------------------- | --------------------- | ----: |
| ACT-066 | commit/push/create PR       |      T0—T3 | 自动                    | scope+tests           |    否 |
| ACT-067 | PR内最小rework              |      T1—T3 | 自动                    | regression classifier |    否 |
| ACT-068 | exact-head自动审查          |      T0—T3 | 自动                    | dual machine review   |    否 |
| ACT-069 | ordinary merge              |      T0—T3 | 自动one-attempt         | exact-head all green  |    否 |
| ACT-070 | ordinary merge              |         T4 | 人工批准                | exact-head T4 pack    |    是 |
| ACT-071 | force/admin bypass          |  Forbidden | `FORBIDDEN`             | 无                    |  禁止 |
| ACT-072 | squash/rebase改变已审查head | T4/Blocked | 重新评估                | new exact head        |    是 |
| ACT-073 | post-merge fresh clone      |      T0—T4 | 自动                    | serial closure        |    否 |
| ACT-074 | 关闭T0—T3 Issue             |       自动 | evidence closure        | 否                    |
| ACT-075 | 关闭T4 Issue                |         T4 | 人工                    | T4 acceptance         |    是 |
| ACT-076 | 删除mission worktree/temp   |         T0 | 自动                    | zero residue          |    否 |
| ACT-077 | 删除remote branch           |         T1 | 自动，受repo policy约束 | merged/closed         |    否 |
| ACT-078 | 自动开启下一目标            |  Forbidden | `FORBIDDEN`             | 只允许推荐            |    否 |

---

## 11. Shared Resource Lock Matrix

| Resource                        | Default Owner                     | Lock Mode           | Allowed Writer           | Read Consumers                  |                  Human |
| ------------------------------- | --------------------------------- | ------------------- | ------------------------ | ------------------------------- | ---------------------: |
| `packages/shared-contracts`     | selected Mainline/Model/STK owner | `SINGLE_WRITER`     | 一个Track                | 全部只读                        |           否，除T4语义 |
| ScenarioPackage Authority       | Scenario Owner                    | `SINGLE_WRITER`     | Program B selected Track | Course/Run/Teacher              |       T4 lifecycle变更 |
| ParameterSet Authority          | Parameter Owner                   | `SINGLE_WRITER`     | Parameter service Track  | Scenario/Run/Model              |       T4 lifecycle变更 |
| ModelVersion Authority          | Model Owner                       | `SINGLE_WRITER`     | Program M                | Scenario/Runtime/AI read        |                 是，T4 |
| Simulation Core Truth           | Core Owner                        | `EXCLUSIVE_T4`      | Simulation Core          | Projection/Replay               |                 **是** |
| Settlement/Score/Rank           | Settlement Owner                  | `EXCLUSIVE_T4`      | Core L3                  | Projection/Replay/Learning read |                 **是** |
| Run / Replay                    | Run/Replay Owner                  | `SERIAL_OWNER`      | selected T3 or T4 Track  | Product/QA                      |                   仅T4 |
| Golden M1 official              | Replay/QA Owner                   | `SINGLE_OWNER`      | selected Track           | all read                        |             语义变化T4 |
| Repository provider             | Platform Owner                    | `SERIAL_LOCK`       | Program F                | services read                   |           active变更T4 |
| DB schema/migration             | Platform Owner                    | `EXCLUSIVE_T4`      | Program F                | adapters                        |                 **是** |
| package.json/lockfile           | Dependency Owner                  | `PORTFOLIO_LOCK`    | 一个Track                | all                             |         critical依赖T4 |
| CI workflows                    | Program A/Security                | `SINGLE_WRITER`     | selected Track           | all                             |             权限扩大T4 |
| Teacher BFF/UI                  | Product Owner                     | `MAINLINE_PRIORITY` | Mainline                 | STK/M read                      |                     否 |
| Student BFF/UI                  | Product Owner                     | `MAINLINE_PRIORITY` | Mainline                 | Learning/QA                     |                     否 |
| Learning Evidence               | Learning Owner                    | `SINGLE_WRITER`     | Program D                | Student/AI read                 |         final grade T4 |
| Provider/Prompt/Memory Registry | AI Owner                          | `E_STK_SERIAL`      | E或STK一个Track          | runtimes                        |     active provider T4 |
| BLP Runtime Preference Adapter  | Model Owner                       | `M_STK_SERIAL`      | M或STK                   | demand runtime                  |      Model mutation T4 |
| Workforce Signal Adapter        | Ops Owner                         | `OPS_STK_SERIAL`    | Ops或STK                 | operations                      | Truth/roster direct T4 |
| Stakeholder Resolver            | STK Owner                         | `STK_SINGLE_WRITER` | STK                      | models/read                     |      Limited Active T4 |
| Stakeholder durable store       | Platform Owner                    | `F_EXCLUSIVE_T4`    | Program F                | STK/Replay                      |                 **是** |

未登记重叠：

```text
Later-Started Track = PAUSED
Mutation Budget = 0
Action = Rebuild Graph + Recompile Locks + Re-score Paths
```

---

## 12. Parallel Eligibility Matrix

### 12.1 八维检查

1. Product State Independence；
2. File Independence；
3. Authority Independence；
4. Runtime Independence；
5. Contract Independence；
6. Test Independence；
7. Merge Independence；
8. Time-overlap Value。

分类：

| Classification           | 条件                                        | 动作                   |
| ------------------------ | ------------------------------------------- | ---------------------- |
| `PARALLEL_ELIGIBLE`      | 7/8 PASS；File/Authority/Runtime必须PASS    | 可自动启动             |
| `CONDITIONALLY_PARALLEL` | shared read dependency可冻结                | 自动锁后启动           |
| `SUPPORTING_ONLY`        | 无独立产品状态但缩短等待                    | 只读/benchmark/fixture |
| `SERIAL_REQUIRED`        | shared writer/schema/state/Golden/migration | 排队                   |
| `BLOCKED`                | facts/owner/dependency/gate不足             | 不建branch             |

### 12.2 自动路径选择顺序

```text
Mainline blocker reduction
→ Product Surface Gain
→ critical path
→ Authority safety
→ file independence
→ evidence reuse
→ implementation economy
```

---

## 13. Failure Routing

| 分类                     | 判定                                       | 自动路线                           | 人工 |
| ------------------------ | ------------------------------------------ | ---------------------------------- | ---: |
| `REGRESSION`             | base PASS / head FAIL / changed domain相关 | 当前PR最小rework                   |   否 |
| `BASELINE_DEFECT`        | base/head均FAIL且相关blob相同              | 独立Recovery候选；主线无关则不阻塞 |   否 |
| `ENVIRONMENT_FAILURE`    | source无差异，host/tool/config失败         | Environment Baseline修复           |   否 |
| `INFRASTRUCTURE_BLOCKED` | 网络、MCP、CI、容器不可用                  | `EVIDENCE_INSUFFICIENT`，不改产品  |   否 |
| `NOT_PROVEN_FLAKE`       | 无稳定复现与根因                           | 停止重跑，记录                     |   否 |
| `T4_POLICY_CONFLICT`     | T4边界或回滚不清                           | 人工复核                           |   是 |

---

## 14. Exact-Head Automatic Closure for T0—T3

### 14.1 自动Closure输入

- exact base SHA；
- exact head SHA；
- changed-file digest；
- Graph delta（T3强制）；
- allowlist；
- Resource Lock；
- targeted/full validation；
- CI；
- CodeQL；
- review thread；
- mergeability；
- Known Limits；
- post-merge validation plan。

### 14.2 One-Attempt规则

```text
Merge Method = ordinary merge
Attempt Budget = 1
Force/Admin Bypass = forbidden
Automatic Method Switch = forbidden
```

merge失败、head变化或出现冲突：

```text
Status = EXPIRED_REAUTH_REQUIRED
Route = Recompile exact-head automatic closure
```

不需要人工，除非重新分类为T4。

### 14.3 Post-Merge

-读取merge receipt；-核对parents和new master；
-fresh clone；-`npm ci`；
-targeted；
-full test；
-build；
-Playwright，视范围；
-security，视范围；
-clean worktree；
-zero process/temp/store/container residue；
-release locks；
-Memory Delta；-停止。

---

## 15. T4 Human Review Package

### 15.1 T4 Scope Review

必须包含：

-业务目标和不可逆影响；
-Graphify/CodeGraph知识图谱；

- Authority writer before/after；
- data flow；
- rollback；
- failure semantics；
- migration/restore；
  -security/privacy；
  -financial/settlement numerical cases；
  -alternatives与rejected paths；
  -Risk Acceptance；
  -exact mutation budget。

### 15.2 T4 Exact-Head Review

必须包含：

- exact base/head；
- changed files；
- ADR；
  -Graph delta；
- full/differential/concurrency/recovery tests；
  -CI/CodeQL/security；
  -rollback drill；
  -Known Limits；
  -merge method；
  -post-merge验证；
  -Owner签署。

### 15.3 T4人工角色

| T4类型                       | Accountable                                 | 必须Consult                         |
| ---------------------------- | ------------------------------------------- | ----------------------------------- |
| Truth / Settlement / Finance | Project Owner + Core/Settlement Owner       | Finance domain、Replay/QA、Security |
| PG / Migration / Recovery    | Project Owner + Platform Owner              | Security、Replay/QA                 |
| Real Data                    | Project Owner + Data/Privacy Owner          | Security、Product                   |
| External Provider Active     | Project Owner + AI Owner                    | Data/Privacy、Security、Finance     |
| Pilot                        | Project Owner + Pilot Owner                 | Product、Support、Data              |
| Production / Billing         | Project Owner + Production/Commercial Owner | Security、Platform、Finance/Legal   |
| Stage 4B Limited Active      | Project Owner + Chief Architect             | Model、AI、Core、Product、Data      |

---

## 16. Stage 4B Authorization Policy

Plane Mode必须是：

- `OFF`；
- `DETERMINISTIC_FIXTURE`；
- `SHADOW`；
- `LIMITED_ACTIVE`。

| Mode                  |  Tier | 自动/人工 | 关键要求                                                      |
| --------------------- | ----: | --------- | ------------------------------------------------------------- |
| OFF                   | T0/T1 | 自动      | existing path exact parity                                    |
| DETERMINISTIC_FIXTURE | T1/T2 | 自动      | synthetic、resolver tests                                     |
| SHADOW                |    T3 | 自动      | no official impact、plane-off parity、provider replay calls=0 |
| LIMITED_ACTIVE        |    T4 | 人工      | STK-J0—J6、F/G、rollback、disclosure                          |

SHADOW禁止：

-修改ParameterSet；-修改ModelVersion；-写DecisionBatch；-写Settlement；-覆盖Replay；-直接写occupancy/profit/score；-使用真实身份。

---

## 17. Program M Authorization Policy

- M0 ADR/Benchmark：T0/T1自动；
- M1 Reference Adapter POC：T2/T3自动，需TFR和独立container；
- M2 Model Contract/Registry：一般T3；sole writer语义变化为T4；
- M3 Shadow Runtime：T3自动；
- M4 Limited Active Approval：T4人工；
- M5—M8真实数据、durable、Pilot：T4人工；
  -Program M不得成为第二Mainline；-不得因模型支持线未完成阻塞现有Golden或Course OS；-不得修改Simulation Core Truth；-不得把Owner声明完成直接当作current PASS。

---

## 18. Industry Authorization Policy

自动允许：

- Requirement Registry；
- Source Registry；
- Context Pack；
- Traceability；
- synthetic fixtures；
- compatibility reports。

自动降级为串行T3：

- shared Scenario manifest；
- generic contract；
- simulation-core export；
- Run/Replay integration；
  -official Golden verification。

T4人工：

-真实数据；-校准；

- public release；
- Pilot；-收费；
- generic Truth或Authority变更。

---

## 19. Active Authorization Record Template

```yaml
authorization_id:
status:
portfolio_cycle:
mission_id:
program:
value_chain_bundle:
primary_outcome:
track:
wip_lane:
risk_tier:
review_mode:

source_anchor:
base_sha:
branch:
worktree:
evidence_root:
context_pack:

graph_gate:
  required:
  graphify_index:
  codegraph_index:
  selected_path:
  confidence:
  graph_artifacts:

allowlist:
reference_only:
forbidden:

mutable_authority:
sole_writer:
resource_locks:
join_barriers:

allowed_actions:
forbidden_actions:

mutation_budget:
commit_budget:
push_budget:
pr_budget:
merge_budget:

required_tests:
required_negative_tests:
required_evidence:

automatic_pause_triggers:
cancellation_conditions:
expiry:
revalidation_triggers:

t4_human_scope_approval:
t4_human_exact_head_approval:
```

---

## 20. Target Task Execution Contract

### 20.1 Entry

Codex必须：

1.重读Current Reality；2.验证WIP与Resource Locks；3.判断T0—T4；4.检查Graph Gate触发条件；5.调用Graphify与CodeGraph；6.输出候选路径和选择记录；7.生成exact allowlist；8.创建隔离环境；9.从RED开始。

### 20.2 Execution

T0—T3可连续执行：

```text
READ
GRAPH
PATH_SELECT
WORKTREE
BRANCH
ALLOWLIST_MUTATION
TEST
COMMIT
PUSH
PR
IN_PR_REWORK
EXACT_HEAD_AUTO_REVIEW
AUTO_MERGE
POST_MERGE_CLOSURE
```

T4只能在人工Scope批准后mutation，并在人工exact-head批准后merge。

### 20.3 Stop

完成：

-Primary Outcome；
-PR；
-merge；
-fresh clone；
-cleanup；
-Memory Delta；

之后：

```text
STOP
OUTPUT_NEXT_PATH_RECOMMENDATION_ONLY
DO_NOT_START_NEXT_TARGET
```

---

## 21. Worked Examples

### 21.1 T0 Current Reality + Graph

```text
Tier: T0
Human: NO
Actions:
GitHub read → Graphify → CodeGraph → graph artifacts → path recommendation
Mutation: 0
Stop: recommendation delivered
```

### 21.2 T2 Shared DTO

```text
Tier: T2
Human: NO
Graph: required if shared contract has multiple consumers
Flow:
RED contract test → DTO/schema → unit/contract/build → PR
→ dual auto review → auto ordinary merge → fresh clone
```

### 21.3 T3 Teacher/Student Product Slice

```text
Tier: T3
Human: NO
Graph: mandatory
Required:
BFF/UI/API path graph
Student negative
tenant/team isolation
Playwright
full suite
CI/CodeQL
exact-head auto review
auto merge
post-merge fresh clone
```

### 21.4 T3 Formal Run Binding Composition

```text
Tier: T3
Human: NO
Condition:
Does not change Authority lifecycle or Settlement Truth
Graph:
ScenarioPackage → ParameterSet → PluginRelease
→ Composition Root → FormalRunBinding → Run
Tests:
default runtime persisted authority success
missing exact identity fail closed
no legacy fallback
settle/replay private evidence
Closure:
automatic one-attempt merge
```

### 21.5 T4 Settlement/Finance

```text
Tier: T4
Human: YES
Graph:
Decision → Truth L1/L2 → Settlement L3 → Finance → Score/Rank
Required:
scope/rollback approval
numerical Golden
concurrency/idempotency
appeal/non-overwrite
exact-head human approval
```

### 21.6 T3 PG Adapter vs T4 PG Activation

```text
Inactive adapter/parity:
T3 / automatic / no human

Active provider, migration, durable claim:
T4 / human scope + exact-head review
```

### 21.7 Stage 4B Shadow

```text
Tier: T3
Human: NO
Graph: mandatory
Mode: SHADOW
Must prove:
plane-off exact parity
no ParameterSet/ModelVersion mutation
official replay provider calls=0
no official settlement impact
tenant/privacy negative
```

### 21.8 Mainline Blocker Recovery

```text
Tier: based on mutation
Human: only if T4
Priority:
direct reproducible blocker temporarily wins Support Slot
Scope:
root-cause only
Exit:
blocker closed → slot released → Mainline resumes
```

---

## 22. Metrics

| Metric                         |                Target |
| ------------------------------ | --------------------: |
| Value Lead Time                |                  下降 |
| Parallel Overlap               |                  ≥30% |
| Lead-time Reduction            |                  ≥20% |
| File Conflict                  |                   <5% |
| Join Rework                    |                  <10% |
| Human Review                   |                  仅T4 |
| Owner Touch T0—T3              |                     0 |
| Owner Touch T4                 |                    ≤2 |
| Closure Queue                  |                    ≤1 |
| Product Surface Gain           |     ≥1/Mainline Cycle |
| Boundary Breach                |                     0 |
| Cleanup Residue                |                     0 |
| Evidence Reuse                 |                  上升 |
| Graph Gate Coverage            | 100%重要Gate/模糊选择 |
| Official Replay Provider Calls |                     0 |
| Stage 4B Plane-off Parity      |            100% exact |

---

## 23. Explicit No-Go

-两个产品Mainline；-两个Support Code Track同时运行；-两个Track写同一Authority；-两个Track写同一shared schema；-同一host并行heavy suite；-直接push master；
-force/admin bypass；
-run-until-pass；
-silent fallback；
-JSON/PG dual-write；-自动latest；-覆盖历史正式结果；
-Replay覆盖official；
-AI/Agent写Truth；
-Student读取private Truth/Evidence；
-Industry字段进入Kernel；
-Stage 4B第二Truth/Decision writer；-长期integration branch；-知识图谱替代测试证明；
-Graph索引过期仍用于路径选择；
-T0—T3因门禁失败请求人工绕过；-当前目标结束后自动启动下一目标。

---

## 24. Machine-Readable Policy Core

```yaml
policy_id: SIMWAR-CODEX-TARGET-AUTH-MATRIX-V1.0
mode: MAINLINE_LED_BOUNDED_PARALLEL_TARGET_MODE

human_review:
  required_tiers:
    - T4
  forbidden_for_tiers:
    - T0
    - T1
    - T2
    - T3

wip:
  mainline_code: 1
  support_code_shared: 1
  industry_docs: 1
  discovery_read_only: 1
  closure: 1
  heavy_suite_per_host: 1

graph_gate:
  tools:
    - Graphify_MCP
    - CodeGraph_MCP
  mandatory_for:
    - AMBIGUOUS_TASK_SELECTION
    - IMPORTANT_GATE
    - T3
    - T4
    - SHARED_CONTRACT
    - AUTHORITY_BOUNDARY
    - RUN_REPLAY_GOLDEN
    - CROSS_TRACK_JOIN
  outputs:
    - repository-fact-graph.json
    - repository-fact-graph.mmd
    - authority-writer-map.md
    - candidate-paths.md
    - route-scorecard.json
    - selected-path.md
    - resource-lock-manifest.json

auto_merge:
  tiers:
    - T0
    - T1
    - T2
    - T3
  method: ordinary_merge
  attempt_budget: 1
  requires:
    - exact_head
    - ci_success
    - codeql_success
    - required_tests_success
    - no_boundary_breach
    - no_lock_conflict
    - post_merge_capacity

t4:
  human_scope_review: true
  human_exact_head_review: true

stop_rule:
  after_closure: true
  auto_start_next_target: false
  output_next_path_recommendation: true
```

---

## 25. Approval Recommendation

```text
Matrix Status:
READY_FOR_OWNER_APPROVAL

Normative Policy Completeness:
PASS

Current Authorization Register:
NOT_ASSESSED

Default Active Mainline WIP:
1

Default Shared Support Code WIP:
1

Default Industry / Docs WIP:
0–1

Default Closure WIP:
1

Human Review Policy:
T4_ONLY

T0–T3 Review Policy:
AUTOMATED_GRAPH_GATED_EVIDENCE_REVIEW

Important Gate / Ambiguous Task Policy:
GRAPHIFY_AND_CODEGRAPH_MANDATORY

T0–T3 Ordinary Merge Policy:
EXACT_HEAD_AUTOMATIC_ONE_ATTEMPT

T4 Ordinary Merge Policy:
HUMAN_EXACT_HEAD_AUTHORIZATION_REQUIRED

Boundary Breach Tolerance:
0

Automatic Next Target:
FORBIDDEN

Recommended Owner Decision:
APPROVE_AUTHORIZATION_MATRIX
```
