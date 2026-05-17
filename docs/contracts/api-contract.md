# SimWar API Contract

建议文件名：`docs/contracts/api-contract.md`。

SimWar 被定位为一个面向高管培训、商学院课程与企业学习场景的 SaaS 平台 / AI 仿真平台 / 企业高管培训与商战模拟系统。其业务主链覆盖教师开课、学员组队、多轮决策、回合结算、AI 复盘、Replay / Shadow Replay、行业插件扩展与持续学习闭环；其技术主线则以“核心仿真引擎唯一写真值、AI 小模型只读建议、ParameterSet 正式运行不可变、Replay / Shadow Replay 作为发布门禁、Kernel 稳定且 Plugin 可扩展”为统一约束。fileciteturn0file9 fileciteturn0file10 fileciteturn0file11 fileciteturn0file19

## 文档定位与核心约束

本文档定义 SimWar 的第一版业务 API、内部结算 API 与治理 API 契约，作为前后端联调、OpenAPI 生成、契约测试、集成测试、审计追踪与后续代码实现的统一基线。文档覆盖用户认证与权限、课程管理、队伍与角色管理、回合与决策管理、仿真结算、AI 建议、Replay / Shadow Replay、行业插件管理、审计与日志九大模块，并默认对齐现有的 `docs/product/requirements.md`、`docs/architecture/system-architecture.md`、核心引擎与小模型文档、教师端 / 学员端文档与行业插件研究结论。fileciteturn0file6 fileciteturn0file9 fileciteturn0file10 fileciteturn0file11 fileciteturn0file15

| 项目 | 内容 |
|---|---|
| 项目名称 | SimWar |
| 文档名称 | API Contract |
| 推荐文件名 | `docs/contracts/api-contract.md` |
| 文档状态 | Draft v1.0 |
| 适用范围 | MVP ～ v1.0 |
| 契约风格 | Contract-first / OpenAPI-first |
| 对外路径前缀 | `/api/v1` |
| 对内可信路径前缀 | `/internal/v1` |
| 主要读者 | 架构师、后端工程师、前端工程师、计量工程、AI 工程、测试与治理团队 |

下列约束属于本合同的不可妥协前提；若后续实现与这些条款冲突，以这些条款为准，并应通过 ADR 或治理流程显式变更，而不是在实现中静默偏离。fileciteturn0file10 fileciteturn0file11 fileciteturn0file15 fileciteturn0file19

| 约束 | 等级 | 契约要求 |
|---|---|---|
| 核心仿真引擎唯一写真值 | P0 | 只有 L1–L3 核心引擎可写 `state_true`、正式 `SettlementResult`、正式 `Score`、`Rank` |
| AI 小模型只读边界 | P0 | AI 只能读取裁剪后的 `state_obs` / `state_est`、授权知识与工具结果，只能写 `CoachOutput`、`debrief_draft`、`risk_card` 等 advisory 对象 |
| ParameterSet 不可变 | P0 | `approved` 的 ParameterSet 不可覆盖；Run 启动后绑定 `parameter_set_id`，运行期间不可变更 |
| Replay / Shadow Replay 门禁 | P0 | 参数集、插件版本、模型版本与评分规则的发布前必须通过 Shadow Replay；历史正式成绩不得被回写覆盖 |
| 写操作审计 | P0 | 所有写接口均写入 `AuditLog`，关键操作包含 actor、scope、trace、request hash、版本信息 |
| 正式结算幂等性 | P0 | 正式结算需满足相同输入返回相同 `replay_hash`，并防止重复副作用 |
| 多租户隔离 | P0 | 所有读取与写入都要同时经过 `X-Tenant-Id`、RBAC、scope 与字段级可见性裁剪 |
| 插件写边界 | P0 | Plugin 仅可通过受控 hook 写 `utility_shift`、`eligibility_mask`、`migration_matrix`、`policy_cost_shift` 等局部变化量，不得直写正式成绩与历史快照 |
| 正式运行与沙盒隔离 | P1 | Teacher Sandbox、Counterfactual Sandbox、Shadow Replay 与 Official Settlement 要物理或逻辑隔离 |
| 授权与品牌边界 | P1 | 授权内容使用与品牌背书是两套治理边界；未授权内容默认不可外显或进入训练链路 |

## 通用契约约定

SimWar 采用 Contract-first。对外与对内 HTTP 契约以 OpenAPI 3.1 为基线；学习记录建议以 xAPI / LRS 对关键学习动作建模；LMS 集成优先采用 LTI 1.3；企业身份预配优先采用 SCIM；内部高频事件与求解调用采用 JSON Schema 与 Protobuf 双轨契约。JSON 字段使用 `snake_case`，路径使用 `kebab-case`，实体主键统一为 `<entity>_id`。fileciteturn0file10 fileciteturn0file9 fileciteturn0file15

**通用请求头**

| Header | 必填 | 说明 |
|---|---:|---|
| `Authorization: Bearer <ACCESS_TOKEN>` | 受保护接口必填 | 用户或服务身份令牌 |
| `X-Tenant-Id` | 是 | 租户隔离标识 |
| `X-Request-Id` | 否 | 请求级追踪 ID；若未传入可由网关生成 |
| `Idempotency-Key` | P0 写接口必填，其他写接口强烈建议 | 用于安全重试，特别是决策提交、锁轮、结算、审批、插件发布、审计导出 |
| `If-Match` | PATCH / PUT 推荐 | 乐观锁版本控制 |
| `X-Service-Principal` | 内部服务接口必填 | 标识 `service_kernel`、`service_ai` 等内部调用方 |

**通用响应包**

```json
{
  "request_id": "req_xxx",
  "code": "OK",
  "message": "success",
  "data": {}
}
```

**通用错误响应**

```json
{
  "request_id": "req_xxx",
  "code": "DEC-422-001",
  "message": "decision validation failed",
  "details": [
    {
      "field": "pricing.items[0].price",
      "reason": "out_of_range"
    }
  ]
}
```

**核心可见性与对象约定**

| 对象 / 字段 | 契约说明 |
|---|---|
| `state_true` | L1–L3 真值链合并后的正式状态；仅引擎内部、治理角色与教师授权摘要可见 |
| `state_obs` | 按可见性策略发布的可观察状态；学员、教师、AI 可读 |
| `state_est` | 基于研究动作与估计机制生成的估计状态；学员、教师、AI 可读 |
| `ReplayHash` | 用于保证“相同输入可复算、相同门径可审计”的结果签名 |
| `ScenarioPackage` | 课程运行使用的场景包，包含模板、插件绑定、轮次脚本与场景配置 |
| `PluginPackage` | 行业插件包；版本化治理，不可在运行中漂移 |
| `ParameterSet` | 真值参数集；`approved` 后不可覆盖 |
| `mapping_trace_ref` | Feature Mapper 映射轨迹引用；仅治理角色、企业管理员与审核教师可见完全体 |

**角色代码**

| 角色代码 | 说明 |
|---|---|
| `platform_admin` | 平台级超级管理员 |
| `tenant_admin` | 租户管理员 |
| `teacher` | 教师 / 教练 |
| `learner` | 学员 |
| `team_captain` | 队长 |
| `scenario_designer` | 场景设计师 |
| `model_governor` | 模型治理 / 参数审批人员 |
| `ops` | 系统运维 / 审计人员 |
| `service_kernel` | 核心仿真引擎服务身份 |
| `service_ai` | AI 编排服务身份，只读业务快照 |

**幂等与审计规则**

正式结算接口以 `run_id + round_no + decision_batch_id + parameter_set_id + random_seed` 形成稳定输入集，并返回稳定 `replay_hash`。同租户、同 actor、同路径、同 `Idempotency-Key`、同请求体哈希的关键写接口不得产生重复副作用。所有写操作必须入审计，且审计记录至少包含 actor、tenant、scope、trace、request hash、变更前后版本、审批链或依赖对象摘要。fileciteturn0file6 fileciteturn0file10 fileciteturn0file15 fileciteturn0file8

**请求示例模板**

以下命令用于说明联调风格；示例中的 Token、ID、版本、时间戳均为占位符。接口落地后，建议同时在 `contracts/openapi/` 与 `contracts/schemas/` 中沉淀正式契约文件，并以契约测试守护兼容性。fileciteturn0file7 fileciteturn0file8

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: tenant_demo" \
  -d '{
    "username": "<USERNAME>",
    "password": "<PASSWORD>",
    "client_type": "web"
  }'
```

```bash
curl -X POST http://localhost:3000/api/v1/runs/<RUN_ID>/rounds/1/decisions \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: tenant_demo" \
  -H "Idempotency-Key: dec-r1-team1-v3" \
  -d '{
    "team_id": "team_001",
    "decision_payload": {
      "offers": [],
      "finance": {}
    },
    "client_revision": 3
  }'
```

```bash
curl -X POST http://localhost:3000/api/v1/replays/shadow \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: tenant_demo" \
  -H "Idempotency-Key: shadow-param-1-4-2" \
  -d '{
    "source_run_id": "run_001",
    "candidate_parameter_set_id": "param_candidate_1_4_2",
    "candidate_plugin_versions": [
      {"plugin_id":"plugin_eldercare","version":"1.3.0"}
    ],
    "acceptance_profile": "default_governance_profile"
  }'
```

## 接口总览

### 当前 P1 落地接口补充（2026-05-17）

当前 TypeScript API 已落地一组本地可运行的 P1 身份与治理接口，并由 `contracts/openapi/p0-api.openapi.yaml`、`contracts/schemas/*.v1.json` 和 `scripts/check-contracts.mjs` 做最小契约门禁：

| 模块 | 方法 | 路径 | 当前权限 |
|---|---|---|---|
| Auth | `POST` | `/api/v1/auth/login` | 匿名，需 `X-Tenant-Id` |
| Auth | `POST` | `/api/v1/auth/logout` | 已认证用户 |
| Auth | `GET` | `/api/v1/auth/me` | 已认证用户 |
| Admin | `GET` | `/api/v1/admin/state` | `user:read` |
| Tenant | `GET` | `/api/v1/admin/tenants` | `tenant:read` |
| Tenant | `POST` | `/api/v1/admin/tenants` | `tenant:create`，仅平台管理员 |
| User | `GET` | `/api/v1/admin/users` | `user:read` |
| User | `POST` | `/api/v1/admin/users` | `user:create`，禁止租户管理员分配 `platform_admin` |
| User | `PATCH` | `/api/v1/admin/users/{userId}` | `user:update`，禁止跨租户迁移与真值字段写入 |
| RBAC | `GET` | `/api/v1/rbac/roles` | `rbac:read` |
| RBAC | `GET` | `/api/v1/rbac/permissions` | `rbac:read` |
| Audit | `GET` | `/api/v1/audit/logs` | `audit:read`，支持 `tenant_id/action/actor_id/resource_type` 过滤 |

当前本地实现使用 Node 内置 `crypto` 生成 PBKDF2 密码哈希与 HMAC 签名 session token；数据可通过 `SIMWAR_STORE_FILE` 保存为 JSON 快照，生产数据库迁移仍应在后续阶段替换。

下表是 v1 范围内冻结的接口总览。该清单以现有 API 契约草案为主线，吸收了需求文档、系统架构、内核治理与行业插件文档中的共识，优先覆盖课堂交付、结算可信、AI 辅助、治理门禁与审计闭环。fileciteturn0file6 fileciteturn0file9 fileciteturn0file10 fileciteturn0file19

| 接口编号 | 模块 | 方法 | 路径 | 描述 | 权限 | 优先级 |
|---|---|---|---|---|---|---|
| API-001 | 用户认证与权限 | POST | `/api/v1/auth/login` | 用户登录 | 公共 | P0 |
| API-002 | 用户认证与权限 | POST | `/api/v1/auth/refresh` | 刷新访问令牌 | 已持有刷新令牌 | P0 |
| API-003 | 用户认证与权限 | GET | `/api/v1/auth/me` | 查询当前会话上下文 | 已认证用户 | P0 |
| API-004 | 用户认证与权限 | POST | `/api/v1/role-bindings` | 创建角色绑定 | 管理员 / 受限教师 | P0 |
| API-005 | 课程管理 | GET | `/api/v1/courses` | 查询课程列表 | 教师 / 租户管理员 | P0 |
| API-006 | 课程管理 | POST | `/api/v1/courses` | 创建课程草稿 | 教师 / 租户管理员 | P0 |
| API-007 | 课程管理 | POST | `/api/v1/scenarios/compile` | 编译场景包 | 教师 / 场景设计师 / 租户管理员 | P0 |
| API-008 | 课程管理 | PATCH | `/api/v1/courses/{courseId}` | 更新课程及绑定场景 / 参数 | 教师 / 租户管理员 | P0 |
| API-009 | 课程管理 | POST | `/api/v1/courses/{courseId}/publish` | 发布课程 | 教师 / 租户管理员 | P0 |
| API-010 | 课程管理 | POST | `/api/v1/courses/{courseId}/archive` | 归档课程 | 教师 / 租户管理员 | P1 |
| API-011 | 队伍与角色管理 | POST | `/api/v1/courses/{courseId}/teams` | 创建队伍 | 教师 / 租户管理员 | P0 |
| API-012 | 队伍与角色管理 | PUT | `/api/v1/teams/{teamId}/members` | 批量配置成员与角色槽位 | 教师 / 租户管理员 | P0 |
| API-013 | 队伍与角色管理 | GET | `/api/v1/teams/{teamId}/dashboard` | 查询团队驾驶舱 | 团队成员 / 教师 / 租户管理员 | P0 |
| API-014 | 回合与决策管理 | POST | `/api/v1/courses/{courseId}/runs` | 创建 Run 并冻结版本 | 教师 / 租户管理员 | P0 |
| API-015 | 回合与决策管理 | POST | `/api/v1/runs/{runId}/rounds/{roundNo}/start` | 启动回合 | 教师 / 租户管理员 | P0 |
| API-016 | 回合与决策管理 | POST | `/api/v1/runs/{runId}/rounds/{roundNo}/lock` | 锁定回合 | 教师 / 租户管理员 | P0 |
| API-017 | 回合与决策管理 | POST | `/api/v1/runs/{runId}/rounds/{roundNo}/decisions` | 提交团队决策 | 学员 / 队长 / 教师代理 | P0 |
| API-018 | 回合与决策管理 | GET | `/api/v1/runs/{runId}/rounds/{roundNo}/state-snapshot` | 获取裁剪后的状态快照 | 团队成员 / 教师 / 只读 AI 服务 | P0 |
| API-019 | 仿真结算接口 | POST | `/internal/v1/runs/{runId}/rounds/{roundNo}/settle` | 正式真值结算入口 | `service_kernel` | P0 |
| API-020 | 仿真结算接口 | GET | `/api/v1/runs/{runId}/rounds/{roundNo}/results` | 查询回合结果 | 团队成员 / 教师 / 管理员 | P0 |
| API-021 | AI 建议接口 | POST | `/api/v1/agents/strategy-advisor/propose` | 生成策略建议 | 学员 / 教师 / `service_ai` | P1 |
| API-022 | AI 建议接口 | POST | `/api/v1/agents/debrief-coach/generate` | 生成复盘草稿 | 教师 / 团队成员 / `service_ai` | P1 |
| API-023 | AI 建议接口 | POST | `/api/v1/recommendations/learning-feed` | 生成学习推荐流 | 学员 / 教师 | P2 |
| API-024 | Replay / Shadow Replay | POST | `/api/v1/replays/shadow` | 发起 Shadow Replay | 教师 / 治理 / 租户管理员 | P0 |
| API-025 | Replay / Shadow Replay | GET | `/api/v1/replays/{replayId}` | 查询 Replay 报告 | 教师 / 治理 / 管理员 | P0 |
| API-026 | Replay / Shadow Replay | POST | `/api/v1/governance/parameter-sets/{parameterSetId}/approve` | 审批 ParameterSet | 模型治理 / 平台管理员 | P0 |
| API-027 | 行业插件管理 | GET | `/api/v1/plugins` | 查询插件列表 | 教师 / 场景设计师 / 租户管理员 | P1 |
| API-028 | 行业插件管理 | POST | `/api/v1/plugins` | 上传插件包 | 平台管理员 / 受策略约束的场景设计师 | P0 |
| API-029 | 行业插件管理 | POST | `/api/v1/plugins/{pluginId}/compile-context` | 编译插件上下文 | 教师 / 场景设计师 / `service_kernel` | P1 |
| API-030 | 行业插件管理 | POST | `/api/v1/plugins/{pluginId}/release` | 发布插件版本 | 平台管理员 / 模型治理 | P0 |
| API-031 | 审计与日志 | GET | `/api/v1/audit/logs` | 查询审计日志 | 运维 / 管理员 / 课程级教师摘要 | P0 |
| API-032 | 审计与日志 | GET | `/api/v1/audit/entities/{entityType}/{entityId}/timeline` | 查询实体审计时间线 | 运维 / 管理员 / 课程级教师摘要 | P1 |
| API-033 | 审计与日志 | POST | `/api/v1/audit/exports` | 导出审计包 | 运维 / 平台管理员 / 模型治理 | P1 |

## 业务主链接口

以下接口覆盖“登录 → 建课 → 组队 → 创建 Run → 开轮 → 提交决策 → 锁轮 → 读取快照 → 结算结果 → AI 辅助”的主业务链路。正式前端与 BFF 可以基于这些接口继续细分组合视图，但不得绕过它们直接写入真值对象。尤其是 `API-019`，它是正式真值写入口，不对普通前端或 AI 暴露写权限。fileciteturn0file6 fileciteturn0file10 fileciteturn0file7 fileciteturn0file15

**API-001 登录**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-001 |
| 模块归属 | 用户认证与权限 |
| HTTP 方法 | `POST` |
| 路径 | `/api/v1/auth/login` |
| 接口描述 | 用户登录并获取访问令牌与刷新令牌 |
| 请求参数 | Header：`X-Tenant-Id`；Body：`username`、`password`、`client_type` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_login_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"access_token\": \"<ACCESS_TOKEN>\",\n    \"refresh_token\": \"<REFRESH_TOKEN>\",\n    \"expires_in\": 3600,\n    \"user\": {\n      \"user_id\": \"usr_001\",\n      \"display_name\": \"<USER_NAME>\",\n      \"roles\": [\"teacher\"],\n      \"tenant_id\": \"tenant_demo\"\n    }\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`400 AUTH-400-001` 参数缺失；`401 AUTH-401-001` 用户名或密码错误；`423 AUTH-423-001` 账号锁定 |
| 权限要求 | 匿名 |
| 优先级 | P0 |
| 可测试验收标准 | 正确凭证返回 token；错误凭证不泄露账户存在性；登录成功写入审计登录事件 |
| 注意事项 / 约束 | 仅返回会话上下文，不返回敏感资料；预留 MFA 扩展位 |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 |

**API-002 刷新令牌**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-002 |
| 模块归属 | 用户认证与权限 |
| HTTP 方法 | `POST` |
| 路径 | `/api/v1/auth/refresh` |
| 接口描述 | 使用刷新令牌换取新访问令牌 |
| 请求参数 | Header：`X-Tenant-Id`；Body：`refresh_token` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_refresh_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"access_token\": \"<NEW_ACCESS_TOKEN>\",\n    \"expires_in\": 3600\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`401 AUTH-401-002` 刷新令牌失效；`409 AUTH-409-001` 会话已吊销 |
| 权限要求 | 已持有有效刷新令牌 |
| 优先级 | P0 |
| 可测试验收标准 | access token 过期但 refresh token 有效时可刷新；吊销会话必须失败；刷新行为可审计 |
| 注意事项 / 约束 | 刷新不改变用户角色与课程 / 队伍绑定 |
| 来源依据 | fileciteturn0file6 |

**API-003 查询当前会话**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-003 |
| 模块归属 | 用户认证与权限 |
| HTTP 方法 | `GET` |
| 路径 | `/api/v1/auth/me` |
| 接口描述 | 查询当前用户、租户、角色与课程 / 团队绑定上下文 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`；Query：`include_bindings=true|false` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_me_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"user_id\": \"usr_001\",\n    \"tenant_id\": \"tenant_demo\",\n    \"roles\": [\"teacher\"],\n    \"course_bindings\": [\n      {\"course_id\": \"course_001\", \"role\": \"teacher\"}\n    ]\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`401 AUTH-401-003` 令牌无效 |
| 权限要求 | 任意已认证用户 |
| 优先级 | P0 |
| 可测试验收标准 | 教师可看到课程绑定；学员可看到本队上下文；跨租户 token 不得返回其他租户信息 |
| 注意事项 / 约束 | 只负责当前会话上下文，不承担成员目录查询 |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 |

**API-004 创建角色绑定**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-004 |
| 模块归属 | 用户认证与权限 |
| HTTP 方法 | `POST` |
| 路径 | `/api/v1/role-bindings` |
| 接口描述 | 将用户绑定到租户、课程或团队级角色 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`、`Idempotency-Key`；Body：`user_id`、`scope_type`、`scope_id`、`role_code`、`effective_from` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_role_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"binding_id\": \"rb_001\",\n    \"status\": \"active\"\n  }\n}\n``` |
| 状态码与错误码 | `201` 创建成功；`403 AUTH-403-001` 权限不足；`409 AUTH-409-002` 绑定冲突；`422 AUTH-422-001` 角色与作用域不兼容 |
| 权限要求 | `platform_admin`、`tenant_admin`；课程教师仅可绑定本课程学员及队伍角色 |
| 优先级 | P0 |
| 可测试验收标准 | 幂等重试不重复创建；教师不能越权给其他租户授予角色；写入审计日志 |
| 注意事项 / 约束 | 建议实现互斥角色检查；课程与团队绑定必须受 scope 校验 |
| 来源依据 | fileciteturn0file6 fileciteturn0file9 fileciteturn0file10 |

**API-005 查询课程列表**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-005 |
| 模块归属 | 课程管理 |
| HTTP 方法 | `GET` |
| 路径 | `/api/v1/courses` |
| 接口描述 | 查询课程列表，支持状态、教师和分页过滤 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`；Query：`status`、`teacher_id`、`page`、`page_size` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_course_list_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"items\": [\n      {\n        \"course_id\": \"course_001\",\n        \"name\": \"SimWar 演练班\",\n        \"status\": \"draft\",\n        \"scenario_package_id\": \"scn_001\",\n        \"parameter_set_id\": \"param_approved_1_4_2\"\n      }\n    ],\n    \"total\": 1\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`403 CRS-403-001` 无课程查看权限 |
| 权限要求 | `teacher`、`tenant_admin` |
| 优先级 | P0 |
| 可测试验收标准 | 教师仅看到自己负责课程；租户管理员仅看到本租户课程；分页结果正确 |
| 注意事项 / 约束 | 默认读取不写业务审计；可选记录敏感访问痕迹 |
| 来源依据 | fileciteturn0file6 fileciteturn0file9 |

**API-006 创建课程**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-006 |
| 模块归属 | 课程管理 |
| HTTP 方法 | `POST` |
| 路径 | `/api/v1/courses` |
| 接口描述 | 创建课程草稿并绑定初始教学目标 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`、`Idempotency-Key`；Body：`name`、`description`、`teaching_objectives`、`review_required`、`planned_rounds` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_course_create_001\",\n  \"code\": \"OK\",\n  \"message\": \"created\",\n  \"data\": {\n    \"course_id\": \"course_001\",\n    \"status\": \"draft\"\n  }\n}\n``` |
| 状态码与错误码 | `201` 创建成功；`409 CRS-409-001` 名称冲突；`422 CRS-422-001` 参数不完整 |
| 权限要求 | `teacher`、`tenant_admin` |
| 优先级 | P0 |
| 可测试验收标准 | 默认状态为 `draft`；同幂等键返回同一课程 ID；创建写入审计日志 |
| 注意事项 / 约束 | 本接口不冻结参数集，不发布课程 |
| 来源依据 | fileciteturn0file6 fileciteturn0file9 fileciteturn0file10 |

**API-007 编译场景包**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-007 |
| 模块归属 | 课程管理 |
| HTTP 方法 | `POST` |
| 路径 | `/api/v1/scenarios/compile` |
| 接口描述 | 根据场景模板、插件版本、政策参数与轮次脚本编译可执行 `ScenarioPackage` |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`、`Idempotency-Key`；Body：`scenario_template_id`、`plugin_id`、`plugin_version`、`policy_params`、`round_script`、`evidence_refs` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_scn_compile_001\",\n  \"code\": \"OK\",\n  \"message\": \"compiled\",\n  \"data\": {\n    \"scenario_package_id\": \"scn_001\",\n    \"version\": \"1.0.0\",\n    \"status\": \"draft\",\n    \"mapping_trace_ref\": \"mt_001\"\n  }\n}\n``` |
| 状态码与错误码 | `201` 编译成功；`409 SCN-409-001` 模板版本冲突；`422 SCN-422-001` 模板或证据不满足契约 |
| 权限要求 | `teacher`、`scenario_designer`、`tenant_admin` |
| 优先级 | P0 |
| 可测试验收标准 | 场景包返回版本号与编译状态；无效插件版本必须拒绝；编译事件写入版本库与审计 |
| 注意事项 / 约束 | 只生成草稿场景包，不启动正式 Run |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 fileciteturn0file12 fileciteturn0file19 |

**API-008 更新课程**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-008 |
| 模块归属 | 课程管理 |
| HTTP 方法 | `PATCH` |
| 路径 | `/api/v1/courses/{courseId}` |
| 接口描述 | 更新课程草稿信息，或在发布前绑定 `ScenarioPackage` 与 `ParameterSet` |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`、`If-Match`、`Idempotency-Key`；Path：`courseId`；Body：`name`、`description`、`scenario_package_id`、`parameter_set_id`、`schedule` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_course_patch_001\",\n  \"code\": \"OK\",\n  \"message\": \"updated\",\n  \"data\": {\n    \"course_id\": \"course_001\",\n    \"status\": \"draft\",\n    \"version\": 3\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`409 CRS-409-002` 版本冲突；`422 CRS-422-002` 参数集未批准或场景未编译完成 |
| 权限要求 | `teacher`、`tenant_admin` |
| 优先级 | P0 |
| 可测试验收标准 | 发布前允许绑定 approved ParameterSet；发布后仅允许有限字段更新；更新生成审计明细 |
| 注意事项 / 约束 | 推荐仅在 `draft / review` 阶段修改核心绑定 |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 fileciteturn0file15 |

**API-009 发布课程**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-009 |
| 模块归属 | 课程管理 |
| HTTP 方法 | `POST` |
| 路径 | `/api/v1/courses/{courseId}/publish` |
| 接口描述 | 将课程从草稿 / 待审核状态发布为可创建 Run 的课程 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`、`Idempotency-Key`；Path：`courseId`；Body：`publish_note` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_course_publish_001\",\n  \"code\": \"OK\",\n  \"message\": \"published\",\n  \"data\": {\n    \"course_id\": \"course_001\",\n    \"status\": \"published\"\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`409 CRS-409-003` 当前状态不可发布；`428 CRS-428-001` 缺少已批准参数集或可执行场景包 |
| 权限要求 | `teacher`、`tenant_admin`；若启用审核，需审核通过记录 |
| 优先级 | P0 |
| 可测试验收标准 | 发布前校验 `ScenarioPackage`、`PluginVersion`、`ParameterSet` 均可用；状态迁移可追踪；审计完整 |
| 注意事项 / 约束 | 发布不等于启动 Run；真正冻结发生在 Run 创建时 |
| 来源依据 | fileciteturn0file6 fileciteturn0file9 fileciteturn0file10 |

**API-010 归档课程**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-010 |
| 模块归属 | 课程管理 |
| HTTP 方法 | `POST` |
| 路径 | `/api/v1/courses/{courseId}/archive` |
| 接口描述 | 将课程归档，停止新 Run 创建 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`、`Idempotency-Key`；Path：`courseId`；Body：`reason` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_course_archive_001\",\n  \"code\": \"OK\",\n  \"message\": \"archived\",\n  \"data\": {\n    \"course_id\": \"course_001\",\n    \"status\": \"archived\"\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`409 CRS-409-004` 存在进行中 Run，禁止归档 |
| 权限要求 | `teacher`、`tenant_admin` |
| 优先级 | P1 |
| 可测试验收标准 | 进行中 Run 时禁止归档；归档后只读；归档原因写入审计 |
| 注意事项 / 约束 | 归档不删除历史数据 |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 |

**API-011 创建队伍**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-011 |
| 模块归属 | 队伍与角色管理 |
| HTTP 方法 | `POST` |
| 路径 | `/api/v1/courses/{courseId}/teams` |
| 接口描述 | 在课程下创建一个队伍 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`、`Idempotency-Key`；Path：`courseId`；Body：`name`、`team_code`、`initial_capital`、`risk_limits` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_team_create_001\",\n  \"code\": \"OK\",\n  \"message\": \"created\",\n  \"data\": {\n    \"team_id\": \"team_001\",\n    \"course_id\": \"course_001\"\n  }\n}\n``` |
| 状态码与错误码 | `201` 成功；`409 TEAM-409-001` 队伍编码冲突；`422 TEAM-422-001` 初始资本或风险限额非法 |
| 权限要求 | `teacher`、`tenant_admin` |
| 优先级 | P0 |
| 可测试验收标准 | 创建后可被成员绑定；幂等重试不重复建队；写入审计日志 |
| 注意事项 / 约束 | 创建队伍不自动分配成员 |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 fileciteturn0file19 |

**API-012 批量配置队伍成员与角色槽位**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-012 |
| 模块归属 | 队伍与角色管理 |
| HTTP 方法 | `PUT` |
| 路径 | `/api/v1/teams/{teamId}/members` |
| 接口描述 | 批量设置成员、队长与角色槽位，如 CEO / CFO / CMO / COO |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`、`If-Match`、`Idempotency-Key`；Path：`teamId`；Body：`members[]`（每项含 `user_id`、`role_slot`、`is_captain`） |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_team_members_001\",\n  \"code\": \"OK\",\n  \"message\": \"updated\",\n  \"data\": {\n    \"team_id\": \"team_001\",\n    \"member_count\": 5,\n    \"role_slots\": [\"CEO\", \"CFO\", \"CMO\", \"COO\"]\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`409 TEAM-409-002` 角色槽位冲突；`422 TEAM-422-002` 用户不在课程范围内 |
| 权限要求 | `teacher`、`tenant_admin` |
| 优先级 | P0 |
| 可测试验收标准 | 同一角色槽位不能重复分配；队长唯一；成员与绑定变更均有审计记录 |
| 注意事项 / 约束 | 可预留空槽位供 RoleCoverage / Autopilot 兜底，但必须显式标记 |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 fileciteturn0file19 |

**API-013 查询团队驾驶舱**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-013 |
| 模块归属 | 队伍与角色管理 |
| HTTP 方法 | `GET` |
| 路径 | `/api/v1/teams/{teamId}/dashboard` |
| 接口描述 | 返回团队 KPI、历史成绩、当前回合上下文与公开排名摘要 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`；Path：`teamId`；Query：`run_id`、`visible_state=state_obs|state_est` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_team_dashboard_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"team_id\": \"team_001\",\n    \"run_id\": \"run_001\",\n    \"kpis\": {\n      \"revenue\": 1200000,\n      \"profit\": 180000,\n      \"rank\": 2,\n      \"risk_score\": 0.12\n    },\n    \"visible_state\": \"state_obs\"\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`403 TEAM-403-001` 非本队学员不可查看私有驾驶舱；`404 TEAM-404-001` 队伍不存在 |
| 权限要求 | 团队成员、课程教师、租户管理员 |
| 优先级 | P0 |
| 可测试验收标准 | 学员默认只看到 `state_obs / state_est`；教师可看教师级摘要；跨队私有数据隔离生效 |
| 注意事项 / 约束 | 禁止暴露完整 `state_true`、完整弹性矩阵与完整 ParameterSet |
| 来源依据 | fileciteturn0file6 fileciteturn0file9 fileciteturn0file10 |

**API-014 创建运行**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-014 |
| 模块归属 | 回合与决策管理 |
| HTTP 方法 | `POST` |
| 路径 | `/api/v1/courses/{courseId}/runs` |
| 接口描述 | 基于已发布课程创建一次 `Run`，并冻结所用场景包、插件版本、参数集版本 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`、`Idempotency-Key`；Path：`courseId`；Body：`stage`、`seed`、`start_round_no`、`plugin_version_overrides` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_run_create_001\",\n  \"code\": \"OK\",\n  \"message\": \"created\",\n  \"data\": {\n    \"run_id\": \"run_001\",\n    \"status\": \"preparing\",\n    \"bound_parameter_set_id\": \"param_approved_1_4_2\",\n    \"bound_plugin_versions\": [\n      {\"plugin_id\": \"plugin_eldercare\", \"version\": \"1.2.0\"}\n    ]\n  }\n}\n``` |
| 状态码与错误码 | `201` 成功；`409 RUN-409-001` 课程状态不可创建 Run；`428 RUN-428-001` 参数集 / 插件版本未批准 |
| 权限要求 | `teacher`、`tenant_admin` |
| 优先级 | P0 |
| 可测试验收标准 | 创建 Run 后绑定版本不可漂移；重复请求安全返回；审计记录参数与插件绑定详情 |
| 注意事项 / 约束 | 推荐显式传入 `seed`，以支持 deterministic replay |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 fileciteturn0file19 |

**API-015 启动回合**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-015 |
| 模块归属 | 回合与决策管理 |
| HTTP 方法 | `POST` |
| 路径 | `/api/v1/runs/{runId}/rounds/{roundNo}/start` |
| 接口描述 | 启动指定回合并开放决策窗口 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`、`Idempotency-Key`；Path：`runId`、`roundNo`；Body：`window_open_at`、`window_close_at`、`shock_plan_refs` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_round_start_001\",\n  \"code\": \"OK\",\n  \"message\": \"started\",\n  \"data\": {\n    \"run_id\": \"run_001\",\n    \"round_no\": 1,\n    \"status\": \"in_progress\"\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`409 ROUND-409-001` 当前回合状态不可启动；`422 ROUND-422-001` 时间窗非法 |
| 权限要求 | `teacher`、`tenant_admin` |
| 优先级 | P0 |
| 可测试验收标准 | 状态从 `pending/open` 进入 `in_progress/open`；未绑定 Run 的课程不可启动；记录回合窗口与操作者 |
| 注意事项 / 约束 | 一次仅允许一个活动回合；冲击注入应以 `shock_plan_refs` 或受控事件进入 |
| 来源依据 | fileciteturn0file6 fileciteturn0file9 fileciteturn0file10 |

**API-016 锁定回合**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-016 |
| 模块归属 | 回合与决策管理 |
| HTTP 方法 | `POST` |
| 路径 | `/api/v1/runs/{runId}/rounds/{roundNo}/lock` |
| 接口描述 | 关闭本回合决策提交窗口并进入待结算状态 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`、`Idempotency-Key`；Path：`runId`、`roundNo`；Body：`lock_reason` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_round_lock_001\",\n  \"code\": \"OK\",\n  \"message\": \"locked\",\n  \"data\": {\n    \"run_id\": \"run_001\",\n    \"round_no\": 1,\n    \"status\": \"locked_for_settlement\",\n    \"decision_batch_id\": \"dec_batch_r1\"\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`409 ROUND-409-002` 仍有必填团队未提交且不允许自动补足；`423 ROUND-423-001` 已锁定 |
| 权限要求 | `teacher`、`tenant_admin` |
| 优先级 | P0 |
| 可测试验收标准 | 锁定后普通学员提交决策必须失败；锁定事件形成稳定 `decision_batch_id`；写入审计 |
| 注意事项 / 约束 | 若启用缺岗 / 缺队自动补足，必须完整留痕且前台可解释 |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 fileciteturn0file19 |

**API-017 提交决策**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-017 |
| 模块归属 | 回合与决策管理 |
| HTTP 方法 | `POST` |
| 路径 | `/api/v1/runs/{runId}/rounds/{roundNo}/decisions` |
| 接口描述 | 提交团队本回合决策，进入 `Decision Validator` 校验链路 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`、`Idempotency-Key`；Path：`runId`、`roundNo`；Body：`team_id`、`decision_payload`、`agent_proposal_refs[]`、`client_revision` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_decision_submit_001\",\n  \"code\": \"OK\",\n  \"message\": \"submitted\",\n  \"data\": {\n    \"decision_id\": \"decision_001\",\n    \"status\": \"submitted\",\n    \"validation_report\": {\n      \"passed\": true,\n      \"warnings\": []\n    }\n  }\n}\n``` |
| 状态码与错误码 | `201` 成功；`409 DEC-409-001` 回合已锁定；`422 DEC-422-001` 校验失败；`428 DEC-428-001` 所属 Run 未冻结参数集 |
| 权限要求 | `learner`、`team_captain`、课程教师代理提交 |
| 优先级 | P0 |
| 可测试验收标准 | 合法决策返回 `submitted`；非法字段返回结构化错误；`agent_proposal_refs` 仅进入审计与复盘，不直接影响结算 |
| 注意事项 / 约束 | 建议保留版本历史，不原地覆盖；锁轮时固化到 `decision_batch_id` |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 fileciteturn0file8 fileciteturn0file19 |

**API-018 获取状态快照**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-018 |
| 模块归属 | 回合与决策管理 |
| HTTP 方法 | `GET` |
| 路径 | `/api/v1/runs/{runId}/rounds/{roundNo}/state-snapshot` |
| 接口描述 | 读取指定 Run / Round 的可见状态快照 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`；Path：`runId`、`roundNo`；Query：`team_id`、`visible_state=state_obs|state_est|teacher_summary` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_snapshot_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"snapshot_id\": \"snap_obs_r1_t1\",\n    \"visible_state\": \"state_obs\",\n    \"team_id\": \"team_001\",\n    \"metrics\": {\n      \"sales\": 820,\n      \"inventory\": 64,\n      \"cash\": 540000\n    }\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`403 SNAP-403-001` 请求超出权限的可见态；`404 SNAP-404-001` 快照不存在 |
| 权限要求 | 团队成员、教师、管理员、只读 AI 服务 |
| 优先级 | P0 |
| 可测试验收标准 | 学员不可请求 `state_true`；教师只能获取授权摘要；AI 服务调用需记录来源模型与工具链 |
| 注意事项 / 约束 | 禁止返回完整 `agent_pool`、完整 `ParameterSet` 与无权字段 |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 fileciteturn0file15 |

**API-019 正式结算回合**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-019 |
| 模块归属 | 仿真结算接口 |
| HTTP 方法 | `POST` |
| 路径 | `/internal/v1/runs/{runId}/rounds/{roundNo}/settle` |
| 接口描述 | 平台唯一正式真值写入口；使用冻结决策、冻结参数集、插件输出和随机种子执行正式结算 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`、`Idempotency-Key`、`X-Service-Principal: service_kernel`；Path：`runId`、`roundNo`；Body：`parameter_set_id`、`decision_batch_id`、`state_snapshot_id`、`shock_events[]`、`mode=official`、`random_seed` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_settle_001\",\n  \"code\": \"OK\",\n  \"message\": \"settled\",\n  \"data\": {\n    \"status\": \"settled\",\n    \"state_true_snapshot_id\": \"state_r4_true\",\n    \"state_obs_snapshot_id\": \"state_r4_obs\",\n    \"ledger_id\": \"ledger_r4\",\n    \"result_summary\": {\n      \"market_share_by_firm\": {\"team_001\": 0.31, \"team_002\": 0.27},\n      \"average_markup\": 0.24,\n      \"consumer_surplus_index\": 1.07,\n      \"rank_snapshot\": [{\"team_id\": \"team_001\", \"rank\": 1}]\n    },\n    \"replay_hash\": \"sha256:<REPLAY_HASH>\"\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`409 SET-409-001` 同一批次已结算；`428 SET-428-001` 参数集未冻结；`500 SET-500-001` 求解失败并进入 Shadow Queue |
| 权限要求 | `service_kernel` |
| 优先级 | P0 |
| 可测试验收标准 | 相同 `run_id + round_no + decision_batch_id + parameter_set_id + random_seed` 重试必须返回同一 `replay_hash`；成功后写入 `state_true / state_obs / state_est` 与双账本；AI 与普通前端无权调用 |
| 注意事项 / 约束 | 这是平台最关键的幂等接口；历史修正只能通过追加事件，不允许覆盖既有结算结果 |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 fileciteturn0file15 fileciteturn0file7 |

**API-020 查询回合结果**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-020 |
| 模块归属 | 仿真结算接口 |
| HTTP 方法 | `GET` |
| 路径 | `/api/v1/runs/{runId}/rounds/{roundNo}/results` |
| 接口描述 | 返回回合结果、排名快照与三段式反馈骨架 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`；Path：`runId`、`roundNo`；Query：`team_id`、`view=team|teacher|public` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_result_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"round_no\": 1,\n    \"team_id\": \"team_001\",\n    \"what_happened\": {\"revenue\": 1200000, \"profit\": 180000, \"rank\": 2},\n    \"why\": [\"price improved conversion\", \"inventory shortage limited upside\"],\n    \"next_risk\": [\"cash runway tightening\"],\n    \"result_ref\": \"settlement_001\"\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`403 RES-403-001` 查看权限不足；`404 RES-404-001` 结果尚未发布 |
| 权限要求 | 团队成员、教师、管理员 |
| 优先级 | P0 |
| 可测试验收标准 | 学员默认仅返回本队结果与公开排名；教师视图可查看全班摘要；数值字段必须来自正式结算结果 |
| 注意事项 / 约束 | AI 可以补充解释文本，但不得覆写数值与正式排序 |
| 来源依据 | fileciteturn0file6 fileciteturn0file9 fileciteturn0file10 |

**API-021 生成策略建议**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-021 |
| 模块归属 | AI 建议接口 |
| HTTP 方法 | `POST` |
| 路径 | `/api/v1/agents/strategy-advisor/propose` |
| 接口描述 | 基于可见状态、工具结果与教学目标生成建议，但不得写真值 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`；Body：`run_id`、`round_no`、`team_id`、`visible_state_ref`、`objective`、`allowed_tools[]` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_ai_strategy_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"proposal_id\": \"prop_001\",\n    \"advisory_only\": true,\n    \"truth_write_attempted\": false,\n    \"recommendations\": [\n      {\"topic\": \"pricing\", \"suggestion\": \"consider a modest price decrease\"}\n    ],\n    \"evidence_cards\": [\n      {\"metric\": \"inventory_days\", \"value\": 4.2}\n    ],\n    \"risk_cards\": [\n      {\"risk\": \"stockout\"}\n    ]\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`403 AI-403-001` 越权快照请求；`422 AI-422-001` 输入不符合 advisory schema |
| 权限要求 | `learner`、`teacher`、`service_ai` |
| 优先级 | P1 |
| 可测试验收标准 | 返回值必须包含 `advisory_only=true` 与 `truth_write_attempted=false`；任何试图写真值的路径必须被阻断与告警；输出落入 `CoachOutput` |
| 注意事项 / 约束 | 学员即使采纳建议，也必须通过 API-017 正式提交决策 |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 fileciteturn0file18 fileciteturn0file8 |

**API-022 生成回合复盘**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-022 |
| 模块归属 | AI 建议接口 |
| HTTP 方法 | `POST` |
| 路径 | `/api/v1/agents/debrief-coach/generate` |
| 接口描述 | 基于正式结果和可见快照生成教学复盘草稿 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`；Body：`run_id`、`round_no`、`team_id`、`result_ref`、`audience=teacher|team` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_ai_debrief_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"debrief_id\": \"debrief_001\",\n    \"summary\": \"team improved margin but underinvested in capacity\",\n    \"evidence_cards\": [\n      {\"metric\": \"gross_margin\", \"value\": 0.32}\n    ],\n    \"improvement_actions\": [\n      \"review capacity expansion before next round\"\n    ]\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`404 AI-404-001` 结果不存在；`403 AI-403-002` 请求了无权可见数据 |
| 权限要求 | `teacher`、团队成员、`service_ai` |
| 优先级 | P1 |
| 可测试验收标准 | 输出引用正式结果对象；学员版不得暴露教师摘要或完整 `state_true`；复盘生成行为可审计 |
| 注意事项 / 约束 | 输出为草稿对象，教师可编辑后再发布 |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 fileciteturn0file18 |

**API-023 生成学习推荐流**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-023 |
| 模块归属 | AI 建议接口 |
| HTTP 方法 | `POST` |
| 路径 | `/api/v1/recommendations/learning-feed` |
| 接口描述 | 基于学习记录、角色画像与能力缺口推荐内容、同伴或训练任务 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`；Body：`user_id`、`course_id`、`goal_tags[]`、`context_window` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_learning_feed_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"items\": [\n      {\n        \"type\": \"case\",\n        \"ref_id\": \"case_001\",\n        \"reason\": \"evidence_use_gap\"\n      }\n    ]\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`403 REC-403-001` 不可读取他人学习画像 |
| 权限要求 | `learner`、`teacher` |
| 优先级 | P2 |
| 可测试验收标准 | 推荐结果不泄露跨租户学习记录；解释字段存在；若引用授权内容，必须在许可范围内 |
| 注意事项 / 约束 | 推荐属于学习支持层，不进入正式结算 |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 fileciteturn0file18 |

## 治理与扩展接口

下列接口承担 SimWar 与普通 SaaS 教学系统最关键的差异化能力：Shadow Replay、ParameterSet 审批、插件版本治理、插件上下文编译与审计导出。它们共同保证“模型可发布、结果可重放、插件可扩展、写入可追责”。其中插件需要显式遵守 hook 边界，治理接口则必须携带可追溯链路，不能只返回“成功 / 失败”而不附带版本与差异对象。fileciteturn0file10 fileciteturn0file15 fileciteturn0file19 fileciteturn0file8

**API-024 创建 Shadow Replay**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-024 |
| 模块归属 | Replay / Shadow Replay |
| HTTP 方法 | `POST` |
| 路径 | `/api/v1/replays/shadow` |
| 接口描述 | 使用候选参数集、候选插件版本或候选场景包对历史 Run 执行旁路重放 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`、`Idempotency-Key`；Body：`source_run_id`、`candidate_parameter_set_id`、`candidate_plugin_versions[]`、`candidate_scenario_package_id`、`acceptance_profile` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_shadow_001\",\n  \"code\": \"OK\",\n  \"message\": \"accepted\",\n  \"data\": {\n    \"replay_id\": \"replay_001\",\n    \"mode\": \"shadow\",\n    \"status\": \"queued\"\n  }\n}\n``` |
| 状态码与错误码 | `202` 已受理；`409 REP-409-001` 正在执行同一候选组合；`422 REP-422-001` 候选对象不满足回放条件 |
| 权限要求 | `teacher`、`model_governor`、`tenant_admin` |
| 优先级 | P0 |
| 可测试验收标准 | 可对历史 Run 发起重放；不改任何历史正式成绩；治理与审计记录完整 |
| 注意事项 / 约束 | 必须记录候选版本组合、基线版本与 acceptance profile，供审批链复核 |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 fileciteturn0file15 fileciteturn0file19 |

**API-025 查询 Replay 报告**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-025 |
| 模块归属 | Replay / Shadow Replay |
| HTTP 方法 | `GET` |
| 路径 | `/api/v1/replays/{replayId}` |
| 接口描述 | 查询 Replay / Shadow Replay 差异报告与门禁结论 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`；Path：`replayId` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_replay_get_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"replay_id\": \"replay_001\",\n    \"status\": \"completed\",\n    \"passed\": true,\n    \"diff_summary\": {\n      \"score_delta_max\": 0.003,\n      \"rank_changed_teams\": 0,\n      \"fairness_risk\": \"low\"\n    }\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`404 REP-404-001` 报告不存在 |
| 权限要求 | `teacher`、`model_governor`、`tenant_admin`、`platform_admin` |
| 优先级 | P0 |
| 可测试验收标准 | 报告展示候选版本与正式版本对比；未完成时返回进行中状态；读取不改变状态 |
| 注意事项 / 约束 | 报告应可被审批接口与教师解释界面复用 |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 fileciteturn0file15 |

**API-026 审批 ParameterSet 发布**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-026 |
| 模块归属 | Replay / Shadow Replay |
| HTTP 方法 | `POST` |
| 路径 | `/api/v1/governance/parameter-sets/{parameterSetId}/approve` |
| 接口描述 | 将候选参数集从 `candidate / shadow_passed` 变更为 `approved` |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`、`Idempotency-Key`；Path：`parameterSetId`；Body：`decision`、`shadow_replay_id`、`approval_note` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_param_approve_001\",\n  \"code\": \"OK\",\n  \"message\": \"approved\",\n  \"data\": {\n    \"parameter_set_id\": \"param_approved_1_4_2\",\n    \"status\": \"approved\"\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`409 GOV-409-001` 未通过 Shadow Replay 不可审批；`422 GOV-422-001` 当前状态不可转移 |
| 权限要求 | `model_governor`、`platform_admin` |
| 优先级 | P0 |
| 可测试验收标准 | 仅治理角色可审批；已 `approved` 参数集不可被覆盖；审批动作写入治理审计 |
| 注意事项 / 约束 | 若需回滚，应产生废弃 / 替代事件，而不是改写原批准对象 |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 fileciteturn0file15 |

**API-027 查询插件列表**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-027 |
| 模块归属 | 行业插件管理 |
| HTTP 方法 | `GET` |
| 路径 | `/api/v1/plugins` |
| 接口描述 | 查询当前租户可用插件及版本状态 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`；Query：`status`、`industry` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_plugin_list_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"items\": [\n      {\n        \"plugin_id\": \"plugin_eldercare\",\n        \"name\": \"Eldercare Plugin\",\n        \"status\": \"released\",\n        \"latest_version\": \"1.2.0\"\n      }\n    ]\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`403 PLG-403-001` 无插件列表查看权限 |
| 权限要求 | `teacher`、`scenario_designer`、`tenant_admin` |
| 优先级 | P1 |
| 可测试验收标准 | 仅返回本租户有权限使用的插件；正确区分 `draft / released / disabled` |
| 注意事项 / 约束 | 插件可见不等于已绑定到课程或 Run |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 |

**API-028 上传插件包**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-028 |
| 模块归属 | 行业插件管理 |
| HTTP 方法 | `POST` |
| 路径 | `/api/v1/plugins` |
| 接口描述 | 上传新的插件包或新版本草稿 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`、`Idempotency-Key`；Body：`plugin_name`、`industry`、`version`、`manifest`、`artifact_ref` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_plugin_upload_001\",\n  \"code\": \"OK\",\n  \"message\": \"created\",\n  \"data\": {\n    \"plugin_id\": \"plugin_eldercare\",\n    \"version\": \"1.3.0\",\n    \"status\": \"draft\"\n  }\n}\n``` |
| 状态码与错误码 | `201` 成功；`409 PLG-409-001` 版本已存在；`422 PLG-422-001` Manifest 契约校验失败 |
| 权限要求 | `platform_admin`、`scenario_designer`（受租户策略限制） |
| 优先级 | P0 |
| 可测试验收标准 | 上传后先处于 `draft`；兼容性与 Shadow Replay 通过前不可发布；审计记录版本与 artifact 摘要 |
| 注意事项 / 约束 | 上传不自动启用；Manifest 必须包含 hook 边界声明 |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 fileciteturn0file12 fileciteturn0file19 |

**API-029 编译插件上下文**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-029 |
| 模块归属 | 行业插件管理 |
| HTTP 方法 | `POST` |
| 路径 | `/api/v1/plugins/{pluginId}/compile-context` |
| 接口描述 | 将行业事实、政策、地理与课程场景要素编译为插件执行上下文 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`、`Idempotency-Key`；Path：`pluginId`；Body：`plugin_version`、`facts`、`policy_facts`、`geo_facts`、`scenario_template_id` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_plugin_ctx_001\",\n  \"code\": \"OK\",\n  \"message\": \"compiled\",\n  \"data\": {\n    \"plugin_context_id\": \"plgctx_001\",\n    \"plugin_id\": \"plugin_eldercare\",\n    \"context_hash\": \"sha256:<CTX_HASH>\"\n  }\n}\n``` |
| 状态码与错误码 | `201` 成功；`422 PLG-422-002` 行业事实不足或不匹配插件 schema |
| 权限要求 | `teacher`、`scenario_designer`、`service_kernel` |
| 优先级 | P1 |
| 可测试验收标准 | 编译结果可被场景编译与运行引用；不允许直接产出真值字段；写入审计 |
| 注意事项 / 约束 | 产物属于插件局部上下文，不等同于正式结算结果 |
| 来源依据 | fileciteturn0file6 fileciteturn0file12 fileciteturn0file19 |

**API-030 发布插件版本**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-030 |
| 模块归属 | 行业插件管理 |
| HTTP 方法 | `POST` |
| 路径 | `/api/v1/plugins/{pluginId}/release` |
| 接口描述 | 将草稿插件版本发布为 `released`，供课程与场景编译使用 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`、`Idempotency-Key`；Path：`pluginId`；Body：`version`、`shadow_replay_id`、`compatibility_report_ref` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_plugin_release_001\",\n  \"code\": \"OK\",\n  \"message\": \"released\",\n  \"data\": {\n    \"plugin_id\": \"plugin_eldercare\",\n    \"version\": \"1.3.0\",\n    \"status\": \"released\"\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`409 PLG-409-002` 缺少兼容报告或 Shadow Replay；`422 PLG-422-003` 状态不可转移 |
| 权限要求 | `platform_admin`、`model_governor` |
| 优先级 | P0 |
| 可测试验收标准 | 未通过兼容性与 Shadow Replay 不可发布；发布写入版本审计；进行中 Run 的旧版本不得被热替换 |
| 注意事项 / 约束 | 运行中的 Run 继续使用冻结的插件版本 |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 fileciteturn0file19 |

**API-031 查询审计日志**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-031 |
| 模块归属 | 审计与日志 |
| HTTP 方法 | `GET` |
| 路径 | `/api/v1/audit/logs` |
| 接口描述 | 分页查询审计日志，支持按 actor、entity、action、时间范围过滤 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`；Query：`entity_type`、`entity_id`、`actor_id`、`action`、`start_at`、`end_at`、`page`、`page_size` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_audit_logs_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"items\": [\n      {\n        \"log_id\": \"audit_001\",\n        \"action\": \"DECISION_SUBMITTED\",\n        \"entity_type\": \"Decision\",\n        \"entity_id\": \"decision_001\",\n        \"actor_id\": \"usr_101\",\n        \"occurred_at\": \"<TIMESTAMP>\"\n      }\n    ],\n    \"total\": 1\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`403 AUD-403-001` 无日志查询权限 |
| 权限要求 | `tenant_admin`、`ops`、`platform_admin`；教师仅可查看自己课程相关日志摘要 |
| 优先级 | P0 |
| 可测试验收标准 | 所有写操作可被检索到；过滤条件准确；跨租户日志不可见 |
| 注意事项 / 约束 | 高合规环境可记录日志访问痕迹 |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 fileciteturn0file8 |

**API-032 查询实体审计时间线**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-032 |
| 模块归属 | 审计与日志 |
| HTTP 方法 | `GET` |
| 路径 | `/api/v1/audit/entities/{entityType}/{entityId}/timeline` |
| 接口描述 | 查看某对象的完整时间线，如 Course、Run、Round、Decision、ParameterSet、PluginVersion |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`；Path：`entityType`、`entityId` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_audit_timeline_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"entity_type\": \"Run\",\n    \"entity_id\": \"run_001\",\n    \"timeline\": [\n      {\"action\": \"RUN_CREATED\", \"at\": \"<TIMESTAMP>\"},\n      {\"action\": \"ROUND_STARTED\", \"at\": \"<TIMESTAMP>\"},\n      {\"action\": \"ROUND_SETTLED\", \"at\": \"<TIMESTAMP>\"}\n    ]\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`404 AUD-404-001` 实体不存在；`403 AUD-403-002` 无对象级查看权限 |
| 权限要求 | `teacher`（仅自己课程对象）、`tenant_admin`、`ops`、`platform_admin` |
| 优先级 | P1 |
| 可测试验收标准 | 时间线顺序正确；能串联到 replay、report、result 等引用对象；不暴露无权细节字段 |
| 注意事项 / 约束 | 适用于申诉处理、课后复盘与故障定位 |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 fileciteturn0file19 |

**API-033 导出审计包**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-033 |
| 模块归属 | 审计与日志 |
| HTTP 方法 | `POST` |
| 路径 | `/api/v1/audit/exports` |
| 接口描述 | 按 Course、Run 或 Replay 维度导出审计包，用于治理复核、申诉或外部合规归档 |
| 请求参数 | Header：`Authorization`、`X-Tenant-Id`、`Idempotency-Key`；Body：`scope_type(course|run|replay)`、`scope_id`、`include_event_store`、`include_replay_report` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_audit_export_001\",\n  \"code\": \"OK\",\n  \"message\": \"accepted\",\n  \"data\": {\n    \"export_id\": \"exp_001\",\n    \"status\": \"queued\"\n  }\n}\n``` |
| 状态码与错误码 | `202` 已受理；`403 AUD-403-003` 无导出权限；`422 AUD-422-001` 导出范围非法 |
| 权限要求 | `ops`、`platform_admin`、`model_governor`；租户级导出需额外策略授权 |
| 优先级 | P1 |
| 可测试验收标准 | 导出任务异步执行；导出产物可追溯到 scope 与申请人；导出行为本身写入审计 |
| 注意事项 / 约束 | 含敏感内容的导出应二次确认，并按租户与合规策略脱敏 |
| 来源依据 | fileciteturn0file6 fileciteturn0file10 fileciteturn0file8 |

## 错误码与验收基线

以下错误码用于 v1 统一字典；模块可以在命名前缀内扩展，但不得破坏已冻结的 P0 错误语义。对于会被前端、测试脚本、审计导出或治理规则直接依赖的错误码，应在 OpenAPI 示例、契约测试与 SDK 常量中保持一致。fileciteturn0file6 fileciteturn0file8

| 错误码 | HTTP | 含义 |
|---|---:|---|
| `AUTH-401-001` | 401 | 登录失败，凭证无效 |
| `AUTH-403-001` | 403 | 无权限进行角色绑定 |
| `CRS-428-001` | 428 | 发布课程前缺少已批准参数集或可执行场景包 |
| `TEAM-409-002` | 409 | 队伍角色槽位冲突 |
| `ROUND-409-002` | 409 | 回合已锁定，不能继续提交 |
| `DEC-422-001` | 422 | 决策校验失败 |
| `DEC-428-001` | 428 | Run 尚未冻结参数集 |
| `SET-428-001` | 428 | 正式结算时参数集未冻结 |
| `SET-500-001` | 500 | 求解失败，进入 Shadow Queue |
| `REP-409-001` | 409 | 同一 Shadow Replay 正在执行 |
| `GOV-409-001` | 409 | 未通过 Shadow Replay，不可审批 |
| `PLG-422-001` | 422 | 插件 Manifest 不通过契约校验 |
| `AUD-403-003` | 403 | 审计导出权限不足 |

以下验收主题是 API 合同的发布门禁，测试团队应将其固化为单元测试、集成测试、契约测试、Replay 测试与安全测试用例。AGENTS 文档也明确要求：Contract tests 负责校验请求 / 响应 / 错误码和 schema 兼容性，Replay tests 负责在固定种子与历史输入上验证结果稳定性，Security tests 负责覆盖越权访问、真值字段写入、敏感数据泄露与提示注入风险。fileciteturn0file8 fileciteturn0file9 fileciteturn0file10

| 验收主题 | 验收要求 |
|---|---|
| 真值边界 | 任何 AI 接口都不能直接写市场份额、现金流、利润、评分、排名或 `ParameterSet` |
| 参数治理 | `approved` 的 ParameterSet 不可覆盖；正式 Run 启动必须绑定并冻结参数版本 |
| 幂等性 | 决策提交、锁轮、结算、审批、插件发布、审计导出支持安全重试；正式结算返回稳定 `replay_hash` |
| 审计 | 所有写接口产生日志；日志可按 actor、entity、action、时间窗查询；事件与快照可追溯 |
| 可见性隔离 | 学员默认只看 `state_obs / state_est`；教师只看授权摘要；`state_true` 不对学员开放 |
| 版本冻结 | Run 创建后绑定的 `ScenarioPackage`、`PluginVersion`、`ParameterSet` 不因后续发布而漂移 |
| Shadow Gate | 参数审批与插件发布必须依赖 Replay / Shadow Replay 结果 |
| 多租户隔离 | 课程、队伍、日志、结果查询同时受 `X-Tenant-Id`、RBAC 与 scope 约束 |
| 插件边界 | 插件仅能在受控 hook 写局部变化量；不得直写正式成绩与历史快照 |
| OpenAPI-First | 所有 P0 接口需先落地 OpenAPI、JSON Schema、示例、错误码、契约测试 |
| 申诉与回放 | 任意正式回合结果都能通过事件账本、快照与 `replay_hash` 复算并对账 |

建议的最小联调与测试命令如下；实际仓库若采用 `make`、`poetry` 或 monorepo task runner，应在 `README.md`、`AGENTS.md` 与 CI 中同步维护稳定入口。fileciteturn0file7 fileciteturn0file8

```bash
npm test
pytest
python replay_test.py --run-id=<RUN_ID>
```

```bash
npm run contract:test
pytest tests/contract -q
pytest tests/integration -q
pytest tests/replay -q
```

本合同中的所有 Token、ID、时间戳、路径实例、版本号、租户标识、行业事实、结算结果与日志内容均为占位符，不包含真实密钥或真实业务数据。后续如需扩展课程详情、独立 ShockEvent 管理、LTI / SCIM / xAPI 专项接口、授权内容检索接口或社区 / 竞赛接口，建议在保持本版编号与语义稳定的前提下，通过 `v1.1` 增量扩展，而不是直接修改既有 P0 合同。fileciteturn0file6 fileciteturn0file9 fileciteturn0file10
