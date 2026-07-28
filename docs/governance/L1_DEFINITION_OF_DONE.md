# SimWar L1 完成定义（Definition of Done）V1.0

**Document ID：** `SIMWAR-L1-DOD-V1.0`
**建议仓库路径：** `docs/governance/L1_DEFINITION_OF_DONE.md`
**文档状态：** `READY_FOR_OWNER_APPROVAL`
**适用阶段：** `L1 — Automated Engineering Application Validation`
**不自动授权：** L1+、PostgreSQL、Durable Settlement、Recovery、Controlled Pilot、Production、真实数据、收费或外部 Provider 激活
**编制角色：** SimWar 首席架构师 / L1 Release Gate 评审负责人
**编制日期：** 2026-07-28
**Current Reality 截止：** 2026-07-28，本文件第 17 章所列范围
**权威说明：** 本文件定义“什么条件构成 L1 完成”；它本身不证明当前仓库已经完成 L1。

---

## 1. Document Control

### 1.1 文档目的

本文件为 SimWar L1 的唯一完成标准，供以下角色共同使用：

- Project Owner；
- Chief Architect；
- Product Owner；
- Engineering Lead；
- QA / Security；
- Codex 目标任务模式；
- GitHub PR / CI / Release Gate 审查者。

本文件解决以下问题：

1. L1 到底是什么；
2. L1 不是什么；
3. 哪些能力是硬性阻断项；
4. 哪些限制可以在 L1 作为 Known Limits 接受；
5. 哪些能力必须延后至 L1+、L2、L3 或 L3+；
6. 每项能力如何测试、如何失败、需要什么证据；
7. 当前仓库可以在什么条件下正式声明
   `SIMWAR_L1_AUTOMATED_ENGINEERING_APPLICATION_VALIDATION_COMPLETE`；
8. 当前证据不足时为什么必须判定 `UNKNOWN` 或 `NOT_ASSESSED`。

### 1.2 文档控制表

| 字段                        | 内容                                                                     |
| --------------------------- | ------------------------------------------------------------------------ |
| 文档名称                    | SimWar L1 完成定义（Definition of Done）V1.0                             |
| Document ID                 | `SIMWAR-L1-DOD-V1.0`                                                     |
| Status                      | `READY_FOR_OWNER_APPROVAL`                                               |
| Applicable Release          | L1 Automated Engineering Application Validation                          |
| Primary Runtime Scope       | `JSON_INTERNAL_ONLY`                                                     |
| Data Scope                  | synthetic / anonymized / disposable internal data                        |
| Customer Scope              | 非真实客户、非合同课程、非收费                                           |
| Pilot / Production          | `NOT_AUTHORIZED`                                                         |
| PostgreSQL Active Authority | `NOT_AUTHORIZED`                                                         |
| Supersedes                  | 任何分散在历史 Mission Prompt 中、与本文件冲突的 L1 完成口径             |
| Inherits                    | SimWar V3.0-R1 Roadmap、Truth/Authority/Replay/Student/Tenant 不可变边界 |
| Approval Effect             | 只批准 L1 定义，不批准“当前 L1 已完成”                                   |
| Invalidation                | 架构边界、Release Ladder、active authority 或 Owner 决策发生实质变化     |

### 1.3 规范性语言

本文件中的下列词语具有强制含义：

- **必须 / MUST**：缺失即不能通过；
- **不得 / MUST NOT**：违反即硬失败；
- **应 / SHOULD**：除非存在正式记录的例外；
- **可以 / MAY**：允许但不构成完成必要条件；
- **UNKNOWN**：证据缺失或无法可信判定，永远不得通过；
- **PASS_WITH_LIMITS**：能力通过，但必须绑定 Known Limit、Owner、scope、expiry 和 revalidation；
- **EXCEPTION_WITH_OWNER_AND_EXPIRY**：显式例外，不得伪装成 PASS。

---

## 2. Executive Decision

### 2.1 L1 的正式定义

SimWar L1 是在以下受限条件下完成的自动化工程应用验证：

- `JSON_INTERNAL_ONLY` 为唯一 active runtime authority；
- 使用 synthetic / anonymized、可清理的数据；
- 不连接真实客户、真实项目身份或受保护个人数据；
- 不收费；
- 不依赖 PostgreSQL active authority；
- 不宣称 durable settlement、backup、restore 或 recovery；
- 不进入 Controlled Pilot；
- 不进入 Production；
- 不以 AI、BLP Shadow 或 Stage 4B 作为 L1 的隐含必要依赖。

L1 必须通过可重复的工程证据证明：

1. Teacher / Student / Admin 最小产品链可运行；
2. Golden M1 可以在干净环境中重复执行；
3. Truth-L1、Truth-L2、SettlementResult / Score / Rank 只有 Simulation Core 的授权写入路径；
4. ParameterSet、ScenarioPackage、Plugin Release 与 Formal Run 使用 exact identity / version / digest；
5. tenant、course、team、role 与 Student visibility 不发生越权；
6. Decision → Lock → Settlement → Publish 可完成；
7. Replay 不覆盖 official result；
8. Abort / Reset / Cleanup 可执行，并形成零残留或可证明的批准残留；
9. Known Limits 在 Teacher / Student / Admin 产品面及 Evidence Pack 中明确披露；
10. fresh clone、CI、测试、浏览器链与 Evidence Pack 能够复验。

### 2.2 L1 完成声明

只有在本文件全部 `REQUIRED_FOR_L1` 条目满足，并且所有适用 Gate 不含 `UNKNOWN` 时，才允许声明：

```text
SIMWAR_L1_AUTOMATED_ENGINEERING_APPLICATION_VALIDATION_COMPLETE
```

该声明只证明：

- 自动化工程应用链；
- 当前精确 source SHA；
- 当前精确 runtime scope；
- 当前精确 Golden M1；
- 当前精确 Known Limits。

它不证明：

- Human Validation；
- 教师或学员真实可用性；
- 教学效果；
- Controlled Pilot readiness；
- Production readiness；
- PostgreSQL active authority；
- durable settlement；
- recovery；
- SLO / SLA；
- Agent behavior fidelity；
- 真实行业预测能力。

### 2.3 当前评审结论

本文件的**定义**已达到 Owner 审批条件；但截至本次编制，当前仓库的 L1 能力不得判为 PASS，原因是：

- 当前 `master` 已认证，但未在本次评审环境中完成 fresh clone 全量复验；
- 当前 merge commit 的 post-merge workflow readback 未完整取得；
- branch protection / ruleset 当前状态未能通过可用工具认证；
- 当前完整 Golden Product Journey、Abort / Reset / Cleanup 和 Evidence Pack 未在本次评审中重新执行；
- 若干与 L1 边界相关的开放 Issue 尚未完成 current-source closure readback。

因此：

```text
Current L1 Capability Status: NOT_ASSESSED
```

---

## 3. Purpose and Intended Use

### 3.1 Intended Use

本文件用于：

- 判断某项工作是否属于 L1；
- 防止把 L1+、L2、L3 工作错误塞入 L1；
- 编译 Codex 目标任务；
- 评审 PR 是否关闭一个真实 L1 blocker；
- 生成 L1 Completion Evidence Pack；
- 形成最终 Owner L1 acknowledgment。

### 3.2 非用途

本文件不得被用于：

- 自动授权 merge；
- 自动授权 runtime activation；
- 自动授权 PostgreSQL；
- 自动授权 migration；
- 自动授权真实数据；
- 自动授权 Controlled Pilot；
- 自动授权 Production；
- 自动将 CI green 解释为 L1 完成；
- 自动关闭所有 P1 Issue；
- 自动启动下一 Program。

---

## 4. Source Hierarchy and Current Reality Policy

### 4.1 Evidence Priority

证据优先级固定如下：

1. 当前已认证 GitHub / Runtime 事实；
2. 当前仓库源代码与可重复测试；
3. fresh detached clone 的新鲜验证；
4. 已批准 ADR / Governance / Authority Matrix；
5. 《SimWar 后续至上线完整开发计划 V3.0-R1》；
6. 历史 Mission Report、PR 报告和历史快照；
7. 推断与建议。

低优先级来源不得覆盖高优先级事实。

### 4.2 Current Reality 刷新要求

L1 评审开始前必须刷新：

- default branch；
- current master SHA；
- open PR；
- current merge candidate；
- CI / CodeQL；
- branch protection / ruleset；
- open L1-relevant issues；
- runtime authority；
- package / lockfile；
- Teacher / Student / Admin source；
- Golden M1 tests；
- Replay / cleanup tests；
- current Known Limits；
- fresh clone result。

### 4.3 Evidence Freshness

| Evidence                 | 默认有效期 / 失效条件                                   |
| ------------------------ | ------------------------------------------------------- |
| master SHA               | 新 commit 立即失效                                      |
| PR exact head/base/files | push、rebase、base change、merge 立即失效               |
| CI / CodeQL              | 只对精确 SHA 有效                                       |
| branch protection        | 12–24 小时或规则变更                                    |
| Issue state              | 1–4 小时或 issue event                                  |
| runtime authority        | config / provider / source 变化                         |
| fresh clone evidence     | source、lockfile、Node/npm、环境变化                    |
| browser evidence         | UI / BFF / route / contract 变化                        |
| Golden M1 digest         | fixture、engine、scenario、parameter、plugin、seed 变化 |
| Owner acknowledgment     | scope / expiry / Known Limit 变化                       |

### 4.4 当前事实标签

所有 Current State 必须标记为：

- `CURRENT_GITHUB_FACT`；
- `CURRENT_SOURCE_FACT`；
- `CURRENT_TEST_SOURCE`；
- `CURRENT_EXECUTED_EVIDENCE`；
- `HISTORICAL_REPORT_ONLY`；
- `ROADMAP_BASELINE`；
- `INFERENCE`；
- `UNKNOWN`。

---

## 5. L0–L3+ Release Ladder

| 级别 | 正式名称                                     | 核心目标                                                 | 允许                                                                  | 禁止宣称                                     |
| ---- | -------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------- |
| L0   | Local Demo                                   | 本地单链演示                                             | synthetic fixture、单机运行                                           | application validated                        |
| L1   | Automated Engineering Application Validation | 自动化证明最小产品链、Truth、Visibility、Replay、Cleanup | JSON internal、synthetic、fresh clone、浏览器自动化                   | Human Validation、Pilot、Production、durable |
| L1+  | Product and Course Hardening                 | Scenario/Course/Learning 产品化与教师成功                | Compiler、Blueprint、Role、Export、Teacher Confirmation、受控 AI mock | Pilot readiness                              |
| L2   | Controlled Teaching Pilot                    | 真实教师/学员、staging、支持与人因验证                   | 受控真实课程、独立数据与模型 scope                                    | Production                                   |
| L3   | Production Launch                            | durable、recovery、security、operations、收费            | production tenant、SLO/SLA、billing                                   | 无边界扩张                                   |
| L3+  | Scale and Industry Portfolio                 | 多行业、企业平台、生态与规模                             | Industry Portfolio、Enterprise Platform                               | 绕过 Core / Owner Gate                       |

### 5.1 关键分界

- L1 证明“系统在受限环境中可被自动化地正确运行”；
- L1+ 证明“教师可以更低成本复制和配置课程”；
- L2 证明“真实人类参与下可以受控交付”；
- L3 证明“可以作为生产服务运营”。

L1 不得吸收完整 Program B/C/D/E/F/G/H。

---

## 6. Formal Definition of L1

### 6.1 L1 必备状态

L1 完成时必须同时满足：

```text
CURRENT SOURCE FROZEN
+
JSON SINGLE ACTIVE AUTHORITY
+
TEACHER / STUDENT / ADMIN MINIMUM SURFACES
+
GOLDEN M1 END-TO-END
+
TRUTH / AUTHORITY WRITER BOUNDARIES
+
TENANT / COURSE / TEAM / ROLE VISIBILITY
+
DECISION → LOCK → SETTLEMENT → PUBLISH
+
REPLAY NON-OVERWRITE
+
ABORT / RESET / CLEANUP
+
KNOWN LIMITS
+
FRESH CLONE / CI / EVIDENCE PACK
+
OWNER ACKNOWLEDGMENT
```

### 6.2 L1 最小 Decision 模式

L1 可以使用：

- 单一团队 canonical decision；
- student whole-decision submit；
- teacher lock / settle / publish；
- deterministic synthetic Golden M1。

完整 Role Workflow：

- role assignment；
- role-scoped draft；
- team merge；
- CEO final confirmation；

属于 `REQUIRED_FOR_L1_PLUS`，除非当前 L1 产品对外声称已经支持角色化协作，或 active path 已实际依赖这些对象。

### 6.3 L1 最小 Scenario / Authority 模式

L1 必须：

- 使用 exact ScenarioPackage identity / version / digest；
- 使用 exact ParameterSet identity / version / digest；
- 使用 exact Plugin Release / engine reference；
- fail closed；
- 不自动 latest；
- 不 silent fallback；
- Run 创建后 binding 不漂移。

完整 Source → Normalize → Compiler → QA → Publish Factory 可进入 L1+；但至少一套 L1 Golden 资产必须拥有可审计的正式 identity 与 binding。

---

## 7. L1 Explicit Non-Definition

以下能力不构成 L1 完成必要条件，但必须正确保持关闭、inactive 或受限状态：

| 能力                        | L1 分类                         | 要求                                |
| --------------------------- | ------------------------------- | ----------------------------------- |
| PostgreSQL active provider  | `FORBIDDEN_AT_L1`               | JSON 保持唯一 active authority      |
| Durable settlement          | `ALLOWED_L1_KNOWN_LIMIT`        | 明确未证明                          |
| Backup / restore / recovery | `ALLOWED_L1_KNOWN_LIMIT`        | Replay 不得冒充 Recovery            |
| Controlled Pilot            | `DEFERRED_TO_L2`                | 需要真实用户、支持、条款与数据 Gate |
| Production                  | `DEFERRED_TO_L3`                | 需要 F/G/H Gate                     |
| 真实收费                    | `FORBIDDEN_AT_L1`               | 无 billing / entitlement claim      |
| 真实客户数据                | `FORBIDDEN_AT_L1`               | 只用 synthetic / anonymized         |
| Governed AI runtime         | `REQUIRED_FOR_L1_PLUS` 或 later | 不得写 Truth / Decision / Score     |
| BLP Shadow / active switch  | `NON_BLOCKING_SUPPORT_LINE`     | 未显式绑定不得阻塞 L1               |
| Stage 4B Stakeholder Plane  | `NON_BLOCKING_SUPPORT_LINE`     | OFF / inactive；不写 formal state   |
| Human Validation            | `DEFERRED_TO_L2`                | 自动化不能替代真人验证              |
| SLO / SLA                   | `DEFERRED_TO_L3`                | L1 不宣称运营承诺                   |
| Industry Portfolio          | `DEFERRED_TO_L3_PLUS`           | Core L1 不依赖康养或上海专属实现    |

---

## 8. L1 and L1+ Boundary Matrix

| Capability                                    | L1 分类                         | 不完成是否阻断 L1 | 当前 L1 active path 是否应依赖 | 后续 Program / Gate  | 错误提前纳入 L1 的后果        |
| --------------------------------------------- | ------------------------------- | ----------------: | -----------------------------: | -------------------- | ----------------------------- |
| ParameterSet Authority                        | `REQUIRED_FOR_L1`               |                是 |                             是 | B-G1                 | 参数双权威                    |
| ScenarioPackage Authority                     | `REQUIRED_FOR_L1`               |                是 |                             是 | B-G1/B-G5            | 历史漂移                      |
| Plugin Release exact availability             | `REQUIRED_FOR_L1`               |                是 |                             是 | B5 / Plugin boundary | 未批准插件进入正式运行        |
| Teacher Scenario Catalog                      | `OPTIONAL_L1_ENHANCEMENT`       |                否 |                             否 | B3/B4                | UI 扩张                       |
| Formal Run Binding                            | `REQUIRED_FOR_L1`               |                是 |                             是 | B5                   | Run 无法证明使用何种资产      |
| Generic Compiler                              | `REQUIRED_FOR_L1_PLUS`          |                否 |                             否 | B2                   | 把资产生产线误当运行闭环      |
| Scenario publish / retire authoring           | `REQUIRED_FOR_L1_PLUS`          |                否 |                             否 | B3                   | 扩大资产治理范围              |
| Teacher local draft selection                 | `OPTIONAL_L1_ENHANCEMENT`       |                否 |                             否 | B4                   | 选择 UI 抢占主链              |
| CourseBlueprint versioning                    | `REQUIRED_FOR_L1_PLUS`          |                否 |                             否 | C-G1                 | 课程工业化提前                |
| Teacher Blueprint Studio                      | `REQUIRED_FOR_L1_PLUS`          |                否 |                             否 | C2                   | 大量 UI 与表单                |
| Minimal whole-team Decision                   | `REQUIRED_FOR_L1`               |                是 |                             是 | P-G3                 | 无法完成主链                  |
| Full Role Workflow                            | `REQUIRED_FOR_L1_PLUS`          |              否\* |                             否 | C-G3 / #119          | 后端权限和 UI 范围膨胀        |
| Instructor Kit                                | `REQUIRED_FOR_L1_PLUS`          |                否 |                             否 | C4                   | 内容产品化提前                |
| Course clone / export                         | `REQUIRED_FOR_L1_PLUS`          |                否 |                             否 | C-G4                 | 课程复用范围膨胀              |
| Three-Part Feedback / minimal Learning Report | `REQUIRED_FOR_L1`               |                是 |                             是 | P-G3                 | Student 闭环不完整            |
| Learning Goal Registry                        | `REQUIRED_FOR_L1_PLUS`          |                否 |                             否 | D1                   | 评估领域提前                  |
| Rubric Runtime                                | `REQUIRED_FOR_L1_PLUS`          |                否 |                             否 | D1/D2                | 双账本范围膨胀                |
| Teacher Confirmation                          | `REQUIRED_FOR_L1_PLUS`          |                否 |                             否 | D-G3                 | 正式学习评价提前              |
| AoL / xAPI                                    | `REQUIRED_FOR_L1_PLUS`          |                否 |                             否 | D-G4                 | 外部 LRS 范围膨胀             |
| Governed AI                                   | `REQUIRED_FOR_L1_PLUS` 或 later |                否 |                             否 | E-G1–E-G5            | provider / prompt / tool 风险 |
| BLP Shadow                                    | `NON_BLOCKING_SUPPORT_LINE`     |                否 |      否，除非 explicit binding | M-G3/M-G4            | 模型线阻塞产品线              |
| Stage 4B                                      | `NON_BLOCKING_SUPPORT_LINE`     |                否 |                             否 | STK-G0–G4            | 新 Authority / WIP 失控       |
| PostgreSQL                                    | `DEFERRED_TO_L3_FOUNDATION`     |                否 |                             否 | F3/F4                | 双写和迁移风险                |
| Durable Settlement                            | `DEFERRED_TO_L3_FOUNDATION`     |                否 |                             否 | F6                   | 把 L1 变成生产平台            |
| Recovery                                      | `DEFERRED_TO_L2/L3`             |                否 |                             否 | F7/G3                | Replay 冒充恢复               |
| Controlled Pilot                              | `DEFERRED_TO_L2`                |                否 |                             否 | G                    | 自动化冒充人因                |
| Production                                    | `DEFERRED_TO_L3`                |                否 |                             否 | H                    | 未成熟上线                    |

\* 若当前 UI 或对外声明已经把 Role Workflow 作为 L1 产品承诺，则其后端生命周期、权限与 negative tests 自动升级为 L1 blocker；默认不如此处理。

---

## 9. Immutable Architecture and Authority Boundaries

### 9.1 Sole Writer Matrix

| Object                          | Sole Writer                              | 允许消费者                                     | 禁止写入者                                         |
| ------------------------------- | ---------------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| Truth-L1 market / demand        | Simulation Core L1                       | L2/L3、Projection、Replay                      | Teacher、Student、Admin、AI、Plugin、BLP、Scenario |
| Truth-L2 operations / capacity  | Simulation Core L2                       | L3、Projection、Replay                         | UI、AI、BLP、Plugin                                |
| SettlementResult / Score / Rank | Simulation Core L3                       | Projection、Replay、Learning safe read         | Teacher、AI、Rubric、Model、Plugin                 |
| ParameterSetVersion             | ParameterSetCommandService               | Scenario compiler、Run binder                  | frontend、AI、Spreadsheet                          |
| ScenarioPackageVersion          | ScenarioPackageCommandService            | compiler、Course/Run binder、Teacher safe read | legacy Store、frontend、AI memory                  |
| PluginReleaseVersion            | Plugin Release Authority                 | Run binder、runtime adapter                    | frontend、AI、unapproved plugin                    |
| FormalRunRuntimeBinding         | Formal Run Binder                        | runtime resolver、Replay evidence              | Teacher UI direct write、Student、AI               |
| DecisionBatch                   | Decision service / canonical submit path | Simulation Core                                | role draft、AI、Stakeholder proposal               |
| ReplayReport                    | Replay service                           | Teacher safe view、audit                       | settlement writer、provider re-run                 |
| Learning Evidence Confirmation  | Teacher Confirmation Service（L1+）      | Student report、AoL                            | LLM final grade、Business Score writer             |

### 9.2 Single Active Authority

L1 必须证明：

- 默认 repository provider 是 JSON；
- PostgreSQL 不 active；
- 不 dual-write；
- 不 shadow-write；
- 不 silent fallback；
- provider failure 不切换到第二 authority；
- command path 不绕过批准的 repository / authority 边界；
- runtime source 与 Known Limits 一致。

### 9.3 Exact Binding

Formal Run 创建必须验证：

- `scenario_package_id + version + content_digest + tenant_id`；
- `parameter_set_id + version + content_digest`；
- `plugin_package_id + version + content_digest`；
- engine reference；
- seed；
- compatibility；
- approval / availability；
- append-only binding；
- fail closed；
- missing identity 不创建 legacy Run。

### 9.4 Student Visibility

Student 任何 surface 都不得出现：

- `state_true`；
- `market_share_true`；
- raw Truth-L1–L3；-完整 `RunManifest`；
- private ParameterSet values；
- raw model coefficients / instruments / node set；
- `canonical_evidence_digest`；
- `decision_batch_hash`；
- `json_runtime_source_digest`；
- `binding_digest`；
- `formal_resolution_digest`；-其他 team / tenant 数据；
- Teacher / Admin authority metadata；
- raw Stakeholder private memory。

验证范围必须覆盖：

- shared contracts；
- schema；
- OpenAPI；
- handler；
- BFF；
- UI；
- error envelope；
- log；
- export；
- browser network response。

任何一处 breach 都是硬 FAIL。

---

## 10. L1 Golden Product Journey

### 10.1 唯一主链

```text
Teacher / Admin authentication
→ tenant / course / team scope
→ load synthetic approved authority assets
→ create Formal Run with exact refs
→ open round
→ Student onboarding
→ Student / Team canonical Decision
→ validation
→ lock
→ Truth-L1
→ Truth-L2
→ SettlementResult / Score / Rank
→ publish
→ Teacher projection
→ Student safe projection
→ Three-Part Feedback / Learning Report
→ Official Replay evidence
→ replay non-overwrite
→ abort / reset / cleanup auxiliary path
→ zero residue
→ Evidence Pack
→ Known Limits disclosure
```

### 10.2 每一步的阶段属性

| Step                     | L1 属性       | 完成证明                                  |
| ------------------------ | ------------- | ----------------------------------------- |
| Authentication           | `L1_REQUIRED` | positive + negative auth tests            |
| tenant/course/team scope | `L1_REQUIRED` | cross-tenant/course/team negative         |
| exact formal assets      | `L1_REQUIRED` | immutable exact refs                      |
| Formal Run create        | `L1_REQUIRED` | binding persisted, fail closed            |
| Open round               | `L1_REQUIRED` | lifecycle state transition                |
| Student onboarding       | `L1_REQUIRED` | team-scoped cockpit                       |
| Whole-team decision      | `L1_REQUIRED` | canonical Decision                        |
| Full role draft/merge    | `L1_PLUS`     | deferred unless claimed                   |
| Lock                     | `L1_REQUIRED` | no late submit                            |
| Settlement               | `L1_REQUIRED` | one authoritative result in L1 scope      |
| Publish                  | `L1_REQUIRED` | projection becomes visible                |
| Teacher result           | `L1_REQUIRED` | safe operational summary + replay summary |
| Student result           | `L1_REQUIRED` | private fields absent                     |
| Minimal learning report  | `L1_REQUIRED` | feedback loop                             |
| Rubric / confirmation    | `L1_PLUS`     | deferred                                  |
| Replay                   | `L1_REQUIRED` | official result unchanged                 |
| Abort / reset / cleanup  | `L1_REQUIRED` | zero residue / approved residue           |
| Evidence Pack            | `L1_REQUIRED` | complete current SHA package              |
| Human session            | `L2`          | not required for L1                       |

### 10.3 Golden M1 Identity

最终 L1 Evidence Pack 必须冻结：

- `golden_id`；
- source SHA；
- scenario exact ref；
- parameter exact ref；
- plugin exact ref；
- engine exact ref；
- seed；
- course / team fixture；
- decision payload；
- expected state transitions；
- expected public result digest；
- expected private evidence digest；
- Student projection schema；
- replay evidence；
- cleanup expectation；
- tolerance；
- invalidation triggers。

Golden M1 不得只依赖人类记忆中的“标准场景”。

---

## 11. L1 Persona Acceptance Criteria

### 11.1 Teacher

Teacher 必须能够：

- 登录批准 tenant；-打开或创建 L1 synthetic Run；-看到 exact scenario / parameter / plugin identity 的安全摘要；
- Open round；-查看 team submission status；
- Lock；
- Settle；
- Publish；-查看 Teacher result；-查看 Replay summary；-查看 Known Limits；-执行允许的 abort / reset / cleanup；-获取 Evidence / audit export 或其 L1 最小等价物。

Teacher 不得：

-直接改 Truth；-直接改 SettlementResult；-修改冻结 ParameterSet / ScenarioPackage；-绕过 validation；-以 UI 修改 formal binding；-把 local draft selection 当作 Run binding。

### 11.2 Student

Student 必须能够：

-登录并进入被授权的 tenant / course / team；-查看当前 round；-填写并提交 canonical decision；-接收 validation error；-在 lock 后不能再提交；-等待发布；-查看自己的安全结果；-查看 Three-Part Feedback / minimal Learning Report；-看不到 private evidence 和其他 team 数据；-在失败状态下获得非泄漏错误信息。

### 11.3 Tenant Admin

Tenant Admin 必须能够：

-查看本 tenant 的 scoped summary；-查看 L1 session / cleanup 状态；-查看 Known Limits；-执行被授权的 synthetic lifecycle operation；-不得跨 tenant；-不得写 Truth / Score；-不得读取 Student private evidence 以外的越权内容。

### 11.4 Platform Admin

Platform Admin 必须能够：

-查看 platform-level authority / runtime mode；-识别 active authority；-识别 Known Limits；-审计 synthetic lifecycle；-不得通过普通 UI 改 formal Truth；-高风险 operation 必须在 Owner scope 内。

---

## 12. L1 Domain Definition of Done

以下条目是规范性 `L1-DOD`。

### 12.1 Current Reality and Engineering Baseline

#### L1-DOD-001 — Current Source Identity

- **Capability：** current source frozen；
- **Why Required：** 所有证据必须绑定精确 source；
- **Boundary：** 不接受历史 SHA；
- **Required Runtime State：** default branch 与 master 明确；
- **Acceptance Test：** 读取 default branch、master、parents、open PR；
- **Negative Test：** SHA 漂移后旧 Evidence Pack 失效；
- **Required Evidence：** Current Reality Record；
- **PASS：** exact SHA 可认证且无未评估 merge candidate；
- **FAIL：** source 与声明不一致；
- **UNKNOWN：** 无法读取 GitHub；
- **Allowed Known Limit：** 无；
- **Owner：** Engineering Lead；
- **Expiry：** 新 commit；
- **Current Status：** `CURRENT_GITHUB_FACT / IMPLEMENTED`，当前 master 已认证；完整 L1 仍未据此通过。

#### L1-DOD-002 — Fresh Clone Reproducibility

- **Capability：** clean detached clone；
- **Acceptance：** `npm ci`、clean status、correct Node/npm；
- **Negative：** lockfile mismatch / dirty residue；
- **PASS：** fresh clone 可安装且工作树保持 clean；
- **Current Status：** `UNKNOWN`，本次评审环境未能完成 clone。

#### L1-DOD-003 — Static and Build Baseline

必须通过：

- hidden Unicode；
- direct-store boundaries；
- lint；
- typecheck；
- contract；
- unit / integration；
- build；
- security audit；
- `git diff --check`。

**Current Status：** scripts 和 CI source 已存在；当前 master 的本次独立执行结果 `UNKNOWN`。

#### L1-DOD-004 — Browser Product Baseline

- **Acceptance：**完整 Playwright L1 persona journey；
- **Negative：** Student private field、cross-tenant、mobile overflow、stale session；
- **PASS：** 0 非批准失败；skip 必须有精确 Gate；
- **Current Status：** CI workflow 包含 `test:e2e:ui`；本次未取得 current master 浏览器执行证据。

#### L1-DOD-005 — Merge and Post-Merge Receipt

- **Acceptance：** exact-head merge + current master receipt + post-merge fresh clone；
- **PASS：** merge commit、tree、tests、clean workspace 一致；
- **Current Status：** latest merge 已认证；post-merge current master full receipt `UNKNOWN`。

#### L1-DOD-006 — Branch Policy

- **Acceptance：** 禁止 direct push / force push，required checks 与 review policy 可读；
- **PASS：** policy 与 L1 merge protocol 一致；
- **Current Status：** `UNKNOWN`，当前可用 GitHub connector 未暴露 branch protection readback。

### 12.2 Identity, Tenant, Team and Role

#### L1-DOD-007 — Authentication

- positive Teacher / Student / Admin login；
- invalid credentials fail closed；
- token absence / expiry fail closed；-错误 envelope 不泄漏 credentials。

#### L1-DOD-008 — Tenant Isolation

- tenant derived from authenticated context；
- client header 不得提升 authority；-跨 tenant route、BFF、log、export 均拒绝；
- breach = hard FAIL。

#### L1-DOD-009 — Course Membership Visibility

-普通用户只能看到获授权 course；

- teacher / admin visibility 明确；
- cross-course negative；
- **Current Status：** open Issue #112 指向历史缺口；当前 source closure 未在本次重验，状态 `UNKNOWN / L1_BLOCKER_CANDIDATE`。

#### L1-DOD-010 — Team Isolation

- Student 只能提交和读取自己的 team；
- wrong team / missing team / other team result 失败；
- Team Captain 不能扩大 tenant authority。

#### L1-DOD-011 — Minimal Role Enforcement

- L1 最小角色：Teacher、Student、Tenant Admin、Platform Admin；
- whole-team decision path 权限必须在后端；-完整 role draft / merge workflow 可延后 L1+；
- **Current Status：** minimal roles source 存在；current runtime evidence 未重验。

### 12.3 Run Lifecycle

#### L1-DOD-012 — Formal Run Create

- exact formal references；
- approved / available authorities；
- binding persisted；
- missing identity fail closed；-不得创建 legacy Run 作为 fallback；
- **Current Source：** 当前集成测试包含 default persisted authorities create 与 fail-closed path；
- **Current Status：** `IMPLEMENTED_NOT_CURRENTLY_REEXECUTED`。

#### L1-DOD-013 — Open / Start

-只能从合法状态 start；-重复 start 语义明确；

- unauthorized start 失败。

#### L1-DOD-014 — Lock

- lock 后拒绝 late submit；
- lock snapshot 与 decision batch digest 固定；-重复 lock 幂等或明确失败。

#### L1-DOD-015 — Settle

-只能在 locked state；-由 Simulation Core 正式计算；-返回唯一 L1-scope authoritative result；-错误不会产生 partial published result。

#### L1-DOD-016 — Publish

-只能发布已成功 settlement；-发布后 Student projection 可见；-失败/未 settle 不可发布；-重复 publish 语义明确。

#### L1-DOD-017 — Terminal and Invalid Transitions

必须测试：

- settle before lock；
- publish before settle；
- submit after lock；
- reset published official result；
- abort illegal state；
- wrong round；
- wrong run；
- duplicate action。

### 12.4 Decision Lifecycle

#### L1-DOD-018 — Canonical Whole-Team Decision

- L1 至少支持一个合法 canonical Decision；
- schema / business validation；
- decision actor / team / run / round 绑定；-不存在 role draft 进入 settlement。

#### L1-DOD-019 — Decision Negative Matrix

必须覆盖：

- invalid payload；
- missing field；
- out-of-range；
- duplicate submit；
- late submit；
- wrong tenant；
- wrong course；
- wrong team；
- wrong round；
- locked round；
- partial decision；
- forged actor / header。

#### L1-DOD-020 — Role Workflow Deferral Contract

-完整 Role Workflow 标记 `DEFERRED_TO_L1_PLUS`；-不得在 UI 声称已完成；-若 active UI 已展示角色草稿，则必须提升为 blocker；

- Issue #119 不自动阻断默认 L1 whole-decision path。

### 12.5 Truth and Settlement

#### L1-DOD-021 — Truth Sole Writer

- import / route / command scan；
- Plugin / AI / BLP / frontend negative；
- Simulation Core 是唯一 formal commit；
- breach = hard FAIL。

#### L1-DOD-022 — Formal Authority Sole Writer

- ParameterSet、ScenarioPackage、Plugin Release、Formal Binding writer 分离；
- no direct legacy mutation；
- no second authority；
- no automatic latest。

#### L1-DOD-023 — Settlement Single Result in L1 Scope

-同一 `tenant + run + round` 的合法重试不能产生冲突 official results；

- concurrent attempt 语义可证明；
- current JSON in-process scope 与 durable business idempotency 必须区分；
- Issue #111 的 durable / cross-process部分可作为 higher-stage blocker，但 L1 至少要有 targeted same-process test。

#### L1-DOD-024 — No Durable Overclaim

- JSON result 不得称 durable；
- Postgres replay harness 不等于 active authority；
- adapter parity 不等于 production settlement。

### 12.6 Projection and Visibility

#### L1-DOD-025 — Teacher Projection

- Teacher 获取操作和复盘所需信息；-不得暴露不必要的 private binding internals；
- current formal binding test应继续验证 `binding_digest` / `formal_resolution_digest` 不进入普通 Teacher result。

#### L1-DOD-026 — Student Projection

-只包含 student-safe result；-不含 replay private evidence；-不含 formal binding digests；-不含 other team；-任何 leak = hard FAIL。

#### L1-DOD-027 — Error / Log / Export Projection

-安全要求不能只在 UI；

- error envelope、audit log、export、network response 统一 allowlist；
- contract parity 必须覆盖 L1 routes；
- Issue #115 需要 current executable closure 或 scoped L1 exception。

### 12.7 Golden M1

#### L1-DOD-028 — Golden M1 Frozen Identity

-正式 ID、refs、seed、decision、expected digest；-禁止依赖“latest”；-变更必须新版本。

#### L1-DOD-029 — Default Runtime Full Chain

必须在**不注入测试 authority ports**的默认 JSON runtime 上完成：

```text
persisted approved authorities
→ Formal Run create
→ open
→ decision
→ lock
→ settle
→ publish
→ projections
→ Replay evidence
```

当前 source 的测试分别证明了：

- default persisted authority 可创建 Formal Run；
- injected authority ports 可完成 settle / publish / Replay evidence。

最终 L1 必须增加或识别一条**默认 persisted authority + full chain**的单一测试。
**Current Status：** `L1_BLOCKER_CANDIDATE`。

#### L1-DOD-030 — Determinism / Parity

-相同 exact binding、seed、decision 输出稳定；-允许 tolerance 必须版本化；
-Student projection 稳定；

- replay digest 可重复。

### 12.8 Replay and Evidence

#### L1-DOD-031 — Official Replay Non-Overwrite

- Replay 不修改 official result；-历史 manifest / input 锁定；-新模型或新 provider 只能形成 non-official differential。

#### L1-DOD-032 — Private / Public Evidence Separation

- private manifest 可含 binding / resolution；
- public view 只含批准摘要与 canonical public evidence；
- Student 不得看到 replay evidence internals。

#### L1-DOD-033 — Replay Is Not Recovery

- Known Limits 明示；-不以 replay 证明 backup / restore；
- recovery 进入 F7 / G3。

### 12.9 Abort, Reset and Cleanup

#### L1-DOD-034 — Abort

-允许状态、授权角色、结果语义明确；-不能覆盖 published official result；-产生 audit evidence。

#### L1-DOD-035 — Reset

-只对批准的 synthetic session；

- reset 后不残留污染；-不得改历史 official result；-重新运行 Golden M1 可通过。

#### L1-DOD-036 — Cleanup

必须证明：

- session / token cleanup；
- temporary data cleanup；
- browser context cleanup；
- aborted run residue；
- partial decision residue；
- temporary schema / client cleanup（若测试使用 PG）；-工作区 clean；
- zero residue 或批准的 append-only audit residue。

#### L1-DOD-037 — Failure Injection

至少覆盖：

- validation failure；
- persistence failure；
- settlement failure；
- interrupted server；
- duplicate command；
- browser disconnect；
- incomplete team；
- cleanup retry；-不可用 external service 不得影响 L1 默认路径。

### 12.10 Known Limits

#### L1-DOD-038 — Known Limits Projection

Teacher / Student / Admin 必须看到与角色一致的 Known Limits。
Known Limits 不得只存在于治理文档。

#### L1-DOD-039 — Known Limits Register

每项必须有：

- ID；
- scope；
- owner；
- expiry；
- revalidation；
- user-facing copy；
- evidence link。

#### L1-DOD-040 — No Higher-Stage Claim

L1 输出、README、UI、PR、发布说明中不得出现未经证明的：

- Pilot-ready；
- Production-ready；
- durable；
- recovered；
- human validated；
- AI effective；
- BLP approved active；
- Stage 4B human-like。

### 12.11 Evidence and Owner Closure

#### L1-DOD-041 — L1 Completion Evidence Pack

必须完整生成第 15 章定义的 Evidence Pack。

#### L1-DOD-042 — Current Gap Zero / Accepted

- L1 blockers = 0；
- applicable Gate UNKNOWN = 0；
- Known Limits 均有 Owner 和 expiry；
- boundary breach = 0。

#### L1-DOD-043 — Owner Acknowledgment

Owner 必须确认：

- scope；
- current SHA；
- runtime mode；
- Known Limits；
- non-proofs；
- expiry；
- next legal stage。

---

## 13. Platform Gate P-G0–P-G8 Mapping

| Gate | L1 Applicability | Required Capability            | Required Evidence                            | PASS                    | PASS_WITH_LIMITS                    | FAIL                     | UNKNOWN                    | Current Status      |
| ---- | ---------------- | ------------------------------ | -------------------------------------------- | ----------------------- | ----------------------------------- | ------------------------ | -------------------------- | ------------------- |
| P-G0 | 必须             | current governance/source/CI   | master、policy、CI、fresh clone              | 全部 current            | 非关键治理限制有 Owner              | source/CI不一致          | 任一关键事实不可读         | `UNKNOWN`           |
| P-G1 | 必须             | Truth/authority/immutability   | writer scan、exact binding、negative         | 0 breach                | 批准 exception 不涉及 formal writer | second writer / fallback | scan 未执行                | `UNKNOWN`           |
| P-G2 | 必须             | tenant/role/Student visibility | contract/runtime/browser/log/export negative | 0 leak                  | 非核心角色能力延后                  | 任一 leak                | #112/测试未闭合            | `UNKNOWN`           |
| P-G3 | 必须             | value-chain product flow       | Teacher/Student/Admin + Golden M1            | default full chain pass | approved UI limitation              | 链路失败                 | current journey 未执行     | `UNKNOWN`           |
| P-G4 | 必须             | Replay/Evidence/non-overwrite  | digest、history、public/private              | pass                    | evidence export形式受限             | official overwritten     | current full replay 未执行 | `UNKNOWN`           |
| P-G5 | 必须             | lifecycle/cleanup/failure      | abort/reset/cleanup/zero residue             | pass                    | 批准的 append-only residue          | 污染或不可重跑           | current closure 未执行     | `UNKNOWN`           |
| P-G6 | 非 L1 blocker    | durability/recovery            | higher-stage evidence                        | N/A                     | L1 Known Limit                      | 在 L1 假称完成           | N/A                        | `OUT_OF_L1_SCOPE`   |
| P-G7 | 非 L1 blocker    | staging/operations             | L2/L3 evidence                               | N/A                     | N/A                                 | L1越权部署               | N/A                        | `DEFERRED_TO_L2/L3` |
| P-G8 | 必须用于最终声明 | Owner Go/No-Go                 | scope、Known Limits、expiry                  | APPROVED                | approved with limits                | REJECTED                 | 未签署                     | `NOT_STARTED`       |

### 13.1 Gate 决策规则

- P-G0—P-G5 和 P-G8 是 L1 完成的核心 Gate；
- P-G6 未完成可以作为 L1 Known Limit，不得被写为 PASS；
- P-G7 属于更高阶段；-任一 P-G0—P-G5 `UNKNOWN` 阻止 L1 PASS；
- P-G8 不得替代技术证据。

---

## 14. L1 Validation Pyramid

### 14.1 Level 1 — Contract / Schema

- OpenAPI；
- JSON Schema；
- shared TypeScript contract；
- handler mapping；
- lifecycle；
- digest；
- tenant；
- visibility allowlist。

### 14.2 Level 2 — Unit / Property

- state machine；
- canonicalization；
- deterministic digest；
- invalid transitions；
- projection field allowlist；
- failure rollback。

### 14.3 Level 3 — Integration

- Scenario / Parameter / Plugin → Formal Run；
- default persisted authorities；
- Decision → Settlement；
- runtime resolver；
- public/private Replay evidence；
- repository provider boundaries。

### 14.4 Level 4 — Product Journey

- Teacher；
- Student；
- Tenant Admin；
- Platform Admin；
- positive / negative；
- mobile / narrow viewport；
- refresh / session reset；
- network payload inspection。

### 14.5 Level 5 — Failure and Cleanup

- persistence failure；
- duplicate / concurrent action；
- interrupted lifecycle；
- abort / reset；
- zero residue；
- rerun Golden M1。

### 14.6 Level 6 — Fresh Clone / Remote / Post-Merge

- fresh clone；
- `npm ci`；
- full suite；
- build；
- CI / CodeQL；
- exact-head；
- post-merge receipt；
- clean workspace。

### 14.7 分层执行命令建议

```text
RED:
focused unit / integration test

GREEN:
focused tests + typecheck + diff check

PR:
lint + typecheck + contract + affected + target E2E + build

CI:
full test + browser + CodeQL + security/boundary

CLOSURE:
fresh clone + full suite + build + browser + clean status
```

这只是执行阶梯，不构成独立完成标准；以实际仓库脚本为准。

---

## 15. L1 Completion Evidence Pack

### 15.1 Pack 内容

| Evidence ID | 内容                                   |
| ----------- | -------------------------------------- |
| L1-EV-001   | Current Reality Record                 |
| L1-EV-002   | exact master SHA / parents             |
| L1-EV-003   | source / scope freeze                  |
| L1-EV-004   | runtime authority record               |
| L1-EV-005   | dependency / lockfile digest           |
| L1-EV-006   | Golden M1 identity                     |
| L1-EV-007   | Teacher journey                        |
| L1-EV-008   | Student journey                        |
| L1-EV-009   | Admin journey                          |
| L1-EV-010   | Truth / Authority writer matrix        |
| L1-EV-011   | tenant / course / team / role negative |
| L1-EV-012   | Decision lifecycle                     |
| L1-EV-013   | Settlement single-result evidence      |
| L1-EV-014   | Replay non-overwrite                   |
| L1-EV-015   | public/private evidence separation     |
| L1-EV-016   | Abort / Reset / Cleanup                |
| L1-EV-017   | full test matrix                       |
| L1-EV-018   | browser artifacts                      |
| L1-EV-019   | security / boundary evidence           |
| L1-EV-020   | Known Limits Register                  |
| L1-EV-021   | unresolved issue disposition           |
| L1-EV-022   | mutation / activation ledger           |
| L1-EV-023   | fresh clone receipt                    |
| L1-EV-024   | post-merge receipt                     |
| L1-EV-025   | Owner acknowledgment                   |

### 15.2 Evidence 元数据

每项证据必须包含：

```text
Evidence ID
Produced At
Source SHA
Environment
Runtime Authority
Command / Procedure
Result
Digest
Owner
Scope
Expiry
Invalidation Trigger
Known Limit References
```

### 15.3 Evidence Lean

不得为每个测试生成独立治理 Mission。Evidence Pack 应自动汇总：

- source；-命令；-结果；-摘要；-关键 artifact；-失败；-限制。

---

## 16. PASS / FAIL / UNKNOWN Decision Rules

### 16.1 PASS

只有同时满足以下条件：

-全部 `REQUIRED_FOR_L1` 通过；

- P-G0—P-G5 全部 PASS 或批准的 PASS_WITH_LIMITS；
- P-G8 APPROVED；
- boundary breach = 0；
- blocker = 0；
- UNKNOWN = 0；
- current fresh clone closure；
- Evidence Pack 完整。

### 16.2 PASS_WITH_LIMITS

可以接受的典型 L1 Limit：

- JSON internal only；
- no durable settlement；
- no recovery；
- synthetic only；
- no Human Validation；
- no Pilot；
- no Production；
- no AI；
- no BLP active；
- no Stage 4B；
- no billing；
- no SLO / SLA。

但每项必须绑定：

- Owner；
- scope；
- expiry；
- user-facing disclosure；
- revalidation；
- next Gate。

### 16.3 FAIL

任一情况直接 FAIL：

- Truth 非法写入；
- second authority；
- JSON / PG dual-write；
- silent fallback；
- Student private field泄漏；-跨 tenant / team；
- official Replay 覆盖；
- unresolved cleanup contamination；
- Golden M1 不可重复；
- pending/unknown 被伪装成 pass；-未授权 Pilot / Production / real data；-缺少 Owner 的不可逆动作。

### 16.4 UNKNOWN

以下情况必须 UNKNOWN：

- current master 无法认证；
- current tests 无法执行；
- branch / runtime事实不可读且属于适用 Gate；
- source 与 report 冲突；-只存在历史证据；
- test skipped 且无批准 Gate；
- issue 声称修复但未 current revalidate；
- merge commit 未做 required closure。

### 16.5 NOT_ASSESSED

定义文档可以审批，但当前能力尚未执行正式 L1 assessment 时使用。
`NOT_ASSESSED` 不等于 `UNKNOWN` 的技术失败；它表示评审尚未完成。

---

## 17. Current Capability Rebaseline

### 17.1 Current GitHub Facts

| Fact                             | Current Value                              | Evidence Class        | Judgment             |
| -------------------------------- | ------------------------------------------ | --------------------- | -------------------- |
| Repository                       | `qidianzhiku/SimWar`                       | `CURRENT_GITHUB_FACT` | current              |
| Default branch                   | `master`                                   | `CURRENT_GITHUB_FACT` | current              |
| Current master                   | `1b97e1e6e067e414fa796c04f8b56064ce10c1b3` | `CURRENT_GITHUB_FACT` | current              |
| Latest merge                     | PR #260                                    | `CURRENT_GITHUB_FACT` | merged               |
| PR #260 head                     | `7704c496655c4b68bb19c8bb1675fad4c82202ae` | `CURRENT_GITHUB_FACT` | exact                |
| Open PR count                    | 0                                          | `CURRENT_GITHUB_FACT` | current at readback  |
| PR #260 head CI                  | CI success                                 | `CURRENT_GITHUB_FACT` | exact head           |
| PR #260 head CodeQL              | success                                    | `CURRENT_GITHUB_FACT` | exact head           |
| Merge-commit post-merge workflow | 未取得                                     | `UNKNOWN`             | evidence gap         |
| Branch protection / ruleset      | 未取得                                     | `UNKNOWN`             | evidence gap         |
| Local CodexPro workspace         | connector network failure                  | `UNKNOWN`             | not used as evidence |
| Fresh clone current master       | environment network unavailable            | `UNKNOWN`             | not assessed         |

### 17.2 Current Source Facts

| Capability                     | Current Source Observation                                                                        | Status                |
| ------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------- |
| package scripts                | lint、typecheck、test、e2e、contract、build、security、hidden Unicode、direct-store boundary 存在 | `CURRENT_SOURCE_FACT` |
| CI                             | master push + PR；quality + Postgres replay report + browser smoke                                | `CURRENT_SOURCE_FACT` |
| CodeQL                         | master push + PR + schedule；security-and-quality                                                 | `CURRENT_SOURCE_FACT` |
| default repository provider    | `createJsonRepositoryProvider`                                                                    | `CURRENT_SOURCE_FACT` |
| default store                  | JSON file / P1 store                                                                              | `CURRENT_SOURCE_FACT` |
| formal authorities             | persisted ParameterSet / ScenarioPackage / PluginRelease composed by default                      | `CURRENT_SOURCE_FACT` |
| formal Run fail closed         | source test verifies missing exact identities create no legacy Run                                | `CURRENT_TEST_SOURCE` |
| default formal create          | source test verifies persisted authorities create Formal Run                                      | `CURRENT_TEST_SOURCE` |
| full settle / publish / Replay | source test exists with injected authority ports                                                  | `CURRENT_TEST_SOURCE` |
| Student formal private data    | source test asserts no binding / resolution digest and no replay evidence                         | `CURRENT_TEST_SOURCE` |
| Teacher source                 | Run / Known Limits / Scenario catalog product code present                                        | `CURRENT_SOURCE_FACT` |
| Student source                 | Decision / Cockpit / Known Limits product code present                                            | `CURRENT_SOURCE_FACT` |
| Admin source                   | summary / lifecycle controls / Known Limits code present                                          | `CURRENT_SOURCE_FACT` |

### 17.3 Current Issue Facts

Open L1-relevant Issue 包括：

- #111 settlement idempotency / concurrency；
- #112 course membership visibility；
- #114 direct store bypass；
- #115 executable contract parity；
- #116 CI / documented gate alignment；
- #119 role-based lifecycle；
- #120 audit tracker。

Higher-stage / PostgreSQL 相关：

- #113 tenant-scoped PG referential integrity；
- #118 explicit PostgreSQL provider mode。

这些 Issue 的 body 可能基于历史 audit baseline。Issue “仍开放”是 current fact；Issue 中描述的具体缺陷是否仍存在，需要 current-source revalidation，不能仅凭标题判定。

### 17.4 Current Inferences

1. #116 的部分历史描述可能已被 current source 改进：CI 已包含 hidden Unicode、direct-store、full tests、Postgres replay、contract、build 和 browser；CodeQL 已监听 master。
   但 Issue 未关闭，因此需要正式 closure readback，而不是自动判定完成。
2. PR #260 解决了“默认 JSON runtime 无正式 authority composition”的关键缺口。
3. 当前 integration test 仍把“default persisted authority create”和“injected authority full chain”分成不同测试。L1 应要求 default persisted authority 完整链。
4. 当前 source 证明产品面和测试资产存在，但不能替代 current master fresh execution。

### 17.5 Current Capability Verdict

```text
Current L1 Capability Status:
NOT_ASSESSED
```

原因：

-本次没有 current master fresh clone / full suite；

- P-G0—P-G5 均存在至少一个未解决 evidence gap；-当前 Owner L1 acknowledgment 不存在。

---

## 18. Current L1 Gap Register

### 18.1 L1_BLOCKER

| Gap ID     | Capability                                    | Current State                                            | Required L1 State                                            | Why Blocks                                   | Evidence Missing                      | Suggested Bundle      | Tier  | PR Estimate | Owner Gate           | Does Not Require      | Priority |
| ---------- | --------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------- | ------------------------------------- | --------------------- | ----- | ----------: | -------------------- | --------------------- | -------- |
| L1-GAP-B01 | Default persisted authority full Golden chain | create-only default test；full chain uses injected ports | default JSON persisted authorities完成 create→publish→Replay | 当前默认 runtime 主链未由单一测试证明        | integration + browser + fresh clone   | B5 / Golden closure   | T3    |         0–1 | merge exact-head     | PG、AI、Stage4B       | P0       |
| L1-GAP-B02 | Course membership visibility                  | #112 open；current closure未重验                         | course membership / visibility negative pass                 | P-G2 必须无越权                              | current source + API/browser negative | L1 visibility closure | T3    |         0–1 | security/merge       | Role Workflow full UI | P0       |
| L1-GAP-B03 | Repository / direct-store authority boundary  | #114 open；guard exists但 current exception set未审      | L1 command/truth paths无未批准 bypass                        | sole writer / single authority hard boundary | current manifest + route/import scan  | L1 authority closure  | T3    |         0–1 | architecture/merge   | PostgreSQL activation | P0       |
| L1-GAP-B04 | L1 route executable contract parity           | #115 open；contract script exists                        | L1 routes handler/OpenAPI/schema/shared contract一致         | Student/Error/Projection安全要求             | scoped executable parity matrix       | L1 contract closure   | T2/T3 |         0–1 | contract owner/merge | 全仓所有 future API   | P0       |

### 18.2 L1_EVIDENCE_GAP

| Gap ID     | Capability                                      | Missing Evidence                                     | Classification    | Priority |
| ---------- | ----------------------------------------------- | ---------------------------------------------------- | ----------------- | -------- |
| L1-GAP-E01 | current master fresh clone                      | npm ci + full suite + build + browser + clean status | `L1_EVIDENCE_GAP` | P0       |
| L1-GAP-E02 | merge commit post-merge receipt                 | exact merge SHA workflow / fresh closure             | `L1_EVIDENCE_GAP` | P0       |
| L1-GAP-E03 | branch policy                                   | branch protection / ruleset readback                 | `L1_EVIDENCE_GAP` | P1       |
| L1-GAP-E04 | abort/reset/cleanup                             | current master failure matrix + zero residue         | `L1_EVIDENCE_GAP` | P0       |
| L1-GAP-E05 | settlement retry / concurrency in L1 JSON scope | same-process targeted tests and disposition of #111  | `L1_EVIDENCE_GAP` | P1       |
| L1-GAP-E06 | current browser Golden Product Journey          | Teacher/Student/Admin current SHA artifacts          | `L1_EVIDENCE_GAP` | P0       |
| L1-GAP-E07 | Issue #116 closure                              | current source-to-issue mapping                      | `L1_EVIDENCE_GAP` | P1       |
| L1-GAP-E08 | Completion Evidence Pack                        | all L1-EV artifacts                                  | `L1_EVIDENCE_GAP` | P0       |
| L1-GAP-E09 | Owner acknowledgment                            | signed L1 scope / limits / expiry                    | `L1_EVIDENCE_GAP` | P0       |

### 18.3 L1_KNOWN_LIMIT

| ID        | Known Limit                         | Scope                                          | Owner            | Expiry / Revalidation       |
| --------- | ----------------------------------- | ---------------------------------------------- | ---------------- | --------------------------- |
| KL-L1-001 | JSON_INTERNAL_ONLY                  | all L1 runs                                    | Architecture     | provider / authority change |
| KL-L1-002 | no durable settlement               | official L1 result only in approved JSON scope | Platform         | F6                          |
| KL-L1-003 | no backup / restore / recovery      | all L1                                         | Platform         | F7 drill                    |
| KL-L1-004 | no Human Validation                 | automation only                                | Product          | L2 study                    |
| KL-L1-005 | no Controlled Pilot                 | internal synthetic only                        | Owner            | G Go/No-Go                  |
| KL-L1-006 | no Production                       | no external customers / traffic                | Owner            | H Go/No-Go                  |
| KL-L1-007 | no external AI effectiveness        | AI off/inactive                                | AI Owner         | controlled beta             |
| KL-L1-008 | no BLP formal active claim          | stable/default approved L1 model only          | Model Owner      | M-G4/M-G6                   |
| KL-L1-009 | no Stage 4B runtime/fidelity claim  | Plane OFF / inactive                           | STK Owner        | STK-G4/G5                   |
| KL-L1-010 | no real customer / real-person data | synthetic/anonymized                           | Data Owner       | separate data Gate          |
| KL-L1-011 | no billing / entitlement            | non-commercial                                 | Commercial Owner | H4                          |
| KL-L1-012 | no SLO / SLA                        | internal validation                            | Platform         | F8/H1                       |

### 18.4 L1_PLUS_BACKLOG

共 14 项：

1. Generic Scenario Compiler；2.完整 Scenario publish / retire authoring；
2. CourseBlueprint immutable versioning；
3. Teacher Blueprint Studio；
4. full Role Workflow；
5. Instructor Kit；
6. Course clone；
7. reusable Course export；
8. Learning Goal Registry；
9. Rubric Runtime；
10. Teacher Confirmation Workbench；
11. AoL / xAPI export；
12. Governed AI Teacher Review；
13. BLP / Model safe product integration或 Stage 4B safe feed中的后续可选项（不得成为默认 L1 依赖）。

### 18.5 NON_BLOCKING_SUPPORT_LINE

- Program M formal rebaseline；
- BLP Reference / Shadow；
- Stage 4B S0/S1；
- tool / framework TFR；
- PostgreSQL discovery；
- dependency cleanup。

前提：不得抢占当前 L1 blocker 的 single mainline WIP，不得改变 active authority。

### 18.6 HIGHER_STAGE_DEFERRED

- PostgreSQL active provider；
- migrations；
- durable event / snapshot；
- durable settlement；
- recovery；
- staging；
- real users；
- real data；
- Controlled Pilot；
- Production；
- billing；
- SLO / SLA；
- Industry Portfolio。

---

## 19. L1 Completion Checklist

### 19.1 Scope and Definition

- [ ] Owner 已批准本 L1 定义；
- [ ] L1 与 L1+ 边界无争议；
- [ ] L1 active runtime 和 data scope 已签署；
- [ ] Known Limits 有 owner / expiry。

### 19.2 P-G0

- [ ] current master；
- [ ] open PR disposition；
- [ ] branch policy；
- [ ] CI / CodeQL exact SHA；
- [ ] fresh clone；
- [ ] clean workspace；
- [ ] post-merge receipt。

### 19.3 P-G1

- [ ] Truth sole writer；
- [ ] Authority sole writer；
- [ ] JSON single active；
- [ ] no silent fallback；
- [ ] no automatic latest；
- [ ] exact Formal Run binding；
- [ ] direct-store boundary pass；
- [ ] negative write tests。

### 19.4 P-G2

- [ ] authentication；
- [ ] tenant；
- [ ] course membership；
- [ ] team；
- [ ] role；
- [ ] Student projection；
- [ ] error；
- [ ] log；
- [ ] export；
- [ ] browser network negative；
- [ ] boundary breach = 0。

### 19.5 P-G3

- [ ] Teacher journey；
- [ ] Student journey；
- [ ] Admin journey；
- [ ] default persisted authority full Golden M1；
- [ ] Decision → Lock → Settlement → Publish；
- [ ] minimal feedback / learning report。

### 19.6 P-G4

- [ ] official Replay；
- [ ] no overwrite；
- [ ] public/private separation；
- [ ] digest reproducibility；
- [ ] provider calls符合 L1 scope；
- [ ] Replay not Recovery disclosure。

### 19.7 P-G5

- [ ] abort；
- [ ] reset；
- [ ] cleanup；
- [ ] failure injection；
- [ ] zero residue；
- [ ] rerun Golden M1。

### 19.8 Evidence / Owner

- [ ] Evidence Pack 25 项完整；
- [ ] blocker = 0；
- [ ] applicable UNKNOWN = 0；
- [ ] Known Limits acknowledged；
- [ ] Owner acknowledgment；
- [ ] completion statement 只覆盖 L1。

---

## 20. Owner Decision and Sign-Off

### 20.1 Definition Approval

```text
Decision ID:
SIMWAR_L1_DEFINITION_APPROVAL_V1

Authorized Scope:
Approve the L1 Definition of Done only.

Does Not Authorize:
Current L1 completion claim;
ordinary merge;
runtime activation;
PostgreSQL;
migration;
durable settlement;
recovery;
external provider;
real data;
Controlled Pilot;
Production;
billing.

Required Owner Decision:
APPROVE / REVISE / REJECT
```

### 20.2 Completion Approval（未来）

```text
Decision ID:
SIMWAR_L1_COMPLETION_ACKNOWLEDGMENT_<SHA>

Required Inputs:
Approved L1 Definition;
Current Reality Record;
P-G0–P-G5 Evidence;
Known Limits Register;
Evidence Pack;
Boundary Breach Count = 0;
Blocker Count = 0;
UNKNOWN Count = 0.

Allowed Outcome:
PASS
PASS_WITH_LIMITS
FAIL
```

### 20.3 Sign-Off

| Role             | Name / Signature            | Date             | Decision                  |
| ---------------- | --------------------------- | ---------------- | ------------------------- |
| Project Owner    | Marshall / \***\*\_\_\*\*** | \***\*\_\_\*\*** | APPROVE / REVISE / REJECT |
| Chief Architect  | \***\*\_\_\*\***            | \***\*\_\_\*\*** | ACKNOWLEDGED              |
| Product Owner    | \***\*\_\_\*\***            | \***\*\_\_\*\*** | ACKNOWLEDGED              |
| Engineering Lead | \***\*\_\_\*\***            | \***\*\_\_\*\*** | ACKNOWLEDGED              |
| QA / Security    | \***\*\_\_\*\***            | \***\*\_\_\*\*** | ACKNOWLEDGED              |

---

# Appendix A — L1-DOD Requirement Matrix

| ID  | Capability               | L1 Class            | Primary Gate  | Hard Fail Trigger           | Current Status            |
| --- | ------------------------ | ------------------- | ------------- | --------------------------- | ------------------------- |
| 001 | Current Source Identity  | REQUIRED            | P-G0          | wrong/stale SHA             | current fact              |
| 002 | Fresh Clone              | REQUIRED            | P-G0          | cannot install/reproduce    | UNKNOWN                   |
| 003 | Static/Build Baseline    | REQUIRED            | P-G0          | required check fail         | UNKNOWN current execution |
| 004 | Browser Baseline         | REQUIRED            | P-G3          | journey/security fail       | UNKNOWN current execution |
| 005 | Post-Merge Receipt       | REQUIRED            | P-G0          | merge tree unverified       | UNKNOWN                   |
| 006 | Branch Policy            | REQUIRED            | P-G0          | unsafe direct mutation      | UNKNOWN                   |
| 007 | Authentication           | REQUIRED            | P-G2          | auth bypass                 | not reassessed            |
| 008 | Tenant Isolation         | REQUIRED            | P-G2          | cross-tenant                | not reassessed            |
| 009 | Course Membership        | REQUIRED            | P-G2          | unauthorized course         | blocker candidate         |
| 010 | Team Isolation           | REQUIRED            | P-G2          | cross-team                  | not reassessed            |
| 011 | Minimal Role             | REQUIRED            | P-G2          | role bypass                 | not reassessed            |
| 012 | Formal Run Create        | REQUIRED            | P-G1/P-G3     | fallback/invalid binding    | source implemented        |
| 013 | Open/Start               | REQUIRED            | P-G3          | invalid transition          | not reassessed            |
| 014 | Lock                     | REQUIRED            | P-G3          | late decision accepted      | not reassessed            |
| 015 | Settle                   | REQUIRED            | P-G3          | multiple conflicting result | not reassessed            |
| 016 | Publish                  | REQUIRED            | P-G3          | unpublished/invalid result  | not reassessed            |
| 017 | Invalid Transitions      | REQUIRED            | P-G3/P-G5     | illegal transition accepted | not reassessed            |
| 018 | Canonical Decision       | REQUIRED            | P-G3          | noncanonical input settles  | source present            |
| 019 | Decision Negative        | REQUIRED            | P-G2/P-G3     | scope/validation bypass     | not reassessed            |
| 020 | Role Deferral            | REQUIRED GOVERNANCE | P-G3          | UI overclaim                | deferred L1+              |
| 021 | Truth Sole Writer        | REQUIRED            | P-G1          | non-Core formal write       | blocker candidate         |
| 022 | Authority Sole Writer    | REQUIRED            | P-G1          | second writer/latest        | blocker candidate         |
| 023 | Settlement Single Result | REQUIRED L1 SCOPE   | P-G3/P-G5     | conflicting official result | evidence gap              |
| 024 | No Durable Overclaim     | REQUIRED            | P-G6 boundary | durable claim               | source/known limit        |
| 025 | Teacher Projection       | REQUIRED            | P-G2/P-G3     | private leak                | source present            |
| 026 | Student Projection       | REQUIRED            | P-G2          | private leak                | current test source       |
| 027 | Error/Log/Export         | REQUIRED            | P-G2          | private leak/drift          | blocker candidate         |
| 028 | Golden Identity          | REQUIRED            | P-G3/P-G4     | mutable/latest              | evidence gap              |
| 029 | Default Full Chain       | REQUIRED            | P-G3          | default path unproven       | blocker candidate         |
| 030 | Determinism              | REQUIRED            | P-G3/P-G4     | digest drift                | evidence gap              |
| 031 | Replay Non-Overwrite     | REQUIRED            | P-G4          | official overwritten        | source tests exist        |
| 032 | Evidence Separation      | REQUIRED            | P-G2/P-G4     | Student private evidence    | source test exists        |
| 033 | Replay Not Recovery      | REQUIRED GOVERNANCE | P-G4/P-G6     | recovery overclaim          | Known Limit               |
| 034 | Abort                    | REQUIRED            | P-G5          | corrupt official state      | evidence gap              |
| 035 | Reset                    | REQUIRED            | P-G5          | history overwrite/residue   | evidence gap              |
| 036 | Cleanup                  | REQUIRED            | P-G5          | residue                     | evidence gap              |
| 037 | Failure Injection        | REQUIRED            | P-G5          | partial corruption          | evidence gap              |
| 038 | Known Limits Projection  | REQUIRED            | P-G3/P-G8     | missing disclosure          | source present            |
| 039 | Known Limits Register    | REQUIRED            | P-G8          | owner/expiry missing        | needs pack                |
| 040 | No Higher Claim          | REQUIRED            | P-G8          | overclaim                   | not assessed              |
| 041 | Evidence Pack            | REQUIRED            | P-G8          | incomplete evidence         | missing                   |
| 042 | Gap Zero                 | REQUIRED            | P-G8          | blocker/unknown remains     | not met                   |
| 043 | Owner Acknowledgment     | REQUIRED            | P-G8          | no signature                | not started               |

---

# Appendix B — L1 vs L1+ Traceability

| Roadmap Area | L1 Minimum                                   | L1+ Target                                        |
| ------------ | -------------------------------------------- | ------------------------------------------------- |
| Scenario     | exact approved asset + binding               | source/compiler/publish/catalog lifecycle         |
| Course       | one synthetic course/run                     | Blueprint、clone、roles、Instructor Kit、export   |
| Decision     | whole-team canonical decision                | role draft / merge / confirmation                 |
| Learning     | minimal feedback/report                      | Goal、Rubric、Evidence、Teacher Confirmation、AoL |
| AI           | OFF / inactive                               | structured mock, Teacher Review, audit            |
| BLP          | stable approved L1 path or explicit inactive | Registry、Shadow、Differential、safe diagnostics  |
| Stage 4B     | OFF                                          | contracts / resolver / Shadow / safe feed         |
| Data         | JSON synthetic                               | durable / recovery / staging                      |
| Delivery     | fresh clone + CI                             | reusable course and teacher setup hardening       |

---

# Appendix C — Test and Evidence Matrix

| Domain             |     Unit | Contract | Integration |         Browser |  Failure | Fresh Clone |
| ------------------ | -------: | -------: | ----------: | --------------: | -------: | ----------: |
| Auth               | required | required |    required |        required | required |    required |
| Tenant/Course/Team | required | required |    required |        required | required |    required |
| Formal Binding     | required | required |    required |     optional UI | required |    required |
| Decision           | required | required |    required |        required | required |    required |
| Settlement         | required | required |    required |        required | required |    required |
| Projection         | required | required |    required |        required | required |    required |
| Replay             | required | required |    required | Teacher summary | required |    required |
| Cleanup            | required |      N/A |    required |        required | required |    required |
| Known Limits       | required | required |    required |        required |      N/A |    required |

---

# Appendix D — Known Limits and Expiry Register

使用第 18.3 节 `KL-L1-001`—`KL-L1-012`。
任何 Known Limit 缺少 Owner、expiry 或 user-facing disclosure，均不能用于 PASS_WITH_LIMITS。

---

# Appendix E — Current Gap to Target Mode Mapping

## E.1 Target Mode Entry Contract

每个目标任务必须读取：

1. 本 L1 Definition；
2. L1 Value Chain Ledger；
3. Current Reality；
4. current master；
5. open PR；6.未关闭 L1 blocker；
6. current WIP / resource lock；
7. Known Limits；9.当前 Evidence Pack delta。

## E.2 Target Mode Scope Rule

```text
One target mission
=
one named L1 blocker or evidence gap
+
one product / architecture state transition
+
normally one focused PR
+
CI / exact-head / fresh closure
+
ledger update
+
stop
```

## E.3 Target Mode Stop Rule

目标任务必须在以下条件停止：

-一个 L1 blocker 被关闭，或一个明确 Evidence Gap 被补齐；-对应 PR 完成；

- CI / CodeQL 通过；
- exact-head closure；
- fresh clone；
- L1 Ledger 更新；-不得自动启动下一个目标。

## E.4 Owner Pause

必须暂停：

-未预授权 ordinary merge；
-authority change；
-runtime activation；
-default Scenario / Model switch；
-PostgreSQL；
-migration；
-settlement authority change；
-recovery；
-external provider；
-real data；
-Controlled Pilot；
-Production；
-billing。

---

# Appendix F — Terminology and Program Traceability

| Term               | Meaning in this document                                 |
| ------------------ | -------------------------------------------------------- |
| L1                 | Automated Engineering Application Validation             |
| L1+                | Product and Course Hardening                             |
| Truth-L1–L3        | Simulation Core formal truth and settlement layers       |
| Golden M1          | frozen synthetic minimum product journey                 |
| Formal Run Binding | exact immutable binding of Run to approved authorities   |
| Replay             | non-overwrite deterministic evidence, not recovery       |
| Known Limit        | approved disclosed limitation with owner/expiry          |
| Program B          | Scenario Factory                                         |
| Program C          | Course OS                                                |
| Program D          | Learning Evidence                                        |
| Program E          | Governed AI                                              |
| Program F          | Durable Platform                                         |
| Program G          | Controlled Pilot                                         |
| Program H          | Production                                               |
| Program M          | BLP/RCNL model engineering support line                  |
| STK                | Stage 4B cross-cutting stakeholder simulation workstream |

---

## L1 Definition Approval Recommendation

```text
Definition Status:
READY_FOR_OWNER_APPROVAL

Current L1 Capability Status:
NOT_ASSESSED

Current L1 Blocker Count:
4

Current L1 Evidence Gap Count:
9

Current L1 Known Limit Count:
12

L1+ Deferred Capability Count:
14

Boundary Breach Count:
0 KNOWN / UNKNOWN TOTAL

Recommended Owner Decision:
APPROVE_L1_DEFINITION
```

**Decision interpretation：**

- `APPROVE_L1_DEFINITION` 只批准本完成定义；-不批准当前仓库 L1 PASS；-下一次正式 L1 assessment 必须在 current master 上生成完整 Evidence Pack；-只要 Boundary Breach 总数仍为 UNKNOWN，就不能宣布 L1 完成；
- L1 completion does not authorize L1+, Controlled Pilot, Production, PostgreSQL activation, durable settlement, recovery, real data or billing.
