# SimWar L1主线牵引有限并行执行计划 V1.0

**Document ID：** `SIMWAR-L1-MAINLINE-BOUNDED-PARALLEL-PLAN-V1.0`<br>
**建议仓库路径：** `docs/planning/L1_MAINLINE_BOUNDED_PARALLEL_EXECUTION_PLAN.md`<br>
**机器台账：** `docs/planning/l1-portfolio-register.yaml`<br>
**当前周期：** `docs/planning/current-cycle.yaml`<br>
**周期历史：** `docs/planning/portfolio-history/`<br>
**文档状态：** `READY_FOR_REPOSITORY_ADOPTION`<br>
**Assessment Source SHA：** `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2`<br>
**Graph Baseline：** Graphify `0.9.26`；CodeGraph `1.2.0`<br>
**适用阶段：** `L1 / JSON_INTERNAL_ONLY / INTERNAL_APPLICATION_PREPARATION`<br>
**自动开启下一目标：** `FORBIDDEN`

---

## 1. Document Control

| 字段                        | 内容                                                                   |
| --------------------------- | ---------------------------------------------------------------------- |
| Document Owner              | SimWar Project Owner / Chief Architect                                 |
| Portfolio Owner             | L1 Mainline Portfolio Owner                                            |
| Technical Contract          | `docs/technical/L1_TARGET_MODE_EXECUTION_SPEC.md`                      |
| Completion Contract         | `docs/governance/L1_DEFINITION_OF_DONE.md`                             |
| Dynamic State               | `docs/governance/l1-value-chain-ledger.yaml`                           |
| Authorization               | `docs/governance/CODEX_TARGET_MODE_AUTHORITY_MATRIX.md`                |
| Source of Current Selection | Graphify + CodeGraph六类图谱、Gap Graph、Candidate Route Scorecard     |
| Update Frequency            | 每次master merge、PR head变化、Resource Lock变化或Graph Manifest变化后 |
| Review Mode                 | T0—T3自动图谱与证据复核；T4人工复核                                    |
| Supersedes                  | 不替代V3.0长期路线，不替代技术规格，不替代L1 DoD                       |

### 1.1 当前事实锚点

```text
Repository:
qidianzhiku/SimWar

Default Branch:
master

Assessment Source SHA:
a296f9032cf1d7fc921fa837d57e5c33e3cc4de2

Latest Merge:
PR #265 — docs: adopt L1 governance baseline

Previous Product Merge:
PR #264 — feat: bind formal authority inputs to courses

Open PR Count:
0

Runtime Authority:
JSON_INTERNAL_ONLY

Current L1 Status:
NOT_ASSESSED

Pilot:
NOT_AUTHORIZED

Production:
NOT_AUTHORIZED
```

本计划中的SHA是**评估源锚点**，不是永久Current Master。任一后续master merge都会使Current Cycle、候选评分、资源锁和未合并证据进入重新认证状态。

---

## 2. Executive Portfolio Decision

### 2.1 本周期组合结论

```text
Portfolio Cycle:
L1-CYCLE-001-B01

Unique Mainline:
CAND-01 / L1-GAP-B01
Default Persisted Authority Full Golden Chain

Shared Support Code:
NONE

Docs / Discovery:
DISC-01
B01 Exact-File Discovery Card and Graph Delta

Closure Lane:
ONE SERIAL CLOSURE

Ready-for-Closure Limit:
1

Full-Suite Per Host:
1

Automatic Next Cycle:
FORBIDDEN
```

### 2.2 选择理由

当前Gap Graph识别四个L1 Blocker和一个Evidence Gap。Candidate Route Scorecard将`CAND-01`评为当前最高优先级路线。它能够最大程度复用已存在的Formal Asset生命周期、Course/Run Binding、Settlement与Replay能力，并将“分散实现和分散测试”转化为一个默认服务器上的完整L1证据链。

当前不启动Support Code任务，原因是B01会占用：

- Formal Authority；
- Formal Course / Run Binding；
- Run / Replay；
- Golden M1；
- `services/api/src/server.ts`相关调用路径；
- integration与可能的browser验证资源。

Course Membership Visibility、Direct Store Boundary和Executable Contract Parity均可能与上述文件、Projection、Repository或Shared Contract发生冲突。它们进入候选Backlog，但不与B01并行编码。

### 2.3 本计划的核心原则

```text
一个产品Mainline
+ 一个共享Support Code槽
+ 0—1个Docs/Discovery槽
+ 一个串行Closure
```

有限并行的目的不是增加分支数量，而是：

1. 缩短Mainline前置发现时间；
2. 在不争抢Authority和文件写锁的前提下准备证据；
3. 避免Mainline等待无关研究；
4. 保持master状态转换串行；
5. 将Owner触点集中到T4和真实例外，而不是每个工程动作。

---

## 3. Purpose and Governance Position

### 3.1 本计划回答的问题

本计划是动态Portfolio调度合同，回答：

- 当前唯一Mainline是什么；
- 哪些工作可以与Mainline有限并行；
- 哪些候选必须串行；
- 哪些资源被谁锁定；
- 哪个PR先进入Closure；
- 每次merge后哪些证据和选择失效；
- 怎样编译下一Portfolio Cycle；
- 怎样避免“多个小任务都正确，但L1关键路径不前进”。

### 3.2 与其他文件的分工

| 文件                        | 回答的问题                                |
| --------------------------- | ----------------------------------------- |
| V3.0 Roadmap                | 长期往哪里走                              |
| L1 Definition of Done       | L1完成必须满足什么                        |
| L1 Value Chain Ledger       | 当前完成到哪里、证据和缺口是什么          |
| Authority Matrix            | Codex可以自动执行什么                     |
| L1 Technical Execution Spec | 每项能力怎样实现                          |
| 本计划                      | 当前怎样组织Mainline、支持线、锁和Closure |
| Portfolio Register          | 当前实际WIP、候选和锁                     |
| Current Cycle               | 本轮具体执行什么                          |

本计划不得重新定义Truth、Authority、L1范围或技术实现。

---

## 4. Source and Graph Baseline

### 4.1 图谱基线

```text
Graph Source SHA:
a296f9032cf1d7fc921fa837d57e5c33e3cc4de2

Graphify:
CONNECTED / v0.9.26
4,872 nodes
7,805 edges

CodeGraph:
CONNECTED / v1.2.0
3,559 symbols
14,790 edges
```

### 4.2 六类图谱状态

| 图谱                   | 状态               | Portfolio用途                     |
| ---------------------- | ------------------ | --------------------------------- |
| Repository Fact Graph  | `PASS_WITH_LIMITS` | 模块、热点文件、依赖和写入面      |
| Authority Writer Graph | `PARTIAL`          | Writer、旁路和锁；UNKNOWN必须保留 |
| Runtime Call Graph     | `PARTIAL`          | 端到端路径与断点                  |
| Product Journey Graph  | `PARTIAL`          | Teacher/Student/Admin链路缺口     |
| Test Coverage Graph    | `PARTIAL`          | 测试复用、缺失与CI接线            |
| Gap Graph              | `PASS_WITH_LIMITS` | Blocker与Evidence Gap             |
| Resource Lock Manifest | `PASS_WITH_LIMITS` | 当前锁和冲突                      |
| Candidate Route Graph  | `PASS_WITH_LIMITS` | Mainline选择                      |

### 4.3 Freshness规则

图谱只有在以下条件同时满足时可用于冻结Cycle：

```text
Graph Source SHA == Current Remote Master SHA
Graph Scope == Current Tracked Source Scope
Governance Baseline Digest == Current Governance Files
Runtime Authority == Current Runtime Authority
```

任一不满足：

```text
Plan Status:
BLOCKED_GRAPH_REBASE_REQUIRED
```

不得使用过期Gap Graph或Candidate Scorecard选择当前Mainline。

---

## 5. Current Reality

### 5.1 当前产品与治理状态

| 事实                             | 当前结论                                     |
| -------------------------------- | -------------------------------------------- |
| Formal ParameterSet lifecycle    | 已有HTTP治理入口与测试                       |
| Formal PluginRelease lifecycle   | 已有HTTP治理入口与测试                       |
| Formal ScenarioPackage lifecycle | 已有HTTP治理入口与测试                       |
| Formal Course Authority Binding  | 已合并，exact references私有、append-only    |
| Formal Run Binding               | 已实现默认持久化组合与分拆测试               |
| Default Server Full Golden       | `NOT_PROVEN_CURRENT_SHA`                     |
| Course Membership Visibility     | `BLOCKED / Issue #112`                       |
| Direct Store Boundary            | Guard存在，但闭环未证明                      |
| Executable Contract Parity       | 基础存在，但完整parity未证明                 |
| Abort/Reset/Cleanup              | 静态实现存在；current-SHA failure matrix不足 |
| PostgreSQL Active                | `NO`                                         |
| Durable Settlement / Recovery    | `NO`                                         |
| Pilot / Production               | `NOT_AUTHORIZED`                             |

### 5.2 当前L1缺口

| Gap                                               | 分类         |  风险 | 资源锁                                   | 本周期处理     |
| ------------------------------------------------- | ------------ | ----: | ---------------------------------------- | -------------- |
| B01 Default persisted authority full Golden chain | L1_BLOCKER   |    T3 | Formal Authority / Run / Replay / Golden | **MAINLINE**   |
| B02 Course membership visibility                  | L1_BLOCKER   |    T3 | Teacher/Student Projection               | Deferred       |
| B03 Direct-store authority boundary               | L1_BLOCKER   |    T3 | Repository Provider                      | Deferred       |
| B04 Executable contract parity                    | L1_BLOCKER   | T2/T3 | Shared Contracts                         | Deferred       |
| E04 Abort/reset/cleanup zero residue              | Evidence Gap |    T3 | Run/Replay/Golden                        | Join after B01 |

---

## 6. Mainline-Led Operating Model

### 6.1 WIP拓扑

| Lane                  |    WIP | 目的                              | 当前状态               |
| --------------------- | -----: | --------------------------------- | ---------------------- |
| `MAINLINE`            |      1 | 关闭L1关键路径状态转换            | CAND-01                |
| `SHARED_SUPPORT_CODE` |  1共享 | Recovery / Program M / Stage 4B   | NONE                   |
| `DOCS_DISCOVERY`      |    0—1 | 图谱Delta、Context Pack、测试设计 | DISC-01                |
| `SERIAL_CLOSURE`      |      1 | exact-head、merge、post-merge     | Reserved for Mainline  |
| `HEAVY_VALIDATION`    | 1/host | full test/build/browser/security  | Scheduled for Mainline |

### 6.2 Mainline拥有的优先权

Mainline对以下对象拥有本周期优先写锁：

- Formal Authority到Run Binding的接线；
- Run / Round / Decision链；
- Settlement与Publish调用路径的测试性接入；
- Replay Evidence；
- Golden M1 identity；
- Mainline专用integration/browser evidence。

Mainline不自动获得以下变更权限：

- Truth writer；
- Settlement/Score/Rank算法；
- 财务公式；
- PostgreSQL active；
- migration；
- durable settlement；-真实数据；
- Pilot、Production、Billing。

触及上述对象立即转为T4并暂停。

---

## 7. WIP Policy

### 7.1 默认上限

```text
Active Mainline Code:
1

Active Model / Recovery / Stage4B Code:
1 shared slot

Active Docs / Industry / Discovery:
0—1

Ready-for-Closure PR:
1

Merge Execution:
1

Post-Merge Closure:
1

Full-Suite Per Host:
1
```

### 7.2 不计入代码WIP的活动

以下活动在只读、无产品mutation时不占代码槽：

- Current Reality readback；
- Graphify/CodeGraph查询；
- Context Pack；
- exact-file discovery；-测试矩阵设计；
- Evidence catalog；-文档traceability。

一旦修改源码、测试、shared contract或workflow，即进入相应代码WIP和锁治理。

### 7.3 WIP扩大

从两条Active Code Branch扩大到三条属于单独Owner Decision。连续两个Cycle必须同时达到：

- Parallel Overlap ≥30%；
- Lead-Time Reduction ≥20%；
- File Conflict <5%；
- Join Rework <10%；
- Boundary Breach =0；
- Cleanup Residue =0；
- Closure Queue ≤1；
- Owner Touch ≤2 / VCB；
- Independent Reviewer Capacity = AVAILABLE。

任一指标为`UNKNOWN`：

```text
WIP Increase:
NOT_AUTHORIZED
```

---

## 8. Mainline Admission

候选进入Mainline必须具备：

```text
Capability ID
+ Ledger ID
+ DoD Reference
+ Gap ID
+ Current State
+ Target State
+ One Primary Outcome
+ One Mutable Authority
+ Technical Spec Reference
+ Provisional Exact Allowlist
+ Resource Locks
+ Risk Tier
+ Focused RED
+ Negative Tests
+ Exit Evidence
+ Explicit Non-Proofs
+ Stop Condition
```

### 8.1 当前Mainline合同

```text
Candidate:
CAND-01

Gap:
L1-GAP-B01

Capability:
L1-VC-04 / L1-VC-05 / L1-VC-07 / L1-VC-10的单一集成状态转换

Primary Outcome:
在同一个默认JSON服务器中，通过真实HTTP治理入口创建并冻结正式ParameterSet、
PluginRelease和ScenarioPackage，形成Formal Course Binding和Formal Run Binding，
完成Decision → Lock → Settlement → Publish → Replay，并证明Student私有字段隔离、
exact authority identity和official result non-overwrite。

Current State:
分拆生命周期、binding、settlement和replay测试存在。

Target State:
同一默认服务器、同一正式输入链、同一current SHA的完整Golden evidence。

Risk Tier:
T3

Expected PR Count:
1

Automatic Next:
FORBIDDEN
```

### 8.2 Provisional Mutation Strategy

第一步必须以测试和发现为主，不预设一定需要产品代码修改。

**初始Mutation Allowlist：**

```text
tests/integration/default-persisted-authority-full-golden-chain.test.ts
```

**初始Reference-Only：**

```text
services/api/src/server.ts
services/api/src/formal-course-authority-binding.ts
services/api/src/formal-course-authority-binding-store.ts
services/api/src/formal-run-runtime-binding.ts
services/api/src/formal-run-runtime-binding-store.ts
services/api/src/formal-runtime-input-resolver.ts
services/api/src/parameter-set-authority.ts
services/api/src/scenario-package-authority.ts
services/api/src/plugin-release-authority.ts
services/api/src/run-manifest-replay-evidence.ts
services/simulation-core/src/simulation.ts
packages/shared-contracts/src/index.ts
contracts/**
tests/integration/formal-*-lifecycle-endpoint.test.ts
tests/integration/formal-run-runtime-binding-activation.test.ts
tests/integration/settlement-write-replay-hash-characterization.test.ts
```

只有Focused RED证明存在具体缺口，且Graphify/CodeGraph确认最小路径后，才允许把确切产品文件加入Active Authorization Allowlist。不得提前批准整个`services/api/src/**`。

### 8.3 T4自动暂停条件

出现以下任一需要时，Mainline状态变为：

```text
OWNER_REVIEW_REQUIRED
```

触发条件：

- 修改`calculateFinance`、`calculateScore`或正式Settlement公式；
- 新增或改变Truth writer；
- 改变Settlement/Score/Rank唯一写入者；
- 激活PostgreSQL；
- migration；
- durable settlement或recovery；
- real data；
- external provider active；
- Pilot / Production / Billing。

---

## 9. Shared Support Code Slot

### 9.1 当前决定

```text
Selected Support Code:
NONE
```

原因：

- B01占用Run/Replay/Golden/Formal Authority；
- B02可能触及`server.ts`、BFF和Projection；
- B03可能触及`server.ts`和repository provider；
- B04可能触及shared contracts、OpenAPI和handler；
- E04与B01共享Run/Replay/Golden锁。

### 9.2 允许的未来Support Code类型

优先级：

```text
Reproducible Mainline Blocker Recovery
> Approved Program M Support
> Approved Stage 4B Shadow
```

只有当Mainline出现可复现、无法在当前allowlist内最小修复的baseline blocker时，才创建独立Recovery候选。Recovery不得扩展产品目标。

---

## 10. Docs and Discovery Slot

### 10.1 当前选择

```text
Candidate:
DISC-01

Name:
B01 Exact-File Discovery Card and Graph Delta

Classification:
SUPPORTING_ONLY

Mutation:
NONE

Output:
- exact route/symbol chain；
- provisional changed-file allowlist；
- test reuse map；
- private-field negative list；
- Resource Lock freeze；
- explicit non-proofs；
- focused RED command。
```

### 10.2 DISC-01停止条件

当以下资产已生成并绑定source SHA后停止：

```text
B01 Context Pack
B01 Candidate Path Graph
B01 File Overlap Graph
B01 Authority Conflict Graph
B01 Test Reuse Map
B01 Resource Lock Delta
B01 Exact-File Discovery Card
```

DISC-01不得创建实施分支，不得修改测试或业务代码。

---

## 11. Parallel Eligibility

### 11.1 八维模型

每个候选必须评价：

1. Product State Independence；
2. File Independence；
3. Authority Independence；
4. Runtime Independence；
5. Contract Independence；
6. Test Independence；
7. Merge Independence；
8. Time-Overlap Value。

### 11.2 当前可行性矩阵

| 候选        | Product | File         | Authority | Runtime | Contract | Test    | Merge   | Overlap | 分类              |
| ----------- | ------- | ------------ | --------- | ------- | -------- | ------- | ------- | ------- | ----------------- |
| CAND-01 B01 | —       | —            | —         | —       | —        | —       | —       | —       | MAINLINE          |
| DISC-01     | PASS    | PASS         | PASS      | PASS    | PASS     | PASS    | PASS    | PASS    | PARALLEL_ELIGIBLE |
| CAND-02 B02 | PASS    | FAIL/PARTIAL | PASS      | PARTIAL | PARTIAL  | PARTIAL | PARTIAL | MEDIUM  | SERIAL_REQUIRED   |
| CAND-03 B03 | PASS    | FAIL/PARTIAL | PASS      | PARTIAL | PASS     | PARTIAL | PARTIAL | LOW     | SERIAL_REQUIRED   |
| CAND-04 B04 | PASS    | PARTIAL      | PARTIAL   | PARTIAL | FAIL     | PARTIAL | PARTIAL | LOW     | SERIAL_REQUIRED   |
| CAND-05 E04 | PARTIAL | PARTIAL      | FAIL      | FAIL    | PASS     | PARTIAL | FAIL    | LOW     | BLOCKED_BY_B01    |

### 11.3 分类规则

`PARALLEL_ELIGIBLE`要求至少七项PASS，并且File、Authority、Runtime全部PASS。

存在shared Authority、shared schema、shared runtime writer、Golden、Run/Replay、Settlement或相同BFF/UI writer时，必须是`SERIAL_REQUIRED`。

---

## 12. Resource Lock Policy

### 12.1 当前锁表

| Resource                         | Lock Mode            | 当前Owner              | 读消费者          | Release Condition      |
| -------------------------------- | -------------------- | ---------------------- | ----------------- | ---------------------- |
| Formal ParameterSet Authority    | READ/WRITE EXCLUSIVE | CAND-01                | DISC-01 read-only | PR merged + post-merge |
| Formal ScenarioPackage Authority | READ/WRITE EXCLUSIVE | CAND-01                | DISC-01 read-only | 同上                   |
| Formal PluginRelease Authority   | READ/WRITE EXCLUSIVE | CAND-01                | DISC-01 read-only | 同上                   |
| Formal Course Binding            | READ/WRITE EXCLUSIVE | CAND-01                | DISC-01 read-only | 同上                   |
| Formal Run Binding               | READ/WRITE EXCLUSIVE | CAND-01                | DISC-01 read-only | 同上                   |
| Run / Replay                     | EXCLUSIVE            | CAND-01                | DISC-01 read-only | Golden closure         |
| Golden M1                        | EXCLUSIVE            | CAND-01                | no writer         | Evidence current       |
| Settlement Formula               | READ_ONLY            | No mutation authorized | tests             | T4 required to write   |
| Shared Contracts                 | READ_ONLY / RESERVED | No active writer       | CAND-01 reference | Future B04             |
| Repository Provider              | READ_ONLY / RESERVED | No active writer       | CAND-01 reference | Future B03             |
| Teacher/Student Projection       | READ_ONLY / RESERVED | No active writer       | CAND-01 negatives | Future B02             |
| Full Test Host                   | SCHEDULED EXCLUSIVE  | Closure Scheduler      | none              | suite complete         |
| Closure Lane                     | EXCLUSIVE            | CAND-01 PR             | none              | post-merge complete    |

### 12.2 未登记冲突

发现未登记文件或Authority重叠时：

```text
Later-Started Track:
PAUSED

Mutation Budget:
0

Required Action:
RECOMPILE_PORTFOLIO_AND_LOCKS
```

---

## 13. Conflict Priority

```text
Direct reproducible Mainline Blocker Recovery
> Mainline Product State Transition
> Support Code
> Industry / Docs Code
> Docs-Only Governance
```

适用条件：

- Recovery只有在真实阻塞Mainline时优先；
- Mainline默认拥有Product Surface与核心调用链优先权；
- Program M和Stage 4B不得成为第二Mainline；
- Program F独占DB、migration和durable recovery；
- 两个Ready-for-Closure PR不得同时存在。

---

## 14. Candidate Route Scoring

### 14.1 评分模型

```text
Product Surface Gain             25%
L1 Blocker Reduction             20%
Critical Path Shortening         15%
Boundary Safety                  15%
Evidence Reuse                   10%
File / Authority Independence    10%
Implementation Economy            5%
```

### 14.2 当前候选

| Candidate | Gap                       |          Score | 状态              | 选择理由                      |
| --------- | ------------------------- | -------------: | ----------------- | ----------------------------- |
| CAND-01   | B01 Full Golden           |             90 | SELECTED_MAINLINE | 最大复用、直接关闭关键证据链  |
| CAND-02   | B02 Membership Visibility |             84 | DEFERRED          | 可能与server/projection重叠   |
| CAND-03   | B03 Direct Store Boundary | 81 PROVISIONAL | DEFERRED          | 与server/repository锁冲突     |
| CAND-04   | B04 Contract Parity       |             79 | DEFERRED          | shared contracts与handler冲突 |
| CAND-05   | E04 Cleanup Evidence      | 72 PROVISIONAL | BLOCKED_BY_B01    | 与Run/Replay/Golden共享锁     |

`PROVISIONAL`分数只用于排序，不是能力完成判断；下一次Graph Delta后必须重新计算。

---

## 15. Technical Specification Admission

Mainline和未来代码候选必须引用：

```text
docs/technical/L1_TARGET_MODE_EXECUTION_SPEC.md
docs/technical/l1-target-mode-execution-spec.yaml
docs/technical/l1-capabilities/<capability-card>.md
```

当前Mainline技术引用：

```text
L1-VC-04 Formal Authority Binding
L1-VC-05 Run Lifecycle
L1-VC-07 Truth / Settlement
L1-VC-08 Projection / Visibility
L1-VC-10 Replay / Evidence
```

技术规格缺失、source SHA过期或Capability Card与当前源码冲突时，候选降级为：

```text
DISCOVERY_REQUIRED
```

---

## 16. Graphify and CodeGraph Use

### 16.1 Cycle冻结前必须查询

B01必须生成以下Delta：

- Course create route → Formal Course Binding；
- Run create route → derived Formal Run Binding；
- authority lifecycle endpoints → persisted registries；
- `resolveFormalRuntimeInputsForActiveRun`调用链；
- Decision → Lock → Settlement → Publish；
- Replay evidence与public/private projection；
- Student forbidden markers；-测试到source symbol映射；
- exact file overlap与resource lock。

### 16.2 图谱使用限制

图谱可证明：

- symbol和关系存在；-调用路径候选；
- writer候选；-测试文件关联；-潜在冲突。

图谱不能证明：

-默认服务器链路运行成功；-测试实际通过；

- CI/CodeQL通过；
- private field运行时一定不泄露；
- Replay一定不覆盖official result；
- post-merge环境无残留。

---

## 17. Portfolio Cycle

### 17.1 Cycle阶段

```text
C0 Current Reality and Graph Freshness
C1 Cycle Freeze and Resource Lock
C2 Exact-File Discovery and Focused RED
C3 Minimal Implementation or Evidence Closure
C4 Affected Validation
C5 Heavy Validation Queue
C6 Non-Draft PR and Exact-Head Freeze
C7 Machine Review and Join Validation
C8 T4 Human Review, only if triggered
C9 Ordinary Merge
C10 Post-Merge Fresh Validation
C11 Ledger / Portfolio / Graph Delta
C12 Stop
```

### 17.2 14天参考节奏

天数只是参考，Gate顺序是强制的。

| 日程    | 主要动作                                       |
| ------- | ---------------------------------------------- |
| Day 0   | Current Reality、Graph freshness、Cycle freeze |
| Day 1   | Fresh worktree、Context Pack、exact scope      |
| Day 2   | Graph queries、Focused RED                     |
| Day 3—7 | Minimal implementation / test closure          |
| Day 8   | Affected tests、contract、boundary             |
| Day 9   | Full test/build/browser/security               |
| Day 10  | PR、exact head                                 |
| Day 11  | machine review、Join                           |
| Day 12  | T4人工复核（如触发）                           |
| Day 13  | merge、post-merge                              |
| Day 14  | ledger、portfolio、graph delta、stop           |

---

## 18. Branch / Worktree / Evidence Contract

### 18.1 Branch Mission

```text
Mission ID:
DEV-L1-B01-DEFAULT-PERSISTED-AUTHORITY-GOLDEN-001

Suggested Branch:
codex/l1-b01-default-persisted-authority-golden-001

Worktree:
isolated fresh worktree from authenticated source SHA

Primary Outcome:
one

Mutable Authority:
FORMAL_AUTHORITY_RUN_BINDING_GOLDEN

Evidence Root:
mission-owned external directory
```

### 18.2 禁止

- 在受保护主工作区直接mutation；
- 长期integration branch；
- 两个Track共享worktree；
- 业务Evidence写入仓库temp目录；
- source变化后继续使用旧Context Pack；
- 自动扩展allowlist；
- 直接push master。

---

## 19. Test and CI Scheduler

### 19.1 B01 Focused RED

首先新增一个同一默认服务器端到端测试。预期初次结果只能是：

- `FAIL_EXPECTED_GAP`；
- `PASS_EXISTING_CAPABILITY_DISCOVERED`；
- `ENVIRONMENT_FAILURE`；
- `INFRASTRUCTURE_BLOCKED`。

不得预设必须修改产品代码。

### 19.2 Focused/Affected测试

至少覆盖：

```text
formal-parameter-set-lifecycle-endpoint
formal-plugin-release-lifecycle-endpoint
formal-scenario-package-lifecycle-endpoint
formal-run-runtime-binding-activation
formal-course-authority-binding
settlement-write-replay-hash-characterization
m1-run-manifest-replay-evidence
student visibility negatives
```

### 19.3 PR Candidate

```text
npm run check:hidden-unicode
npm run check:direct-store-boundaries
npm run lint
npm run typecheck
npm test -- --maxWorkers=1
npm run test:contract
npm run build
npm run security:audit
npm run test:e2e:ui   # 若browser/前端链路进入scope
git diff --check
```

具体命令应读取current `package.json`，不得假设历史命令仍存在。

### 19.4 Heavy Validation

同一host只能有一个full-suite。DISC-01不得占用heavy validation槽。

---

## 20. Serial Closure Lane

### 20.1 Closure准入

PR进入Ready-for-Closure必须满足：

- exact base/head；
- changed files与allowlist一致；
- focused RED/GREEN证据；
- affected tests；
- full applicable suite；
- CI与CodeQL；
- review threads resolved；
- T4未触发，或已人工复核；
- Resource Lock无冲突；
- Explicit Non-Proofs完整。

### 20.2 Merge

T0—T3按授权矩阵执行一次exact-head ordinary merge。禁止：

- force merge；
- admin bypass；-自动切换merge method；
- head变化后沿用旧授权；-同一授权合并第二个PR。

### 20.3 Post-Merge

必须在fresh clone执行：

```text
npm ci
targeted tests
affected/full tests
contract
build
browser if applicable
clean status
zero mission-owned residue
```

通过后才可将能力标记为`CLOSED_AND_CURRENT`。

---

## 21. Authorization and T4 Human Review

### 21.1 T0—T3

```text
Review:
AUTOMATED_GRAPH_GATED_EVIDENCE_REVIEW
```

有效授权范围内可以连续完成：

- worktree；
- TDD；
- allowlist内mutation；
- tests；
- commit；
- push；
- PR；
- PR内最小返工；
- exact-head机器复核；
- ordinary merge；
- post-merge closure。

### 21.2 T4

```text
Review:
HUMAN_REVIEW_REQUIRED
```

本周期默认不授权T4。若Focused RED显示必须修改财务公式、Truth/Settlement writer或激活durable provider，必须停止并形成Owner Decision Package。

---

## 22. Failure and Recovery

| 分类                   | 判定                                     | 路线                  |
| ---------------------- | ---------------------------------------- | --------------------- |
| REGRESSION             | base PASS、head FAIL、changed domain相关 | 当前PR最小返工        |
| BASELINE_DEFECT        | base/head均FAIL、相关blob相同            | 独立Recovery候选      |
| ENVIRONMENT_FAILURE    | host/tool/config导致                     | Environment Baseline  |
| INFRASTRUCTURE_BLOCKED | 网络、CI、MCP不可用                      | EVIDENCE_INSUFFICIENT |
| NOT_PROVEN_FLAKE       | 无稳定复现和根因                         | 禁止run-until-pass    |
| GRAPH_STALE            | graph SHA与master不同                    | 重建图谱              |
| RESOURCE_LOCK_CONFLICT | 两Track争抢writer/文件                   | 后启动Track暂停       |
| T4_TRIGGERED           | 不可逆或财务/Truth变更                   | 人工复核              |

---

## 23. Metrics and WIP Increase

当前Cycle记录：

- Value Lead Time；
- Active Engineering Time；
- Blocked Ratio；
- Parallel Overlap；
- File Conflict Rate；
- Join Rework Ratio；
- Owner Touch；
- Closure Queue；
- Product Surface Gain；
- L1 Blocker Reduction；
- Evidence Reuse；
- Boundary Breach；
- Cleanup Residue；
- Post-Merge Escape。

初始值为`NOT_MEASURED`，不得伪造为0。只有实际Cycle receipt才能写入数值。

---

## 24. Portfolio Register

机器台账必须记录：

```yaml
portfolio_version:
generated_at:
repository:
current_master:
graph_manifest:
l1_status:
wip_policy:
active:
resource_locks:
candidate_backlog:
blocked:
ready_for_closure:
merge_order:
metrics:
graph_freshness:
evidence_freshness:
automatic_next_start: false
```

Markdown计划是稳定政策，Portfolio Register是动态事实。两者不得混为一体。

---

## 25. Current Cycle

`current-cycle.yaml`是当前唯一可执行Portfolio选择。

本周期：

```text
Mainline:
CAND-01

Support Code:
NONE

Docs / Discovery:
DISC-01

Closure:
Mainline PR only

Merge Order:
1. CAND-01
2. Post-merge ledger and portfolio update
```

Current Cycle不直接授权开发；具体Mission仍需生成绑定source、branch、allowlist、locks和expiry的Target Task Authorization Record。

---

## 26. Update and Invalidation

以下事件使Current Cycle立即失效：

- master changed；
- open PR改变并产生资源冲突；
- Mainline PR head变化；
- graph manifest变化；
- authority writer变化；
- runtime provider变化；
- shared contract变化；
- B01技术规格变化；
- Resource Lock变化；
- T4触发；-超过14天或跨越2次master merge。

失效状态：

```text
EXPIRED_REAUTH_REQUIRED
```

### 26.1 每次merge后的顺序

```text
New Master Readback
→ Post-Merge Fresh Validation
→ Ledger Delta
→ Portfolio Register Delta
→ Graph Delta/Rebuild
→ Candidate Re-score
→ Recommend Next Cycle
→ Stop
```

不得自动启动下一个候选。

---

## 27. Stop Rule

当前Cycle在以下任一状态后停止：

- `COMPLETED_AND_CLOSED`；
- `OWNER_REVIEW_REQUIRED`；
- `BLOCKED_GRAPH_REBASE_REQUIRED`；
- `EVIDENCE_INSUFFICIENT`；
- `RESOURCE_LOCK_CONFLICT`；
- `BASELINE_DEFECT_REQUIRES_RECOVERY_CANDIDATE`。

停止后只输出：

-当前事实；-证据；

- Gap delta；-下一候选建议；-是否需要重新编译Portfolio。

不得自动创建下一branch。

---

## 28. Adoption Recommendation

```text
Plan Status:
READY_FOR_REPOSITORY_ADOPTION

Repository:
qidianzhiku/SimWar

Current Master:
a296f9032cf1d7fc921fa837d57e5c33e3cc4de2

Graph Source SHA:
a296f9032cf1d7fc921fa837d57e5c33e3cc4de2

Graphify Status:
CONNECTED

CodeGraph Status:
CONNECTED

Current L1 Status:
NOT_ASSESSED

L1 Blocker Count:
4

Evidence Gap Count:
1 CURRENTLY MAPPED

Critical Unknown Count:
4

Selected Mainline:
CAND-01 / L1-GAP-B01

Selected Support Code:
NONE

Selected Docs / Discovery:
DISC-01

Closure WIP:
1

T4 Candidate Count:
0 IN CURRENT CYCLE

Current Cycle:
GENERATED

Portfolio Register:
GENERATED

Automatic Next Start:
FORBIDDEN

Recommended Owner Decision:
ADOPT_L1_BOUNDED_PARALLEL_PLAN
```

---

# Appendix A — Parallel Feasibility Matrix

| Candidate | Lane           | Authority                           | Main Files                 | Locks                    | Eligibility       | Merge Order               |
| --------- | -------------- | ----------------------------------- | -------------------------- | ------------------------ | ----------------- | ------------------------- |
| CAND-01   | MAINLINE       | FORMAL_AUTHORITY_RUN_BINDING_GOLDEN | API/formal/test chain      | Formal/Run/Replay/Golden | SERIAL_MAINLINE   | 1                         |
| DISC-01   | DOCS_DISCOVERY | NONE                                | evidence only              | read locks               | PARALLEL_ELIGIBLE | no merge or docs PR later |
| CAND-02   | BACKLOG        | TENANT_COURSE_VISIBILITY            | server/apps/tests          | projection               | SERIAL_REQUIRED   | future                    |
| CAND-03   | BACKLOG        | REPOSITORY_FACADE                   | server/repository/guard    | provider                 | SERIAL_REQUIRED   | future                    |
| CAND-04   | BACKLOG        | PUBLIC_CONTRACT                     | contracts/shared/api/tests | shared contracts         | SERIAL_REQUIRED   | future                    |
| CAND-05   | BACKLOG        | RUN_LIFECYCLE                       | lifecycle/tests            | Run/Replay/Golden        | BLOCKED_BY_B01    | after B01                 |

# Appendix B — Resource Lock Register

资源锁的机器版本见`l1-portfolio-register.yaml`。任何写锁必须绑定Cycle、Mission、source SHA、Owner、release condition和expiry。

# Appendix C — Candidate Route Scorecard

正式评分以Graph Manifest绑定的Candidate Route Scorecard为源。本文只保留当前选择和调度解释，不把评分扩大为实现证明。

# Appendix D — Current Portfolio Register

见：

```text
docs/planning/l1-portfolio-register.yaml
```

# Appendix E — Current Cycle YAML

见：

```text
docs/planning/current-cycle.yaml
```

# Appendix F — Portfolio History Schema

每个关闭Cycle写入：

```text
docs/planning/portfolio-history/<cycle-id>.yaml
```

历史文件不可覆盖，必须记录source、head、merge、evidence、metrics、gap delta和下一候选建议。
