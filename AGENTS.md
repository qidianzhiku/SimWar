# SimWar Codex Development Guide

本文件是 SimWar 仓库的 Codex/Agent 开发说明，作用范围为整个仓库。
任何自动化开发、代码生成、重构、测试和评审都应优先遵守本文件。

## Project Status

- 当前仓库尚未形成完整源码工程；不要假定已存在 Node.js、Python、Docker 或 CI 配置。
- 若新增源码、依赖清单、测试或部署配置，必须同步更新本文件中的目录结构和命令。
- 原型期允许先建立最小可运行闭环，但不得跳过真值保护、契约测试和审计事件设计。

## Product Architecture

SimWar 采用“行业无关内核 + 行业插件”的微内核架构。

- Core kernel: 负责对象模型、仿真推进、市场/运营/财务真值计算、评分、事件存储和权限边界。
- Industry plugins: 负责行业参数、场景、需求曲线、成本结构、政策规则和教学内容扩展。
- Agent services: 只提供建议、诊断、复盘或候选决策；不得直接改写真值字段。
- Applications: 教师端、学员端、企业后台、竞赛平台和社区界面通过 API 调用核心能力。

核心原则：结构化仿真引擎是真值来源。LLM 或 Agent 输出必须经过核心引擎校验、落事件、再结算。

## Tool Autonomy And Confirmation

在本地开发、测试、文档、代码修改、浏览器验证和 Git 本地提交范围内，Codex 可以默认自动调用相关工具并自主推进任务，无需用户逐步确认。

Codex 默认可自动执行以下操作：

- 读取、搜索、比较和修改本仓库文件。
- 使用 `rg`、Shell、`apply_patch`、Git diff 等工具进行代码和文档开发。
- 安装或使用项目已声明的本地依赖，运行 `npm install`、`npm run lint`、`npm run typecheck`、`npm test`、`npm run test:contract`、`npm run build` 等开发命令。
- 启动、检查或停止本地开发服务，例如 API、教师端、学员端和本地依赖容器。
- 使用 Browser / Playwright 等工具验证本地页面、交互流程、控制台错误和响应式表现。
- 根据 `DEVELOPMENT_PLAN.md` 中的模块推荐工具自动选择实现、验证、安全和质量工具。
- 在任务完成后进行本地 Git 检查；如任务明确要求提交，可按 Conventional Commits 创建本地提交。

以下操作必须先说明风险并等待用户明确指令：

- 外部账号授权或连接器授权，例如 GitHub、Google Drive、Gmail、Google Calendar、Supabase、Figma、Canva 等首次登录或 OAuth 授权。
- 生产环境、预发布环境、真实客户环境或远端数据库操作。
- 删除数据库、清空目录、批量删除文件、重写 Git 历史、强制推送、覆盖远端分支等不可逆或高破坏性操作。
- 发布 PR、推送远端、发送邮件、创建日程、共享文档、公开发布内容或触发付费资源。
- 处理真实密钥、令牌、真实用户数据、企业敏感数据、模型私有权重或未授权内容。
- 任何可能让 AI 或 Agent 绕过真值保护、权限边界、审计链路或 Replay / Shadow Replay 门禁的操作。

即使用户授权自动执行，Codex 仍必须遵守本文件的真值保护、安全合规、测试和文档规则。若推荐工具不可用，应说明原因并采用安全替代方案。

## Repository Layout

当前建议目录结构如下。新增代码时优先按此组织；如实际技术栈调整，请同步修改本节。

```text
apps/
  teacher/              教师端应用
  student/              学员端应用
  admin/                企业或平台后台
services/
  api/                  主业务 API 服务
  simulation-core/      仿真内核、结算、评分、事件存储
  agent-gateway/        Agent 调度、权限过滤、输入输出校验
  market-agent/         市场策略 Agent
  operations-agent/     运营决策 Agent
  coach-agent/          教练复盘 Agent
  diagnostic-agent/     风险诊断 Agent
plugins/
  wellness/             康养行业插件示例
contracts/
  openapi/              REST API 契约
  schemas/              JSON Schema 契约
tests/
  contract/             契约测试
  integration/          集成测试
  replay/               Shadow Replay 回放测试
docs/
  architecture/         架构与方案文档
  devops/               部署、运维、回滚文档
```

## Development Commands

在对应配置文件存在前，不要运行不存在的命令。新增技术栈后，把真实命令写到这里。

```powershell
# Inspect repository files
rg --files

npm install
npm run lint
npm run typecheck
npm test
npm run test:contract
npm run build
npm run dev:api
npm run dev:admin
npm run dev:teacher
npm run dev:student

# Python projects, only when pyproject.toml exists
poetry install
poetry run pytest
poetry run ruff check .
poetry run black --check .

# Docker, only when Dockerfile exists
docker build -t simwar/service:local .
```

本地 API 默认使用 `tmp/simwar-store.json` 作为 P1 演示快照文件；自动化测试应使用内存 store，避免依赖或污染本地开发快照。

如果项目引入 Makefile 或任务编排工具，应优先提供以下稳定入口：

```powershell
make setup
make lint
make test
make build
```

## Coding Rules

- 优先沿用仓库既有技术栈、目录结构、命名和测试风格。
- 保持变更聚焦；不要在功能修复中混入无关重构。
- 接口、事件、模型输入输出必须使用结构化 schema，不要依赖临时字符串拼接。
- 业务规则应放在核心内核或行业插件中；Agent 服务不得隐藏结算逻辑。
- 所有用户可见文案、教学反馈和复盘报告应可追溯到输入数据、决策日志或评分规则。
- 新增共享模块时必须补充最小单元测试；跨服务行为必须补充契约测试或集成测试。

## Truth Protection

以下字段类型属于真值字段，只能由核心仿真引擎或受控插件计算和写入：

- 市场份额、需求量、成交量、价格指数
- 现金流、利润、资产负债、融资结果
- 库存、产能、生产成本、交付结果
- 评分、排名、胜负结果、结算状态
- 任何用于教学评价、竞赛排名或财务结算的最终指标

Agent 可以读取必要上下文并生成建议，但输出必须写入建议字段、候选决策字段或事件日志。
不得让 LLM 直接覆盖真值字段。

## Agent Contracts

所有 Agent 接口必须明确输入、输出、版本和权限。推荐最小请求结构：

```json
{
  "agentType": "MarketStrategy",
  "version": "1.0.0",
  "actor": {
    "role": "student",
    "teamId": "team-001"
  },
  "scenarioId": "scenario-001",
  "round": 1,
  "payload": {}
}
```

推荐最小响应结构：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "recommendations": [],
    "confidence": 0.8,
    "explanations": []
  }
}
```

Agent 输出落库前必须经过：

1. schema 校验
2. 权限校验
3. 真值字段写入检查
4. 事件日志记录
5. 可回放输入保存

## Security And Compliance

- 训练、评估和复盘数据必须脱敏，避免暴露学生、企业、团队或个人敏感信息。
- 不同角色的数据访问必须隔离：教师、学生、管理员、企业用户和 Agent 服务只获得必要权限。
- 外部模型、数据集和依赖必须检查许可证、来源和安全风险。
- 关键操作必须记录审计日志，包括参数修改、模型部署、Agent 调用、评分结算和人工干预。
- 模型版本必须可回滚；上线前需通过回放评估或灰度验证。

## Testing Expectations

- Contract tests: 校验 API 请求、响应、错误码和 schema 兼容性。
- Unit tests: 覆盖核心计算、插件规则、权限判断和数据转换。
- Integration tests: 覆盖仿真内核、插件、Agent gateway 和应用端关键路径。
- Replay tests: 使用历史或固定种子场景验证结果稳定性。
- Security tests: 覆盖越权访问、真值字段写入、敏感数据泄露和提示注入风险。

合并前至少运行与变更相关的最小测试集合；若无法运行测试，必须在交付说明中说明原因。

## Git And Review Rules

- 提交信息使用 Conventional Commits，例如 `feat: add market agent contract`。
- 每个 PR 应说明变更范围、测试结果、风险和回滚方式。
- 接口或真值模型变更必须附带契约更新和回放验证说明。
- 不要提交密钥、令牌、真实用户数据、模型私有权重或本地环境文件。

## Documentation Rules

- 架构方案、里程碑和长篇背景资料放入 `docs/`，不要塞进本文件。
- 本文件只保留 Codex 开发所需的可执行规则和约束。
- 若命令、目录、服务名或契约发生变化，更新代码的同一变更中必须更新对应文档。
