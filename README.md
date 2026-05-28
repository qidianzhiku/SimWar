# Sim War

**Badge 占位**：Build Status · License · Version · Tech Stack · Deployment

Sim War 是一个面向高管培训、商学院课程与企业学习场景的 SaaS 仿真商战平台。平台以“结构化仿真真值内核 + 小模型协同体系 + 教师端 / 学员端 / 社区 / 竞赛”的方式组织产品能力，支持多轮经营决策、结构化结算、复盘分析、学习诊断、持续进化与跨行业场景扩展。fileciteturn0file1fileciteturn0file8fileciteturn0file9

> 说明：本 README 基于参考文档整理生成。其中技术选型、目录结构、环境变量、脚本命名和部署命令，包含了结合文档做出的**建议默认值**；如果你的实际仓库与本文示例不同，请以实际项目实现为准并及时修改。当前高置信方向是：以 BLP/RCNL 为 L1 真值核心、采用“行业无关 kernel + 行业插件”双层架构，并通过 Replay / Shadow Replay、参数冻结、事件溯源与模型治理机制，保证平台“可解释、可复算、可审计、可回滚”。fileciteturn0file0fileciteturn0file2fileciteturn0file5fileciteturn0file7

## 项目概览

### 项目概述

Sim War 的核心目标，不是做一个“会聊天的商战机器人”，而是构建一个可用于高管训练、课程对抗、企业推演与持续学习的商业仿真操作系统。平台将**市场需求与供给真值、运营约束、财务评分、学习诊断和 AI 教练能力**分层组织：L1 负责需求与供给真值，L2 负责运营兑现，L3 负责财务与评分，L4 负责小模型建议与复盘，L5 负责校准、审批、发布与回滚。这样的设计使 Sim War 既能支撑课堂和竞赛场景，又能支撑企业级个性化场景和未来跨行业扩展。fileciteturn0file1fileciteturn0file2fileciteturn0file4

平台主要面向以下用户群体：

- 商学院、大学与培训机构教师
- 企业大学与高管培训组织者
- 学员团队与参赛队伍
- 场景设计师、数据科学家与模型治理团队
- 需要做行业推演、教学复盘或企业案例定制的产品与咨询团队

从业务价值看，Sim War 解决的是“复杂经营训练难以标准化、难以复盘、难以量化学习迁移”的问题。平台通过**结构化决策表单、可审计结算链、角色对抗、教师干预、社区协作、竞赛排名和学习账本**，把“赛、学、证、社、评”连接成一个持续学习闭环。fileciteturn0file8fileciteturn0file9

当前参考文档显示，Sim War 的首个高保真场景聚焦康养 / 银发经济方向，尤其是“北京—燕郊一体化康养市场”这一母场景；但平台架构本身并不绑定某一个行业，而是通过 kernel/plugin 模式保留向零售、制造、金融、能源等场景迁移的能力。fileciteturn0file5fileciteturn0file6fileciteturn0file7fileciteturn0file8

### 核心功能

| 模块       | 功能名称                                 | 简短说明                                         | 用户价值 / 业务价值            |
| ---------- | ---------------------------------------- | ------------------------------------------------ | ------------------------------ |
| 课程与教学 | 课程管理                                 | 创建课程、班级、轮次与教学运行实例               | 支持教师快速开课与组织多轮课程 |
| 场景与模拟 | 场景配置                                 | 选择模板、配置参数、生成运行包                   | 让教学场景标准化、可复用、可控 |
| 回合与结算 | 回合控制                                 | 开轮、锁轮、结算、发布结果                       | 保证教学节奏和公平性           |
| 学员端     | 团队驾驶舱                               | 展示 KPI、历史状态、可见情报                     | 让团队在信息约束下做经营决策   |
| 学员端     | 结构化决策提交                           | 按价格、营销、质量、融资、战略等字段提交决策     | 降低决策噪音，提升可比较性     |
| 结果反馈   | 三段式结果页                             | 呈现“发生了什么、为什么、下一步风险”             | 提高复盘效率与学习迁移效果     |
| AI 能力    | 策略建议与角色代理                       | 由小模型输出建议、证据卡、风险挑战、角色互动     | 帮助学员形成更高质量的决策假设 |
| AI 能力    | Debrief Coach                            | 自动生成复盘草稿、对比分析与改进建议             | 降低教师复盘成本               |
| 治理能力   | Replay / Shadow Replay                   | 正式回放与候选参数 / 模型的阴影回放              | 保障可信计算与版本安全         |
| 治理能力   | 参数与模型治理                           | 参数冻结、候选评测、审批、发布与回滚             | 避免边讲边改模型破坏公平性     |
| 持续学习   | 反思与诊断                               | 通过反思日志、学习账本和诊断指标输出能力画像     | 把“结果表现”扩展为“学习表现”   |
| 社区与竞赛 | 社区协作                                 | 经验分享、项目协作、内容推荐与导师互动           | 形成持续学习网络               |
| 社区与竞赛 | 公开竞赛与排行榜                         | 支持赛制、匹配、排名、奖项与记录                 | 拓展课程外的竞赛运营与品牌活动 |
| 场景工厂   | 主题生成 / 企业脱敏定制 / 跨行业场景生成 | 统一通过 Scenario Compiler 与 Shadow Replay 发布 | 提高平台扩展速度并控制风险     |

以上模块综合自核心引擎设计、教师/学员端白皮书、整体功能深化文档以及康养定制与跨行业扩展研究文档。文档明确强调：**真值由结构化引擎输出，小模型只负责建议与解释；平台能力以课程、社区、竞赛、学习诊断和治理闭环共同构成。**fileciteturn0file1fileciteturn0file5fileciteturn0file8fileciteturn0file9

### 技术栈

> 下表为依据参考文档整理的**推荐技术组合**。其中部分条目来自文档中的明确建议，部分为便于项目落地而做出的工程化补全；请根据实际仓库修改。

| 分类       | 技术                                              | 用途                                              |
| ---------- | ------------------------------------------------- | ------------------------------------------------- |
| 前端       | React / Next.js / TypeScript                      | 教师端、学员端、社区与竞赛前端                    |
| 业务服务   | TypeScript 服务                                   | API 网关、BFF、课程管理、回合控制、社区与竞赛服务 |
| 计量服务   | Python + PyBLP                                    | L1 市场求解、离线校准、反事实与诊断               |
| 契约层     | OpenAPI 3.1 + JSON Schema + Protobuf              | 合同优先开发、接口生成、契约测试                  |
| 交互协议   | REST / GraphQL / EventBus                         | 前后端交互与服务解耦                              |
| 学习记录   | xAPI + LRS                                        | 学习事件记录、诊断分析与审计                      |
| 教学集成   | LTI 1.3 + SCIM 2.0                                | LMS 接入、成绩回传、身份同步                      |
| 数据存储   | PostgreSQL / ClickHouse / 湖仓 / 对象存储         | 事务数据、分析查询、训练数据与事件归档            |
| AI 能力    | 8B–14B 中文强项主模型 + RAG + 工具调用 + 角色代理 | 策略建议、复盘、推荐、交互与内容生成              |
| 基础设施   | Docker / Kubernetes / CI/CD                       | 本地开发、容器部署、扩缩容、灰度发布              |
| 监控与治理 | 模型注册表、参数注册表、审计日志、可观测系统      | 模型治理、回滚、合规与运营监控                    |

文档明确给出了以下方向：**Python 计量服务 + TypeScript 业务服务 + OpenAPI-first + JSON Schema/Protobuf 契约 + 事件驱动架构**；同时教师/学员端白皮书建议采用 React/Next.js/FastAPI 等组合，DevOps 使用 Docker/Kubernetes 与 CI/CD，数据层支持 PostgreSQL、ClickHouse、湖仓和特征工厂；小模型部分建议以 8B–14B 中文强项模型作为策略与教练核心。fileciteturn0file2fileciteturn0file3fileciteturn0file8fileciteturn0file9

## 系统架构

### 项目架构

Sim War 的架构核心不是“多几个智能体”，而是**明确谁可以写什么**。平台推荐采用两套互相配合的结构视角：

- **业务视角**：四层五区  
  应用层（教师端、学员端、企业后台、社区、竞赛前台）  
  决策层（仿真引擎、AI 决策助手、小模型推理）  
  数据层（湖仓、特征工厂、LRS、知识库）  
  治理层（权限、审计、合规、CI/CD、模型治理）fileciteturn0file8fileciteturn0file9
- **求解与治理视角**：L1-L5  
  L1 需求/供给真值  
  L2 运营约束  
  L3 财务与评分  
  L4 小模型 / 交互层  
  L5 校准、Replay / Shadow Replay、审批与发布fileciteturn0file2fileciteturn0file4fileciteturn0file5

推荐的 monorepo 目录结构如下：

```bash
simwar/
├── contracts/
│   ├── jsonschema/
│   │   ├── decision_payload.v1.json
│   │   ├── market_offer_observation.v1.json
│   │   ├── simulated_agent_pool.v1.json
│   │   ├── parameter_set.v1.json
│   │   ├── feature_mapping_result.v1.json
│   │   ├── solver_result.v1.json
│   │   ├── replay_report.v1.json
│   │   └── coach_output.v1.json
│   ├── openapi/
│   │   ├── market_solver.openapi.yaml
│   │   ├── calibration_service.openapi.yaml
│   │   ├── replay_service.openapi.yaml
│   │   └── coach_orchestrator.openapi.yaml
│   └── protobuf/
│       ├── events.proto
│       └── solver.proto
├── services/
│   ├── api-gateway/
│   ├── decision-validator/
│   ├── scenario-compiler/
│   ├── feature-mapper/
│   ├── market-solver-py/
│   ├── operations-solver/
│   ├── finance-score-engine/
│   ├── replay-service/
│   ├── parameter-registry/
│   ├── model-governance/
│   ├── coach-orchestrator/
│   ├── teacher-bff/
│   └── student-bff/
├── apps/
│   ├── teacher-web/
│   ├── student-web/
│   ├── community-web/
│   └── competition-web/
├── data/
│   ├── migrations/
│   ├── seed_scenarios/
│   ├── instrument_recipes/
│   ├── feature_recipes/
│   └── synthetic_panels/
├── tests/
│   ├── contract_tests/
│   ├── replay_tests/
│   ├── solver_golden_tests/
│   ├── shadow_replay_tests/
│   ├── performance_tests/
│   └── l4_boundary_tests/
├── docs/
│   ├── architecture/
│   ├── model_contracts/
│   ├── calibration_playbooks/
│   ├── teacher_student_views/
│   └── runbooks/
├── docker-compose.yml
├── .env.example
└── README.md
```

目录职责说明：

- `contracts/`：整个平台的契约层，是 contract-first 开发的起点。
- `services/`：核心业务、计量求解、BFF、治理与编排服务。
- `apps/`：建议增加的前端应用层，用于承接教师端、学员端、社区与竞赛视图。
- `data/`：场景种子、特征配方、仪器变量配方、迁移脚本与合成面板。
- `tests/`：契约、回放、Golden、性能与 L4 越权边界测试。
- `docs/`：架构文档、模型契约、部署说明、运维手册和教学视图设计。

上述目录中，`contracts/`、`services/`、`data/`、`tests/`、`docs/` 为工程契约报告的明确建议；`apps/` 是为了衔接教师端、学员端、社区与竞赛前端而做的推荐扩展层。fileciteturn0file1fileciteturn0file2fileciteturn0file8

### 数据库设计

> 以下为基于 Canonical Domain Model、事件账本、学习记录与多租户平台能力抽象出的**建议性结构**，请根据实际数据库与 ORM 方案调整。

| 表 / 集合             | 说明                                              |
| --------------------- | ------------------------------------------------- |
| `tenants`             | 多租户信息与隔离配置                              |
| `users`               | 用户主体信息                                      |
| `user_roles`          | 用户、课程、租户、团队级角色绑定                  |
| `courses`             | 课程、班级与教学运行配置                          |
| `runs`                | 一次完整模拟运行实例                              |
| `rounds`              | 回合 / period 信息，含开轮、锁轮、结算状态        |
| `teams`               | 队伍与角色槽位配置                                |
| `scenario_packages`   | 场景包定义与版本信息                              |
| `plugin_manifests`    | 行业插件元数据与能力声明                          |
| `parameter_sets`      | 参数集、版本、状态、审批记录                      |
| `offers`              | Offer / 产品 / 服务包抽象实体                     |
| `segments`            | 客群、市场细分与目标组                            |
| `decisions`           | 学员或系统提交的结构化决策                        |
| `shock_events`        | 教师注入的冲击事件                                |
| `state_snapshots`     | `state_true` / `state_obs` / `state_est` 状态快照 |
| `replay_reports`      | Replay / Shadow Replay 差异报告                   |
| `coach_outputs`       | 策略建议、风险挑战、复盘草稿等 L4 输出            |
| `xapi_statements`     | 学习行为记录与审计日志                            |
| `community_posts`     | 社区帖子与协作内容                                |
| `competition_records` | 竞赛赛制、报名、对阵与排行榜记录                  |
| `license_records`     | 授权内容与训练使用边界记录                        |

如果你使用 ORM，推荐将业务服务与计量服务在模型层解耦：业务服务负责 `tenant / course / run / team / decision / replay / content governance`，计量求解服务负责 `MarketOfferObservation / AgentPool / ParameterSet / SolverResult` 等求解相关对象。文档明确指出，平台的可扩展性来自稳定的 Canonical Domain Model，而不是把某个行业字段直接写死到求解核中。fileciteturn0file1fileciteturn0file2fileciteturn0file4

## 快速开始

当前仓库已经具备 Phase 0 工程基线与 Phase 1 多租户身份权限底座：npm workspaces、TypeScript API、签名会话 token、Tenant/User/RBAC/AuditLog、教师端/学员端/Admin 端 Vite React 应用、共享契约包、基础测试和契约门禁。详细技术栈见 `docs/devops/tech-stack.md`。

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run test:contract
npm run build
```

本地启动：

```bash
npm run dev:api
npm run dev:admin
npm run dev:teacher
npm run dev:student
```

健康检查：

```bash
curl http://localhost:3000/healthz
```

本地种子账号：

| 入口     | 租户              | 用户名     | 密码       |
| -------- | ----------------- | ---------- | ---------- |
| 管理端   | `tenant_platform` | `platform` | `platform` |
| 教师端   | `tenant_demo`     | `teacher`  | `teacher`  |
| 学员端   | `tenant_demo`     | `student`  | `student`  |
| 租户管理 | `tenant_demo`     | `admin`    | `admin`    |

API 默认把 P1 演示数据保存到 `tmp/simwar-store.json`。如需重置本地演示状态，停止 API 后删除该文件再启动。

### 环境要求

建议准备以下开发环境：

- Node.js 20+
- Python 3.11+
- Docker / Docker Compose
- PostgreSQL
- 可选：ClickHouse、对象存储、消息队列
- Git

这些要求来自文档中对 TypeScript 业务服务、Python 计量服务、Docker/Kubernetes、湖仓与分析数据库的组合建议。fileciteturn0file2fileciteturn0file8

### 克隆项目

```bash
git clone <repository-url>
cd simwar
```

### 安装依赖

> 以下命令为示例。若你的仓库使用 `pnpm`、`yarn`、`poetry`、`uv` 或其他工具，请替换为实际命令。

```bash
# 安装前端与 TypeScript 服务依赖
npm install

# 安装 Python 计量服务依赖
cd services/market-solver-py
pip install -r requirements.txt
cd ../..
```

### 配置环境变量

创建 `.env.example`，并复制为 `.env.local` 或 `.env`：

```env
APP_ENV=development
APP_PORT=3000

TENANT_MODE=single
JWT_SECRET=<your-jwt-secret>
SESSION_SECRET=<your-session-secret>

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/simwar
ANALYTICS_DATABASE_URL=<clickhouse-or-analytics-db-url>
OBJECT_STORAGE_ENDPOINT=<object-storage-endpoint>
OBJECT_STORAGE_BUCKET=<object-storage-bucket>

EVENT_BUS_URL=<event-bus-url>
LRS_ENDPOINT=<lrs-endpoint>
LRS_KEY=<lrs-key>
LRS_SECRET=<lrs-secret>

API_GATEWAY_URL=http://localhost:3000
TEACHER_BFF_URL=http://localhost:3010
STUDENT_BFF_URL=http://localhost:3020
MARKET_SOLVER_URL=http://localhost:8100
REPLAY_SERVICE_URL=http://localhost:8200
COACH_ORCHESTRATOR_URL=http://localhost:8300

LLM_PROVIDER=<provider-name>
LLM_BASE_URL=<llm-base-url>
LLM_API_KEY=<llm-api-key>
LLM_MODEL=<llm-model-name>

DEFAULT_SCENARIO_PACKAGE_ID=<scenario-package-id>
DEFAULT_PARAMETER_SET_ID=<parameter-set-id>
LICENSED_CONTENT_ZONE_PATH=<licensed-content-zone-path>
```

### 启动开发环境

> 推荐做法是分别启动网关 / BFF / 计量求解服务，便于调试。“脚本名称”请按实际仓库实现调整。

```bash
# 终端 1：启动业务服务 / 网关
npm run dev

# 终端 2：启动 Python 计量服务
cd services/market-solver-py
python -m uvicorn simwar_solver.api.app:app --reload --host 0.0.0.0 --port 8100
```

如果前端独立拆分为多个应用，可以额外启动：

```bash
npm run dev:teacher-web
npm run dev:student-web
npm run dev:community-web
npm run dev:competition-web
```

### 使用 Docker 启动

```bash
docker compose up --build
```

推荐本地开发优先跑通以下最小闭环：**创建课程 → 创建 run → 开轮 → 提交决策 → 锁轮 → 结算 → 发布结果 → 复盘**。这是文档中对 P0 Definition of Done 的核心要求。fileciteturn0file1fileciteturn0file2

## 使用说明

### 使用说明

一个典型的 Sim War 使用流程如下：

1. 教师在教师端创建课程、选择场景模板、配置参数集与可见性规则。
2. 系统生成 `run`，并为各团队绑定角色、预算、初始状态与场景材料。
3. 学员在团队驾驶舱中查看本队状态、情报卡、历史数据与研究报告。
4. 学员提交结构化决策，系统通过 `Decision Validator` 检查字段合法性、权限与约束。
5. 核心引擎按 `Decision Validator → Market & Demand Engine → Operations Engine → Finance Engine → Scoring Engine` 的顺序完成结算。
6. 系统向教师端、学员端和小模型分别发布不同权限级别的状态快照。
7. 教师可查看全局结果、差异分析、角色贡献与风险预警，并决定是否注入 `ShockEvent`。
8. 学员提交反思与修正，平台把决策、结果、对话、反思与点评统一写入 LRS / xAPI 学习账本。
9. 若进行参数或模型升级，必须通过 Shadow Replay 后才可进入正式运行。fileciteturn0file1fileciteturn0file2fileciteturn0file8fileciteturn0file9

推荐的访问入口如下：

- 教师端：`/teacher`
- 学员端：`/student`
- 企业后台：`/admin`
- 社区：`/community`
- 竞赛前台：`/competition`

> 路由为示例，请根据前端路由实际实现修改。

如果你要演示当前最成熟的课程线，建议以**北京—燕郊康养一体化**场景作为首个试点：它同时具备行业高保真、政策可参数化、需求迁移明显、竞赛脚本清晰与跨行业插件验证价值。fileciteturn0file5fileciteturn0file6fileciteturn0file7

下面给出一个学员提交决策的示例：

```bash
curl -X POST http://localhost:3000/api/v1/runs/run_demo_001/decisions \
  -H "Content-Type: application/json" \
  -d '{
    "team_id": "team_alpha",
    "round_no": 1,
    "price_strategy": {
      "base_price": 12800,
      "discount_policy": "controlled"
    },
    "marketing_strategy": {
      "brand_budget": 300000,
      "channel_budget": 180000,
      "research_budget": 50000
    },
    "service_strategy": {
      "service_quality_budget": 220000,
      "staffing_plan": "balanced",
      "capacity_plan": "hold"
    },
    "finance_strategy": {
      "financing_action": "none",
      "cash_buffer_target": 0.15
    },
    "strategy_statement": "优先守住高净值细分市场，同时控制现金风险。"
  }'
```

### API 文档

核心 API 推荐按“运行与结算接口”“教师 / 学员交互接口”“插件与场景接口”三类组织。

#### 运行与结算接口

| 方法   | 路径                                                     | 描述                               | 鉴权                      |
| ------ | -------------------------------------------------------- | ---------------------------------- | ------------------------- |
| `POST` | `/api/v1/runs`                                           | 创建一次运行实例，绑定场景与参数集 | 教师 / 管理员             |
| `POST` | `/api/v1/runs/{run_id}/decisions`                        | 提交团队决策                       | 学员 / 队长               |
| `GET`  | `/api/v1/runs/{run_id}/rounds/{round_no}/state-snapshot` | 获取本轮状态快照                   | 团队 / 教师，按可见性裁剪 |
| `POST` | `/api/v1/runs/{run_id}/rounds/{round_no}/settle`         | 触发本轮结算                       | 教师 / 内部服务           |
| `POST` | `/internal/v1/runs/{run_id}/rounds/{round_id}/settle`    | 内部真值结算入口                   | 内部服务令牌              |
| `POST` | `/api/v1/replays/shadow`                                 | 执行 Shadow Replay                 | 治理团队                  |

#### AI 与复盘接口

| 方法   | 路径                                      | 描述                 | 鉴权        |
| ------ | ----------------------------------------- | -------------------- | ----------- |
| `POST` | `/api/v1/agents/strategy-advisor/propose` | 获取策略建议         | 学员 / 教师 |
| `POST` | `/api/v1/agents/debrief-coach/generate`   | 生成复盘草稿         | 教师 / 学员 |
| `POST` | `/api/v1/licensed-content/retrieve`       | 在授权范围内检索内容 | 受控服务    |

#### 插件与场景接口

| 方法   | 路径                                          | 描述                      | 鉴权                  |
| ------ | --------------------------------------------- | ------------------------- | --------------------- |
| `POST` | `/api/plugins/{pluginId}/compile-context`     | 编译行业上下文            | 教师 / 场景设计师     |
| `POST` | `/api/plugins/{pluginId}/adjust-utility`      | 计算行业效用修正项        | 内部服务              |
| `POST` | `/api/plugins/{pluginId}/segment-migration`   | 计算客群迁移矩阵          | 内部服务              |
| `POST` | `/api/plugins/{pluginId}/qualification-check` | 资格与可服务性校验        | 内部服务              |
| `POST` | `/api/plugins/{pluginId}/apply-shock`         | 把冲击映射为插件局部变化  | 教师 / 内部服务       |
| `POST` | `/api/scenarios/generate-theme`               | 生成主题场景包            | 教师 / 场景设计师     |
| `POST` | `/api/scenarios/personalize-enterprise`       | 生成脱敏企业定制场景      | 教师 / 企业管理员     |
| `POST` | `/api/scenarios/generate-industry`            | 生成新行业骨架与插件 stub | 场景设计师 / 治理团队 |

上述接口来自核心引擎与小模型接口契约、工程契约报告以及康养定制接口设计文档。它们共同体现了一个原则：**小模型只能读取状态快照与受控工具，不能直接改写真值字段；唯一真值结算入口必须可回放、可审计。**fileciteturn0file1fileciteturn0file2fileciteturn0file5

一个内部结算结果示例：

```bash
curl -X POST http://localhost:3000/internal/v1/runs/run_demo_001/rounds/1/settle \
  -H "Authorization: Bearer <internal-service-token>"
```

一个状态快照获取示例：

```bash
curl http://localhost:3000/api/v1/runs/run_demo_001/rounds/1/state-snapshot \
  -H "Authorization: Bearer <user-token>"
```

## 质量保障与部署

### 测试

Sim War 的测试不应只覆盖前端交互和普通 API，而应覆盖**契约一致性、Replay 一致性、Golden test、L4 越权边界、Shadow Replay 稳定性**。参考文档已经给出明确的测试分层与验收思路。fileciteturn0file1fileciteturn0file2fileciteturn0file9

建议的测试分层如下：

- **单元测试**：校验各服务内部函数、规则与求解组件
- **契约测试**：验证 OpenAPI / JSON Schema / Protobuf 与实现一致
- **集成测试**：跑通课程、回合、结算、复盘完整链路
- **Replay 测试**：同输入、同参数、同 seed 结果一致
- **Solver Golden Test**：保证核心求解结果不被意外改坏
- **Shadow Replay Test**：验证候选参数 / 模型不会破坏稳定性与公平性
- **L4 Boundary Test**：验证小模型无权写入 `state_true` 等真值字段
- **性能测试**：验证高并发下的延迟、吞吐与回滚能力
- **合规测试**：验证授权内容、AI 输出标识、租户隔离与品牌边界

示例命令如下：

```bash
# TypeScript 服务测试
npm test

# Python 求解服务测试
pytest services/market-solver-py/tests -q

# 推荐增加的分层脚本
npm run test:contract
npm run test:replay
npm run test:e2e
npm run test:performance
```

如果你采用 monorepo，建议在根目录再补充一个统一命令：

```bash
make test
```

### 部署

参考文档推荐的部署方向是：**本地 Docker 开发 + 云上 Kubernetes 部署 + CI/CD 灰度发布 + 多租户隔离 + 模型与参数审批**。fileciteturn0file8fileciteturn0file9

#### 本地部署

适合单机开发与联调：

```bash
docker compose up --build
```

#### Docker 部署

推荐将以下组件容器化：

- API Gateway
- Teacher BFF
- Student BFF
- Market Solver Python Service
- Replay Service
- Coach Orchestrator
- PostgreSQL / 分析数据库
- LRS
- 对象存储 / 向量检索 / 消息队列

#### Kubernetes 部署

适合 SaaS 生产环境，建议：

- 使用命名空间隔离环境
- 使用 HPA 进行弹性扩缩容
- 通过 Ingress / API Gateway 暴露统一入口
- 将参数集与模型版本纳入发布流水线
- 使用蓝绿或滚动发布策略
- 关键服务接入日志、指标与告警

示例命令：

```bash
kubectl apply -f deploy/
```

#### 生产环境注意事项

- 正式运行必须绑定已审批的 `ParameterSet`
- 任何中途变化都应作为 `ShockEvent`，而不是直接改参数
- 小模型升级前必须经过 Shadow Replay 与评测门禁
- 多租户环境要确保数据、日志、模型与内容使用范围隔离
- 学习记录、反思文本、推荐内容与社区帖子需纳入审计

## 研发协作

### 开发规范

建议团队遵循以下工程原则：

- **Contract-first**：先冻结 OpenAPI、JSON Schema、事件 schema 和权限矩阵，再实现代码
- **真值隔离**：L1-L3 只允许结构化内核写入；L4 只输出建议、证据、解释和复盘草稿
- **事件溯源**：所有关键行为写入 Event Store，不允许篡改历史
- **参数冻结**：run 启动后，`parameter_set_id` 不可变
- **可回放优先**：正式结果必须可通过 Replay Engine 重建
- **合规优先**：授权内容、品牌边界、租户隔离和 AI 输出标识必须前置设计

推荐的分支命名：

```bash
feature/<feature-name>
fix/<bug-name>
docs/<doc-name>
refactor/<module-name>
chore/<task-name>
```

推荐的 Commit 规范：

```bash
feat: add run orchestrator state machine
fix: validate locked round before settlement
docs: update replay workflow in README
refactor: split market solver and replay service
test: add shadow replay regression cases
```

Pull Request 流程建议：

1. 从主分支切出功能分支
2. 完成开发并补充测试
3. 通过 lint / unit / contract / replay / security 检查
4. 提交 PR 并说明影响范围、风控点和回滚方案
5. 至少由业务负责人 + 架构负责人 + 模型 / 数据负责人共同审阅
6. 合并后进入灰度或内部试点环境

这些规范直接呼应文档中的 contract-first、参数治理、Shadow Replay、权限分层和审计要求。fileciteturn0file1fileciteturn0file2fileciteturn0file5

### Roadmap

> 以下路线图综合自多份参考文档，分为“已完成的设计产出”“当前开发重点”和“后续规划”。请根据真实进度修改。

#### 已完成

```markdown
- [x] 平台总体愿景、四层五区与六平面架构设计
- [x] L1-L5 写权限边界与真值中心原则定义
- [x] 核心服务拆分：Run Orchestrator / Scenario Compiler / Replay Engine 等
- [x] Canonical Domain Model 与关键契约草案
- [x] 教师端、学员端、社区、竞赛的功能蓝图
```

#### 开发中

```markdown
- [ ] Contract freeze：冻结 OpenAPI、JSON Schema、事件 schema 与权限矩阵
- [ ] 核心运行闭环：开课、锁轮、提交、结算、发布、复盘
- [ ] Python 市场求解服务与 TypeScript 业务服务打通
- [ ] Eldercare Plugin v1 与北京—燕郊高保真场景包
- [ ] 教师端 / 学员端 MVP
- [ ] xAPI / LRS 学习账本贯通
```

#### 计划中

```markdown
- [ ] Theme Generator / Enterprise Twin / Industry Plugin Stub Generator
- [ ] 社区平台与公开竞赛 MVP
- [ ] Shadow Replay 自动化发布门禁
- [ ] Plugin Registry 与跨行业 Plugin Factory
- [ ] 多租户、国际化与合规模块增强
- [ ] 学习诊断、推荐系统与长期持续学习闭环
```

参考文档给出了两套节奏：一套偏“12 个月平台开发计划”，一套偏“契约冻结 → 康养 v1 → 三类定制 → 试点 → 跨行业扩展”的产品路线；两者在优先级上是一致的，都是把**先冻结契约、先跑通真值闭环**放在第一位。fileciteturn0file3fileciteturn0file5fileciteturn0file8fileciteturn0file9

### 贡献指南

欢迎以 issue、PR、文档修订、测试补充、场景模板改进或插件能力扩展等形式参与贡献。

基本流程如下：

1. Fork 项目
2. 创建功能分支
3. 提交代码与测试
4. 发起 Pull Request
5. 等待 Review 并根据意见修改
6. 合并后进入内部验证或灰度环境

贡献者请特别注意以下边界：

- 不要让 L4 小模型越权写入真值字段
- 不要绕过 `ParameterSet` 审批与 Replay 门禁
- 不要向公共内容面泄露企业脱敏前数据
- 不要在未明确审查前引入可能产生品牌背书暗示的内容
- 不要在代码或测试中写入真实密钥、真实授权正文或受限原始资料

## 附加说明

### FAQ

#### 为什么平台不允许小模型直接写入市场份额、利润或最终分数？

因为 Sim War 的设计原则是“真值中心在结构化仿真层”，小模型只能做建议、解释、对练、复盘和推荐。这样可以确保正式成绩可回放、可审计、可争议处理。fileciteturn0file1fileciteturn0file2

#### 如何重置一次运行的测试数据？

推荐做法是删除本地开发环境中的演示 `run` 数据、状态快照、Replay 报告和临时事件流，然后重新导入种子场景。示例：

```bash
docker compose down -v
docker compose up --build
```

如果你的项目使用数据库迁移工具，请再执行对应的 seed 命令。

#### 如何新增一个行业插件？

推荐路径不是直接让 LLM “写完整行业游戏”，而是补齐 `PluginManifest + ScenarioPackage + 知识证据包 + Shadow Replay`，经教师或治理团队审核后进入 `Plugin Registry`。fileciteturn0file5fileciteturn0file7

#### 平台能否使用授权教学内容做检索或模型训练？

文档明确指出：**已获得授权且在授权清单范围内的内容**，可以用于授权生成式 AI 工具、RAG、训练、评测和推理增强；但内容授权不等于品牌背书授权，超出授权范围的内容、工具、地域、用途和模型版本不得默认纳入。fileciteturn0file1

#### 平台对外传播时需要注意什么？

即使系统内部可在授权范围内使用部分内容，对外也不应暗示任何外部机构、学校、出版社或品牌对 Sim War 产品、赛事、证书或商业活动背书。README、官网、证书页、公开竞赛页和营销物料都应将“内容授权”和“品牌背书”严格分开。fileciteturn0file1

#### 如何理解当前首个行业场景与未来扩展的关系？

当前首个高保真母场景建议聚焦康养行业，尤其是北京—燕郊一体化市场；但平台的长期结构明确是跨行业的 kernel/plugin 架构，因此未来可以逐步扩展至零售、制造、金融、能源等行业。fileciteturn0file0fileciteturn0file5fileciteturn0file7

### 许可证

本项目默认使用 **MIT License** 作为开源占位方案；如果你的项目属于商业闭源或混合授权模式，请将本节替换为实际许可证文本。

```text
MIT License

Copyright (c) <year> <organization>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files...
```

> 请根据实际项目修改。

### 联系方式 / 相关链接

- 官方文档：`<official-docs-link>`
- 在线演示：`<demo-link>`
- 问题反馈：`<support-link>`
- 联系邮箱：`<contact-email>`
- GitHub Issues：`<issues-link>`
- 项目主页：`<project-homepage-link>`

如果你计划将 Sim War 用于企业项目、教学合作或定制化场景开发，建议另外准备：

- `docs/architecture/`：架构设计文档
- `docs/runbooks/`：部署与应急手册
- `docs/model_contracts/`：模型与参数契约
- `docs/teacher_student_views/`：教师端 / 学员端操作手册

这些文档类型与参考资料中的工程拆解、运维要求、教师/学员流程和开发手册建议保持一致。fileciteturn0file2fileciteturn0file8fileciteturn0file9
