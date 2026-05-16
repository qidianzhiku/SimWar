# docs/product/requirements.md

## 文档定位与项目背景

### 文档信息

| 项目 | 内容 |
|---|---|
| 文档名称 | docs/product/requirements.md |
| 项目名称 | SimWar |
| 项目类型 | SaaS 平台 / AI 仿真平台 / 企业高管培训与商战模拟系统 |
| 文档版本 | v1.0 |
| 文档状态 | Draft |
| 最后更新 | 2026-05-13 |
| 适用范围 | MVP ～ v1.0 |
| 维护人 | 待定 |
| 相关文档 | 核心引擎与小模型体系深化设计、计量核心模型深化与工程契约、教师端与学员端整体架构、功能深化、行业无关 kernel 与行业插件研究、康养行业插件研究 |

本需求文档基于已上传的项目材料综合整理，默认将 SimWar 定位为“核心仿真引擎 + 小模型协同体系 + 内容/参数治理 + 学习闭环”的智能高管训练平台；未在材料中完全明确的内容，均以“请根据实际项目修改”标注。fileciteturn0file11 fileciteturn0file12 fileciteturn0file18 fileciteturn0file19

### 项目背景

SimWar 的目标不是做一个通用聊天机器人，而是做一个可回放、可审计、可扩展、可跨行业迁移的结构化仿真系统。平台的核心真值应由仿真引擎与计量内核产生，小模型只负责建议、解释、对练、复盘与学习推荐；同时，平台需要支持“行业无关 kernel + 行业插件”的扩展路径，以便在统一对象模型、回合机制、权限边界、评分框架和治理机制之上，承载康养、零售、制造、金融等不同场景。fileciteturn0file10 fileciteturn0file11 fileciteturn0file12 fileciteturn0file13 fileciteturn0file17

### 项目目标

#### 业务目标
- 支持教师快速创建课程、班级与商战赛局。
- 支持学员以团队方式进行多轮经营决策、对抗与复盘。
- 支持企业培训机构和商学院批量交付高管训练项目。
- 支持平台沉淀学习事件、对战结果与复盘数据，形成持续学习闭环。
- 支持行业场景和插件持续扩展。fileciteturn0file11 fileciteturn0file18 fileciteturn0file19

#### 产品目标
- 提供教师端、学员端、管理后台，并预留社区、竞赛、学习诊断模块。
- 打通课程、队伍、回合、决策、结算、结果发布、复盘、推荐闭环。
- 提供 AI 教练、AI 风险挑战、AI 学习推荐等辅助能力，但不允许其改写真值。
- 支持课程模板、场景包、参数集、插件包、回放报告等标准化资产。fileciteturn0file11 fileciteturn0file12 fileciteturn0file18 fileciteturn0file19

#### 技术目标
- 模块化、事件驱动、多租户、可灰度发布。
- 可回放、可审计、可冻结参数、可治理模型版本。
- L1-L5 分层清晰，写权限边界明确。
- API 契约标准化，学习记录标准化，身份编排标准化。fileciteturn0file11 fileciteturn0file12 fileciteturn0file14

#### 非目标
- 不做真实证券/金融交易。
- 不允许 AI 直接决定正式成绩、利润、市场份额、现金流或排名。
- 不允许正式 run 启动后随意覆盖 ParameterSet。
- 不把某一行业字段写死到核心引擎。
- 不默认接入未授权内容进入训练或对外展示。fileciteturn0file11 fileciteturn0file12 fileciteturn0file13

## 用户角色与核心业务流程

### 角色与用户画像

| 角色 | 描述 | 核心目标 |
|---|---|---|
| 平台管理员 | 管理租户、系统配置、用户与权限 | 保证平台稳定、安全、可用 |
| 教师 / 教练 | 创建课程、控制回合、查看结果与复盘 | 组织教学、评估学习效果 |
| 学员 / 团队成员 | 参与商战、提交决策、查看反馈 | 提升经营判断与协作能力 |
| 企业管理员 | 管理企业项目、班级和学员 | 组织企业培训与数据归档 |
| 场景设计师 | 创建场景模板、行业插件、冲击事件 | 扩展平台案例与行业覆盖 |
| 模型治理人员 | 审核参数集、模型版本、Replay 报告 | 保证模型可信、可回放 |
| 系统运维人员 | 监控服务、部署环境、告警与恢复 | 保证 SLA、性能与变更安全 |
| AI 策略顾问 | 生成策略建议和假设地图 | 提供 advisory-only 建议 |
| AI 风险红队 | 生成反证、风险挑战与脆弱性提示 | 提高决策稳健性 |
| AI 复盘教练 | 生成复盘问题、反事实提示 | 提升反思质量 |
| AI 学习推荐器 | 推荐内容、导师、学习路径 | 推动持续学习 |

以上角色综合自教师端/学员端白皮书、核心引擎设计和计量工程契约；其中所有 AI 角色均不是系统管理员，默认不得写入 truth fields。fileciteturn0file11 fileciteturn0file12 fileciteturn0file13 fileciteturn0file18 fileciteturn0file19

### 教师开课流程

```mermaid
flowchart LR
  A[教师登录] --> B[创建课程]
  B --> C[选择场景模板]
  C --> D[配置回合数与评分规则]
  D --> E[创建或导入队伍]
  E --> F[选择已批准 ParameterSet]
  F --> G[发布课程]
  G --> H[开启第一轮]
```

教师端不仅要能开课，还应成为“可控驾驶台”：教师可选择已批准 ParameterSet、配置回合、注入冲击事件、查看回放差异与结果诊断，但不得在正式运行中直接修改市场份额、现金流或最终分数。fileciteturn0file12 fileciteturn0file18 fileciteturn0file19

### 学员决策流程

```mermaid
flowchart LR
  A[学员登录] --> B[加入课程与队伍]
  B --> C[查看团队驾驶舱]
  C --> D[阅读市场反馈与调研]
  D --> E[填写结构化决策]
  E --> F[提交或队内确认]
  F --> G[等待锁轮与结算]
  G --> H[查看结果反馈]
  H --> I[提交复盘反思]
```

学员端默认只展示 `state_obs` 与经调研更新后的 `state_est`，而不展示完整 `state_true`、完整 ParameterSet 或完整微观矩；结果反馈应采用“三段式”：发生了什么、为什么发生、下一步风险与建议。fileciteturn0file12 fileciteturn0file18 fileciteturn0file19

### 回合结算流程

```mermaid
flowchart LR
  A[教师锁定回合] --> B[Decision Validator 校验]
  B --> C[读取冻结的 ParameterSet / Plugin / Seed]
  C --> D[L1 需求与供给真值计算]
  D --> E[L2 运营约束计算]
  E --> F[L3 财务与评分计算]
  F --> G[写入 TruthState / Ledger / Snapshot]
  G --> H[发布教师端与学员端视图]
  H --> I[写入 Replay Hash / Audit Log / Learning Record]
```

正式结算必须依赖冻结的 ParameterSet、插件版本、随机种子与决策快照；同输入、同参数、同 seed 的结果必须可 Replay，且所有关键写操作进入审计与回放链。fileciteturn0file10 fileciteturn0file11 fileciteturn0file12

### AI 辅助流程

AI 仅可读取授权后的状态快照、约束结果、学习记录与已授权内容，输出策略建议、风险提示、证据卡、角色互动、复盘草稿与学习路径推荐；AI 不得直接写入市场份额、收入、成本、利润、现金流、最终评分、排名或参数集。所有 AI 输出必须带 `advisory_only` 或等价标识，并记录模型版本、上下文和来源证据。fileciteturn0file11 fileciteturn0file12 fileciteturn0file13

## 功能需求

### 功能需求总览

| 模块 | 功能 | 优先级 | 用户角色 | 简要说明 |
|---|---|---|---|---|
| 用户与权限 | 注册、登录、角色、租户隔离、字段级权限 | P0 | 管理员、教师、学员、企业管理员 | 保障身份与数据边界 |
| 课程管理 | 课程创建、编辑、发布、归档 | P0 | 教师、企业管理员 | 支撑教学交付 |
| 场景管理 | 模板、场景包、插件包、参数集引用 | P0 | 场景设计师、教师 | 支撑案例扩展 |
| 队伍与角色 | 队伍创建、成员分配、队内角色 | P0 | 教师、学员 | 支撑团队对抗 |
| 回合控制 | 开启、锁轮、结算、发布结果 | P0 | 教师 | 支撑赛局推进 |
| 决策提交 | 表单、草稿、提交、版本记录 | P0 | 学员 | 支撑多轮经营决策 |
| 仿真核心引擎 | 运行编排、需求/运营/财务/评分 | P0 | 系统服务 | 生成正式真值 |
| 计量模型 | BLP/RCNL、供给侧、微观矩、反事实 | P1 | 计量工程、治理团队 | 形成 L1 真值核 |
| AI 小模型 | 策略顾问、风险红队、复盘教练等 | P1 | 学员、教师 | 提供 explainable 辅助 |
| 教师端 | 控制台、监控、冲击注入、复盘 | P0 | 教师 | 教学驾驶台 |
| 学员端 | 驾驶舱、反馈、反思、学习报告 | P0 | 学员 | 学习与决策入口 |
| 管理后台 | 租户、用户、参数、模型、审计 | P0 | 管理员、治理团队 | 平台运维与治理 |
| 社区模块 | 发帖、项目协作、专家答疑 | P2 | 学员、教师 | 持续学习闭环 |
| 竞赛模块 | 报名、赛制、排行、反作弊 | P2 | 教师、管理员、学员 | 公开竞赛与校际比赛 |
| 学习诊断 | LRS、xAPI、反事实学习诊断 | P1 | 教师、学员 | 生成学习评价 |
| 行业插件 | 行业参数、政策逻辑、资质约束 | P1 | 场景设计师、治理团队 | 支撑跨行业扩展 |

该功能分层与优先级来自现有材料中对教师端、学员端、核心引擎、小模型、Replay、社区、竞赛和行业插件的共识整理。fileciteturn0file10 fileciteturn0file11 fileciteturn0file12 fileciteturn0file18 fileciteturn0file19

### 详细功能需求

#### FR-001：用户与权限模块
- 优先级：P0
- 相关角色：平台管理员、教师、学员、企业管理员、模型治理人员
- 业务目标：建立可审计、可隔离、可扩展的身份与权限体系。
- 功能描述：支持注册/登录、组织邀请、角色绑定、租户隔离、字段级与资源级权限控制。
- 前置条件：已存在租户、组织或课程上下文。
- 主流程：用户认证 → 角色解析 → 租户绑定 → 权限裁剪 → 发放访问令牌。
- 异常流程：账号禁用、租户不匹配、越权访问、角色缺失、课程已归档。
- 输入数据：账号信息、租户 ID、角色信息、课程/队伍上下文。
- 输出数据：访问令牌、角色清单、可见字段集合、权限错误报告。
- 权限要求：学员不得查看完整 truth 参数；教师可查看教学授权范围内的摘要；AI 服务只读裁剪数据。
- 验收标准：可按租户隔离数据；可按角色裁剪字段；所有高风险写操作写入审计日志。
- 备注：MVP 支持平台账号体系；企业 SSO 与 SCIM 用户预配建议列为 P1/P2，并使用标准化身份接口。fileciteturn0file11 fileciteturn0file12 fileciteturn0file18 fileciteturn0file19 citeturn1search0

#### FR-002：课程管理模块
- 优先级：P0
- 相关角色：教师、企业管理员、平台管理员
- 业务目标：支撑课程交付、班级管理与教学节奏控制。
- 功能描述：创建课程、编辑课程、复制课程、归档课程、配置课程时间、评分规则、教师/学员名单。
- 前置条件：教师已具备创建课程权限。
- 主流程：创建课程 → 配置时间与规则 → 绑定场景 → 导入学员 → 发布。
- 异常流程：课程时间冲突、课程未绑定场景、学员批量导入失败。
- 输入数据：课程基本信息、班级信息、时间窗口、评分规则、参与者清单。
- 输出数据：course_id、课程状态、导入报告、发布结果。
- 权限要求：教师仅能管理授权课程；企业管理员可看本企业课程。
- 验收标准：课程可复制、可归档、可回滚到未发布状态；课程变更有操作日志。
- 备注：评分规则建议支持默认模板 + 教师可配置权重，两级并存。fileciteturn0file18 fileciteturn0file19

#### FR-003：场景管理模块
- 优先级：P0
- 相关角色：场景设计师、教师、模型治理人员
- 业务目标：实现统一场景资产管理与跨行业扩展。
- 功能描述：选择场景模板、创建 ScenarioPackage、引用 PluginPackage、配置初始市场、外部冲击和可见信息。
- 前置条件：平台已存在场景模板或插件包。
- 主流程：选择模板 → 配置参数 → 绑定插件 → 生成场景包 → 审核/发布。
- 异常流程：插件版本不兼容、参数缺失、场景编译失败。
- 输入数据：模板参数、行业插件、回合数、可见性策略、冲击规则。
- 输出数据：scenario_package_id、编译报告、版本号。
- 权限要求：仅场景设计师与治理角色可发布正式模板。
- 验收标准：场景包可版本化；运行前可验证 schema；可绑定 approved ParameterSet。
- 备注：MVP 即支持“行业无关 kernel + 行业插件”的双层结构。fileciteturn0file10 fileciteturn0file15 fileciteturn0file17

#### FR-004：队伍与角色模块
- 优先级：P0
- 相关角色：教师、学员
- 业务目标：支撑团队协作与角色分工。
- 功能描述：创建队伍、分配成员、设置队名、设置 CEO/CFO/CMO/COO/CHRO/风控等队内角色，并记录协作痕迹。
- 前置条件：课程已创建、学员已加入课程。
- 主流程：教师建队或学员组队 → 分配成员 → 指定角色 → 锁定队伍。
- 异常流程：成员重复加入、队伍人数超限、角色冲突。
- 输入数据：team_id、成员列表、角色列表、队伍规则。
- 输出数据：队伍结构、角色图谱、变更记录。
- 权限要求：教师可管理全部队伍；学员仅可看本队协作详情。
- 验收标准：支持队内协作记录；支持缺岗提醒；支持队伍变更历史。
- 备注：角色清单可按行业和课程类型扩展。fileciteturn0file18 fileciteturn0file19

#### FR-005：回合控制模块
- 优先级：P0
- 相关角色：教师、平台管理员
- 业务目标：确保赛局推进有清晰状态机和冻结机制。
- 功能描述：支持开启回合、暂停回合、锁定回合、触发结算、发布结果、归档回合。
- 前置条件：课程已发布、队伍有效、场景与参数已绑定。
- 主流程：open → accept decisions → lock → settle → publish → debrief。
- 异常流程：锁轮后仍有写入、参数未冻结、求解失败进入 Shadow Queue。
- 输入数据：round_id、run_id、锁轮命令、结算命令、shock 集合。
- 输出数据：round_status、settlement_result、publish_report。
- 权限要求：仅教师或授权管理员可锁轮和触发结算。
- 验收标准：状态迁移可追踪；锁轮后决策不可再改；失败 run 可进入回放诊断。
- 备注：建议状态机为 `draft -> open -> locked -> settling -> settled -> published -> archived`。fileciteturn0file10 fileciteturn0file11 fileciteturn0file12

#### FR-006：决策提交模块
- 优先级：P0
- 相关角色：学员、教师
- 业务目标：支持结构化、可校验、可版本追踪的团队决策。
- 功能描述：支持草稿保存、决策提交、修改、截止控制、版本记录和队伍确认。
- 前置条件：回合处于 open 状态。
- 主流程：填写表单 → 本地校验 → 提交 → 服务端 Decision Validator 校验 → 保存版本。
- 异常流程：字段缺失、预算约束冲突、已锁轮、证据引用无效。
- 输入数据：价格、营销预算、研发投入、产能规划、人员配置、融资策略、服务质量、风险控制、战略说明。
- 输出数据：decision_id、validation_report、normalized_decision。
- 权限要求：学员仅能提交本队决策；教师可查看状态但不得代替提交正式队伍决策。
- 验收标准：支持幂等重提；支持版本对比；支持异常原因可读化。
- 备注：字段清单为建议，最终以行业插件和 Feature Mapper 定义为准。fileciteturn0file10 fileciteturn0file12 fileciteturn0file18

#### FR-007：仿真核心引擎模块
- 优先级：P0
- 相关角色：系统服务、模型治理人员
- 业务目标：提供唯一正式真值来源。
- 功能描述：实现 Core Simulation Engine、Run Orchestrator、Decision Validator、Scenario Compiler、Market/Demand Engine、Operations Engine、Finance Engine、Scoring Engine、Event Store、Replay Engine、Governance Gate。
- 前置条件：场景、参数、插件、队伍和决策均已就绪。
- 主流程：编排 run → 校验决策 → 计算市场真值 → 计算运营约束 → 计算财务评分 → 写入 Snapshot/Ledger → 生成结果视图。
- 异常流程：参数不一致、计算失败、随机种子缺失、快照写入失败。
- 输入数据：normalized decision、ScenarioPackage、ParameterSet、ShockEvent、seed。
- 输出数据：TruthState、SettlementResult、Score、Rank、ReplayHash。
- 权限要求：仅核心引擎可写 truth_state；外部服务不可越权改写。
- 验收标准：同输入可复算；固定随机种子可复现；关键字段可审计。
- 备注：正式结果必须由结构化内核生成，小模型不可直接写入任何正式成绩字段。fileciteturn0file11 fileciteturn0file12

#### FR-008：计量核心模型 / BLP / RCNL 模块
- 优先级：P1
- 相关角色：计量工程师、模型治理人员、教师
- 业务目标：用结构化经济模型承担 L1 需求与供给真值层。
- 功能描述：支持差异化产品/服务选择、市场份额、价格弹性、替代关系、供给侧成本/markup、反事实分析、微观矩、离线校准与在线结算适配。
- 前置条件：已具备 ProductData、AgentData、ParameterSet、Feature Mapper。
- 主流程：离线校准 → 候选参数集 → Shadow Replay → 审批 → 正式绑定 run。
- 异常流程：模型不收敛、弱工具告警、微观矩不通过、供给侧成本异常。
- 输入数据：市场数据、产品/服务特征、调查/微观矩、决策映射特征。
- 输出数据：share、elasticity、diversion、markup、marginal_cost、counterfactual report。
- 权限要求：候选参数集仅能在治理流程中晋升；学员端不可见底层参数。
- 验收标准：具备 Golden Solver Test、Shadow Replay Test、价格系数与 share 合法性检查。
- 备注：正式上线建议通过 PyBLP 适配层或等价实现承载 BLP/RCNL 能力；行业特异逻辑通过插件进入，而不是直接改写核心模型。fileciteturn0file12 fileciteturn0file14 citeturn1search2turn1search6turn1search18

#### FR-009：AI 小模型模块
- 优先级：P1
- 相关角色：学员、教师、AI 策略顾问、AI 风险红队、AI 复盘教练、AI 学习推荐器
- 业务目标：在不改写真值的前提下提升学习效果。
- 功能描述：支持 Strategy Advisor、Finance Copilot、Market Analyst、Risk Red Team、Role Agent、Debrief Coach、Learning Recommender、Rubric Judge。
- 前置条件：已存在授权上下文、状态快照、知识检索能力。
- 主流程：读取裁剪状态 → 生成 structured output → 标记 advisory_only → 写入 CoachOutput / Draft。
- 异常流程：输出越权、引用证据缺失、模型超时、内容合规失败。
- 输入数据：状态快照、目标、约束、证据卡、反思文本、rubric。
- 输出数据：action_proposal、risk_challenge、dialogue_event、debrief_card、recommendation_list、assessment_draft。
- 权限要求：AI 只读真值摘要，默认不能写 truth fields；Rubric Judge 输出需教师确认。
- 验收标准：输出可追踪模型版本；所有 AI 输出带来源与上下文；越权写入测试全部失败。
- 备注：小模型系统是 simulation-grounded agent system，而不是单一聊天机器人。fileciteturn0file11 fileciteturn0file13

#### FR-010：教师端模块
- 优先级：P0
- 相关角色：教师、教练
- 业务目标：提供教学驾驶台，而不是仅有开课与看分功能。
- 功能描述：课程列表、回合控制、学员监控、决策日志查看、市场结果查看、队伍表现分析、冲击事件注入、复盘报告生成、AI 辅助点评、Shadow Replay 对比。
- 前置条件：教师已拥有课程管理权限。
- 主流程：进入课程工作台 → 查看运行状态 → 锁轮/结算 → 查看结果与诊断 → 发布点评。
- 异常流程：无权查看他班数据、回合未结算即请求结果、注入 shock 越过生效轮。
- 输入数据：课程 ID、run_id、round_id、ShockEvent、分析请求。
- 输出数据：教师仪表盘、结果图表、Replay 报告、批注记录。
- 权限要求：教师可见经授权的 state_true 摘要，但不得直接改正式结果。
- 验收标准：教师可完成从开课到复盘的闭环操作；可导出结果报告。
- 备注：教师端需要参数影响预览、Counterfactual Sandbox 和模型健康度视图，但不得把预演结果混同为正式成绩。fileciteturn0file12 fileciteturn0file18 fileciteturn0file19

#### FR-011：学员端模块
- 优先级：P0
- 相关角色：学员、队长
- 业务目标：让学员基于“有限可见信息”学习结构化判断。
- 功能描述：团队驾驶舱、市场信息查看、决策填写、提交、结果反馈、三段式反馈、AI 策略建议、复盘反思、学习报告、历史表现查看。
- 前置条件：学员已加入课程与队伍。
- 主流程：查看本队 KPI → 读取反馈与调研 → 填写决策 → 提交 → 查看三段式结果 → 反思。
- 异常流程：未入队、超过截止时间、越权查看竞品明细。
- 输入数据：本队状态、调研结果、决策表单、反思文本。
- 输出数据：结果图表、解释卡片、建议卡片、学习报告。
- 权限要求：仅本队细节可见；竞品信息按赛制脱敏。
- 验收标准：能完成完整一轮操作；反馈图文可读；可查看历史轮次变化。
- 备注：学员默认不应看到完整 agent pool、完整弹性矩阵或完整 ParameterSet。fileciteturn0file12 fileciteturn0file18 fileciteturn0file19

#### FR-012：管理后台模块
- 优先级：P0
- 相关角色：平台管理员、企业管理员、模型治理人员
- 业务目标：集中管理租户、资产、模型与审计。
- 功能描述：租户管理、用户管理、权限管理、课程模板管理、场景包管理、参数集管理、模型版本管理、审计日志、系统配置、数据导出。
- 前置条件：管理员登录。
- 主流程：选择租户/系统域 → 管理用户与角色 → 管理资产与版本 → 查看告警与审计。
- 异常流程：越权跨租户操作、导出敏感字段未脱敏。
- 输入数据：租户配置、资产元数据、审批动作、导出请求。
- 输出数据：配置结果、审批记录、审计视图、导出文件。
- 权限要求：高风险操作双人审批或等价门禁。
- 验收标准：租户隔离有效；参数/模型审批链完整；审计日志可检索。
- 备注：管理后台与教师端分离，避免教学操作与平台治理混淆。fileciteturn0file11 fileciteturn0file12 fileciteturn0file18 fileciteturn0file19

#### FR-013：社区模块
- 优先级：P2
- 相关角色：学员、教师、内容审核人员
- 业务目标：形成赛后持续学习网络。
- 功能描述：发帖、经验分享、项目协作、专家答疑、内容推荐、审核、举报、申诉、学习图谱推荐。
- 前置条件：用户已通过身份认证并具有社区访问权限。
- 主流程：浏览内容 → 发帖/回复 → 参与项目 → 接收推荐与通知。
- 异常流程：违规内容、版权/隐私风险、重复刷屏。
- 输入数据：帖子内容、评论、标签、项目申请、举报信息。
- 输出数据：内容流、推荐列表、审核结果、社区徽章。
- 权限要求：社区内容按课程、租户、公开级别分层可见。
- 验收标准：支持举报与审核闭环；能为学员推送与能力缺口相关内容。
- 备注：社区不是娱乐平台，而是围绕能力缺口、案例证据与项目协作组织内容。fileciteturn0file11 fileciteturn0file18 fileciteturn0file19

#### FR-014：竞赛模块
- 优先级：P2
- 相关角色：教师、管理员、学员
- 业务目标：支撑公开竞赛、校际赛与企业内训 PK。
- 功能描述：创建竞赛、报名、赛制配置、排行榜、奖项设置、公开结果页、赛事复盘、反作弊、归档。
- 前置条件：竞赛模板、课程或赛局配置已存在。
- 主流程：发布竞赛 → 报名审核 → 分组与赛程 → 多轮对抗 → 公布榜单 → 复盘归档。
- 异常流程：重复报名、资格不符、延迟提交、异常分数。
- 输入数据：参赛队伍、赛制规则、轮次计划、反作弊策略。
- 输出数据：竞赛状态、公开榜单、赛事报告、违规报告。
- 权限要求：公开榜单只展示允许公开的字段。
- 验收标准：支持多队竞赛；支持公开榜单与归档；支持审计追踪。
- 备注：公开竞赛建议在 MVP 后进入 P2/P3，先验证课堂赛与企业内部赛。fileciteturn0file18 fileciteturn0file19

#### FR-015：学习诊断模块
- 优先级：P1
- 相关角色：教师、学员、企业管理员
- 业务目标：量化学习成效，而不是只显示输赢。
- 功能描述：采集学习记录、接入 LRS、评估决策质量、证据使用质量、风险偏好、团队协作、反事实学习能力和跨轮改进率，生成学习报告。
- 前置条件：已接入学习事件采集与评分 rubric。
- 主流程：采集事件 → 写入 LRS → 聚合指标 → 生成个人/团队报告。
- 异常流程：事件缺失、报告延迟、维度计算失败。
- 输入数据：决策事件、反思文本、教师点评、社区行为、竞赛结果。
- 输出数据：学习记录、能力画像、诊断报告、推荐任务。
- 权限要求：个人敏感诊断仅个人与授权教师可见。
- 验收标准：至少输出团队协作、风险偏好、反事实学习三类指标。
- 备注：学习事件建议统一用 xAPI 表达并落入 LRS，后续可扩展到更细粒度 profile。fileciteturn0file18 fileciteturn0file19 citeturn0search22turn0search19

#### FR-016：行业插件模块
- 优先级：P1
- 相关角色：场景设计师、模型治理人员、教师
- 业务目标：让行业复杂性进入插件，而不是污染内核。
- 功能描述：支持 Plugin Manifest、行业参数、行业需求曲线、政策规则、客群迁移、资质约束、外部冲击、插件版本、插件测试与插件发布审批。
- 前置条件：内核对象模型与插件 hook 已定义。
- 主流程：编写插件清单 → 配置行业参数 → 通过测试与 Shadow Replay → 审批发布 → 被场景包引用。
- 异常流程：插件写入越权、版本不兼容、政策规则冲突。
- 输入数据：plugin_manifest、policy_rules、migration_matrix、eligibility_mask、shock rules。
- 输出数据：plugin_package_id、测试报告、审批记录。
- 权限要求：插件只能通过有限 hook 改写 `utility_shift`、`eligibility_mask`、`migration_matrix`、`policy_cost_shift` 等安全写入项。
- 验收标准：插件不能直接改写 truth fields；插件版本可追踪、可回滚。
- 备注：康养插件示例至少应覆盖床位/房型、护理等级、服务包、医养结合、长护险、医保互通、探视半径、地理距离、政策补贴、入住率、护理人效、现金流与投资回收周期；具体参数值请根据实际项目修改。fileciteturn0file10 fileciteturn0file15 fileciteturn0file16 fileciteturn0file17

## 数据、接口与治理契约

### 数据需求

| 实体 | 说明 | 关键字段 |
|---|---|---|
| Tenant | 多租户主体 | tenant_id, name, status |
| User | 用户主体 | user_id, tenant_id, role_ids, status |
| Role | 角色定义 | role_id, scope, policy |
| Course | 课程/班级 | course_id, scenario_package_id, status |
| Run | 一次赛局实例 | run_id, parameter_set_id, seed, status |
| Round | 回合实例 | round_id, run_id, state, open_at, locked_at |
| Team | 参赛团队 | team_id, course_id, members, role_map |
| Decision | 决策提交 | decision_id, round_id, team_id, payload, version |
| ScenarioPackage | 场景包 | scenario_package_id, template_id, version |
| PluginPackage | 插件包 | plugin_package_id, plugin_type, version, approval_status |
| ParameterSet | 参数集 | parameter_set_id, model_family, status, governance |
| StateSnapshot | 状态快照 | snapshot_id, run_id, round_id, replay_hash |
| SettlementResult | 结算结果 | result_id, round_id, score, rank, truth_state_ref |
| ReplayReport | 回放/对比结果 | replay_report_id, baseline, candidate, diff_summary |
| CoachOutput | AI 输出 | coach_output_id, model_version, advisory_flag, context_ref |
| LearningRecord | 学习事件记录 | record_id, actor_id, verb, object_id, timestamp |
| AuditLog | 审计日志 | log_id, actor_id, action, resource, trace_id |
| Competition | 竞赛实体 | competition_id, format, status |
| CommunityPost | 社区内容 | post_id, author_id, visibility, moderation_status |

实体模型应以 Canonical Domain Model 为中心，再映射到行业场景与外部平台；MVP 只要求最小可用字段集，任何生产级细节字段请在 schema 冻结阶段补全。fileciteturn0file10 fileciteturn0file12 fileciteturn0file17

### API 需求

#### API 总览

| 编号 | 方法 | 路径 | 描述 | 权限 | 优先级 |
|---|---|---|---|---|---|
| API-001 | POST | /auth/login | 用户登录 | 公共 | P0 |
| API-002 | POST | /courses | 创建课程 | 教师/管理员 | P0 |
| API-003 | GET | /courses/{id} | 查询课程详情 | 课程成员 | P0 |
| API-004 | POST | /scenarios | 创建场景包 | 场景设计师/治理 | P0 |
| API-005 | POST | /runs | 创建 run | 教师 | P0 |
| API-006 | POST | /teams | 创建/导入队伍 | 教师 | P0 |
| API-007 | POST | /decisions | 提交决策 | 学员 | P0 |
| API-008 | POST | /rounds/{id}/lock | 锁定回合 | 教师 | P0 |
| API-009 | POST | /rounds/{id}/settle | 触发结算 | 教师/系统 | P0 |
| API-010 | GET | /reports/team/{id} | 读取队伍结果报告 | 本队/教师 | P0 |
| API-011 | POST | /replays/shadow | 启动 Shadow Replay | 治理/教师 | P1 |
| API-012 | POST | /parameter-sets/{id}/approve | 审批参数集 | 模型治理 | P1 |
| API-013 | POST | /coach/advise | 获取 AI 建议 | 学员/教师 | P1 |
| API-014 | POST | /competitions | 创建竞赛 | 教师/管理员 | P2 |
| API-015 | POST | /community/posts | 发布社区内容 | 学员/教师 | P2 |

#### API 契约要求

- 对外及对内 HTTP 接口建议采用 OpenAPI-first；为与现有材料一致，MVP 可以 3.1.x 为契约基线，后续再评估升至更高版本。fileciteturn0file10 fileciteturn0file12 citeturn0search15turn0search6
- 所有写操作必须记录审计日志；正式结算接口需具备幂等性与防重复执行机制。fileciteturn0file10 fileciteturn0file12
- 学习记录统一进入 LRS，并建议使用 xAPI 语义对关键学习动作建模。fileciteturn0file14 fileciteturn0file18 citeturn0search22turn0search19
- 若需要对接 LMS，建议采用 LTI 1.3 / LTI Advantage；若需要企业用户预配，建议采用 SCIM。fileciteturn0file14 citeturn0search2turn1search0

### 权限矩阵

| 功能 / 数据 | 平台管理员 | 教师 | 学员 | 企业管理员 | AI 小模型 | 模型治理人员 |
|---|---|---|---|---|---|---|
| 创建课程 | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| 开启回合 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 锁定回合 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 提交决策 | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| 触发结算 | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| 查看 state_true | 摘要/治理视图 | 教学授权摘要 | ❌ | ❌ | 摘要且裁剪 | ✅ |
| 查看 state_obs / state_est | ✅ | ✅ | ✅ | ✅（授权范围） | ✅（裁剪） | ✅ |
| 修改 ParameterSet | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 发布模型版本 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 查看审计日志 | ✅ | 课程级摘要 | ❌ | 租户级摘要 | ❌ | ✅ |
| 修改正式结果 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

权限矩阵的核心原则是：L1-L3 真值内核只允许结构化服务写入，L4 小模型只读裁剪数据，只写建议与解释草稿。fileciteturn0file11 fileciteturn0file12 fileciteturn0file13

### 状态机需求

#### 课程状态机

```text
draft -> published -> active -> completed -> archived
```

- `draft`：课程创建但未发布；允许修改基础配置。
- `published`：课程已发布、可入班。
- `active`：赛局已开始；不允许删除关键资产。
- `completed`：课程结束；允许复盘与导出。
- `archived`：归档；只读。fileciteturn0file18 fileciteturn0file19

#### 回合状态机

```text
draft -> open -> locked -> settling -> settled -> published -> archived
```

- `open`：允许提交决策。
- `locked`：停止改写决策，进入结算准备。
- `settling`：执行真值求解。
- `published`：结果对前端可见。fileciteturn0file10 fileciteturn0file11 fileciteturn0file12

#### 参数集状态机

```text
draft -> candidate -> shadow_testing -> shadow_passed -> approved -> deprecated
```

- `candidate`：离线校准完成的候选参数。
- `shadow_testing`：用于 Shadow Replay 与差异诊断。
- `approved`：可进入正式 run。fileciteturn0file12

#### 模型版本状态机

```text
draft -> evaluation -> shadow_arena -> approved -> deployed -> rolled_back
```

- `evaluation`：离线评测阶段。
- `shadow_arena`：对照旧版本进行影子运行。
- `deployed`：正式发布。
- `rolled_back`：因性能/合规/质量问题回滚。fileciteturn0file11 fileciteturn0file13

## 非功能、验收与测试

### 非功能需求

| 编号 | 类别 | 要求 | 验收标准 |
|---|---|---|---|
| NFR-001 | 性能 | 关键页面与报告加载应满足教学场景实时性 | 典型页面 p95 响应满足教学可用门槛，请根据实际项目修改 |
| NFR-002 | 性能 | 单轮结算需支持班级级并发与竞赛级放大 | 单轮结算可在设定时间窗内完成并有失败回退 |
| NFR-003 | 可用性 | 核心赛局、结算、报告服务需具备高可用与恢复能力 | 支持故障告警、重试、回滚、备份恢复 |
| NFR-004 | 安全 | 强认证、最小权限、租户隔离、字段级脱敏 | 越权测试不得通过；敏感字段按角色裁剪 |
| NFR-005 | 合规 | 个人数据处理、日志留痕、内容治理符合适用法规 | 数据访问可审计；删除/导出流程可执行 |
| NFR-006 | AI 合规 | AI 生成内容应可识别、可追踪、可回滚 | 输出带模型版本与标识，违规内容可下架 |
| NFR-007 | 可扩展性 | 支持行业插件、多语言、多租户和模块化部署 | 新插件不改 kernel 核心代码即可接入 |
| NFR-008 | 可观测性 | 提供日志、指标、链路、Replay 差异监控 | 核心服务具 trace_id 和仪表盘 |
| NFR-009 | 可靠性 | 正式 run 必须可 Replay、可审计、可比对 | 同输入 replay_hash 一致 |
| NFR-010 | 可维护性 | 所有核心 schema 和接口需契约测试 | schema 兼容性检查通过 |

非功能要求综合了平台白皮书、计量工程契约和当前官方标准：OpenAPI 用于 API 契约描述，xAPI/LRS 用于学习记录，LTI/SCIM 可用于外部集成，AI 生成内容还需考虑当前适用的标识要求。fileciteturn0file12 fileciteturn0file18 fileciteturn0file19 citeturn0search15turn0search22turn0search2turn1search0turn1search19turn5search7

### MVP 验收标准

以下清单用于 MVP 阶段验收：fileciteturn0file11 fileciteturn0file12 fileciteturn0file18 fileciteturn0file19

- [ ] 教师可以创建课程并发布
- [ ] 学员可以加入课程并加入队伍
- [ ] 学员可以提交结构化决策
- [ ] 教师可以锁轮并触发结算
- [ ] 系统可以完成至少一轮正式结算
- [ ] 学员可以查看三段式结果反馈
- [ ] 教师可以查看全班结果与复盘摘要
- [ ] 所有关键事件写入日志和学习记录
- [ ] 正式结算结果可以 Replay
- [ ] AI 小模型不会写入 truth fields
- [ ] ParameterSet 在正式运行后不可被覆盖修改
- [ ] 学员端无法查看完整 `state_true`

### 测试需求

| 编号 | 测试类型 | 测试目标 | 覆盖模块 | 通过标准 |
|---|---|---|---|---|
| TEST-001 | 单元测试 | 确认核心服务逻辑正确 | Validator、Mapper、Score | 核心函数覆盖达标 |
| TEST-002 | 集成测试 | 验证 run 到 result 的主链路 | Course、Round、Engine | 一轮流程稳定通过 |
| TEST-003 | E2E 测试 | 从教师开课到学员复盘 | 教师端、学员端、引擎 | 关键路径自动化通过 |
| TEST-004 | 权限测试 | 验证角色与字段边界 | Auth、Report、Admin | 越权请求被拒绝 |
| TEST-005 | 契约测试 | 检查 JSON Schema / OpenAPI 兼容性 | 所有 API 与事件 | 兼容性检查通过 |
| TEST-006 | Replay 测试 | 验证同输入可复现 | Replay Engine | replay_hash 一致 |
| TEST-007 | Shadow Replay 测试 | 验证候选参数差异可解释 | ParameterSet 治理 | 生成 diff report |
| TEST-008 | 性能测试 | 验证峰值课程/竞赛压力 | Engine、Report、Queue | 达到既定 p95 门槛 |
| TEST-009 | 安全测试 | 验证认证、鉴权、审计、注入防护 | Auth、AI、Community | 无高危漏洞上线 |
| TEST-010 | AI 边界测试 | 验证 AI 不改写真值 | Small Model System | 所有越权写入失败 |
| TEST-011 | 多租户隔离测试 | 验证数据与日志隔离 | Tenant、Admin、Audit | 不可跨租户读取 |
| TEST-012 | 合规测试 | 验证内容标识、删除、导出 | AI 输出、LRS、Admin | 合规流程闭环 |

测试要求直接对应工程契约中提出的 Schema Contract Test、Golden Solver Test、Replay Test、Shadow Replay Test 和性能门禁。fileciteturn0file12

### 风险与约束

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| 需求范围过大 | 交付延期、MVP 失焦 | 严格分 phase，先做 P0/P1 |
| 仿真结果不可解释 | 教学信任下降 | 三段式反馈 + 回放 + 参数治理 |
| AI 越权 | 正式成绩污染 | truth write boundary + AI 边界测试 |
| 参数中途被修改 | 结果不可复现 | ParameterSet 冻结 + 审批流 |
| 多租户数据泄漏 | 合规与商誉风险 | 租户隔离、字段脱敏、审计 |
| 行业插件过度耦合 | kernel 被污染 | 只允许安全 hook 写入 |
| 性能不足 | 课堂/竞赛体验受损 | 分层结算、队列、缓存、扩缩容 |
| 数据不足 | 校准质量不足 | Shadow Replay、逐步引入微观矩 |
| 内容授权风险 | 法务风险 | 授权清单、内容治理、品牌边界 |
| 教师操作复杂 | 使用门槛高 | 驾驶台分层、模板化、向导化 |

风险项综合自架构白皮书、工程契约和小模型研究报告中的冲突点、治理建议和迭代路线。fileciteturn0file11 fileciteturn0file12 fileciteturn0file13 fileciteturn0file18 fileciteturn0file19

## 里程碑与需求治理

### 里程碑规划

#### Phase 0：需求冻结与契约冻结
- 完成 docs/product/requirements.md、Canonical Domain Model、权限矩阵、状态机、API 契约。
- 冻结最小 MVP 范围。
- 明确 Feature Mapper、ParameterSet、ReplayHash 的工程契约。fileciteturn0file12

#### Phase 1：MVP 核心闭环
- 用户登录与租户隔离
- 教师开课与学员组队
- 决策提交
- 回合结算
- 结果反馈
- 基础复盘fileciteturn0file18 fileciteturn0file19

#### Phase 2：AI 与 Replay 增强
- Strategy Advisor / Debrief Coach 最小闭环
- Replay / Shadow Replay
- ParameterSet 审批工作流
- 学习记录与初步诊断fileciteturn0file11 fileciteturn0file12 fileciteturn0file13

#### Phase 3：行业插件与多场景
- 康养插件 v1
- 行业插件工厂
- 场景包与模板市场
- 多行业扩展预研fileciteturn0file10 fileciteturn0file15 fileciteturn0file16 fileciteturn0file17

#### Phase 4：社区、竞赛与持续学习
- 社区
- 公开竞赛
- 学习诊断增强
- 推荐系统
- 企业培训看板fileciteturn0file18 fileciteturn0file19

### 需求追踪矩阵

| 需求编号 | 需求名称 | 优先级 | 关联模块 | 验收方式 |
|---|---|---|---|---|
| FR-001 | 用户与权限 | P0 | Auth / Tenant / Role | 权限测试、租户隔离测试 |
| FR-002 | 课程管理 | P0 | Course Service | E2E、课程流转测试 |
| FR-003 | 场景管理 | P0 | Scenario / Plugin | 契约测试、版本测试 |
| FR-004 | 队伍与角色 | P0 | Team Service | E2E、协作权限测试 |
| FR-005 | 回合控制 | P0 | Round Service | 状态机测试 |
| FR-006 | 决策提交 | P0 | Decision Service | Validator 测试 |
| FR-007 | 仿真核心引擎 | P0 | Engine / Ledger | Golden Solver、Replay |
| FR-008 | 计量核心模型 | P1 | Calibration / PyBLP Adapter | Shadow Replay |
| FR-009 | AI 小模型 | P1 | Coach / Agent System | AI 边界测试 |
| FR-010 | 教师端 | P0 | Teacher Console | 教师主流程 E2E |
| FR-011 | 学员端 | P0 | Learner App | 学员主流程 E2E |
| FR-012 | 管理后台 | P0 | Admin / Audit | 审计与审批测试 |
| FR-013 | 社区模块 | P2 | Community | 审核与推荐测试 |
| FR-014 | 竞赛模块 | P2 | Competition | 赛制与排行榜测试 |
| FR-015 | 学习诊断 | P1 | LRS / Analytics | 指标与报告测试 |
| FR-016 | 行业插件 | P1 | Plugin Runtime | 插件写权限测试 |

### 待确认问题

- MVP 是否只支持一个行业插件，还是同时支持至少两个行业场景？
- 是否必须在 MVP 阶段支持多租户？
- 企业 SSO、SCIM 预配是否进入 P1？
- LMS 集成是否在首版接入 LTI，还是后置？
- 评分规则是否允许教师自定义权重，还是仅允许选模板？
- 决策是“团队统一提交”还是“角色分工后合并提交”？
- ParameterSet 审批是否需要双人复核？
- Replay 申诉与仲裁由谁审批？
- 社区与公开竞赛是否进入正式 MVP，还是作为 P2/P3？
- AI 模型将私有部署、混合部署，还是调用外部 API？
- 康养插件是否作为首个商用场景，还是只做研究样例？
- 移动端是否是首版目标，还是仅提供响应式 Web？

上述待确认项主要集中在治理强度、MVP 边界、对外集成和行业优先级，若不尽快确认，会直接影响 API、数据模型、权限矩阵与里程碑。fileciteturn0file12 fileciteturn0file18 fileciteturn0file19
