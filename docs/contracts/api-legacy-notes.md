# API

## 文档说明与设计依据

本文档定义 SimWar 平台的业务 API、内部结算 API 与治理 API，作为前后端联调、OpenAPI 生成、集成测试、审计追踪与后续代码实现的唯一接口基线。本文档默认与现有 `docs/architecture/system-architecture.md` 保持一致，尤其遵循以下架构前提：核心仿真引擎是唯一真值写入方；AI 小模型只输出建议、复盘、证据卡与风险提示；正式运行中的 `ParameterSet` 不可修改；`Replay / Shadow Replay` 是发布与回放门禁；所有写操作必须进入审计日志；正式结算接口必须幂等。以上约束来自 `docs/architecture/system-architecture.md` 的“架构背景与设计目标”“API 架构设计”“权限与安全架构”“状态机架构”“ADR”章节，以及 `SimWar_计量核心模型深化与工程契约报告_清洁版_v3.0` 的“L1-L5 分层模型与写权限”“Replay、Shadow Replay 与参数治理”“API 与事件契约”“ParameterSet Schema 摘要”等章节，另结合 `SimWar_核心引擎与小模型体系深化设计报告_清洁版` 第七章接口契约与 `整体架构-教师端学生端.md` 中教师端、学员端功能/API 映射综合形成。  
**主要依据**：`docs/architecture/system-architecture.md` 第2、5、6、8、12、13、14、23章；`SimWar_计量核心模型深化与工程契约报告_清洁版_v3.0 (3).txt` 第2、3、8、9、10、13、16、18、22章；`SimWar_核心引擎与小模型体系深化设计报告_清洁版.txt` 第7章；`整体架构-教师端学生端.md`“教师端与学员端功能清单”；`基于 SimWar 行业无关内核与行业插件架构的康养定制模拟商战模型与算法报告.md`“关键接口规范”。

### 术语与范围

本文档覆盖以下模块：用户认证与权限、课程管理、队伍与角色管理、回合与决策管理、仿真结算接口、AI 建议接口、Replay / Shadow Replay、行业插件管理接口、审计与日志接口。文档同时覆盖少量内部治理接口，因为正式结算、参数审批、Shadow Replay 与插件发布在架构上属于平台可信边界的一部分，不能只靠前端接口描述。  
**术语约定**：`Course` 表示课程或训练项目；`Run` 表示一次具体赛局/班次实例；`Round` 表示回合；`Decision` 表示团队某回合提交的结构化决策；`StateSnapshot` 包括 `state_true / state_obs / state_est` 三态；`ReplayHash` 是可复算签名；`PluginPackage` 是行业插件包；`CoachOutput` 是 AI 输出记录。  
**设计约定**：本文件中所有示例 ID、Token、租户标识、版本号、路径与时间戳均为占位符，不含真实生产数据。  
**主要依据**：`docs/architecture/system-architecture.md` 第6、7、8、12、14、24章；`SimWar康养定制模拟商战模型与算法研究报告.md` 有关 `state_true / state_obs / state_est`、`ReplayHash` 与 `/settle` 唯一真值入口的章节；`SimWar 在 BLP 核心上的行业无关 Kernel 与行业插件融合架构研究.md`“建议的事件流与接口层”“接口规范建议”。

## 通用约定

### 协议与路径约定

外部 API 统一使用 `HTTPS + JSON`，路径前缀为 `/api/v1`；内部可信 API 使用 `/internal/v1`；未来若需要事件订阅与流式通知，可在不破坏现有 REST 契约的前提下，通过消息总线或 SSE/WebSocket 扩展。该约定与现有架构中“外部 API / 内部服务 API / 仿真引擎内部 API”三分法一致。  
**主要依据**：`docs/architecture/system-architecture.md` 第12章；`SimWar架构下基于BLP的三大商战平台融合设计报告.txt`“接口规范建议与数据契约”；`SimWar_核心引擎与小模型体系深化设计报告_清洁版.txt` 第7章。

### 通用请求头

| Header | 必填 | 说明 |
|---|---:|---|
| `Authorization: Bearer <ACCESS_TOKEN>` | 是 | 登录后访问受保护资源 |
| `X-Tenant-Id` | 是 | 租户隔离标识；平台管理员查询跨租户资源时仍需显式传入 |
| `X-Request-Id` | 否 | 请求追踪 ID；若未传入，网关生成 |
| `Idempotency-Key` | 写接口强烈建议；P0 关键写接口必填 | 用于安全重试，特别是提交决策、锁轮、结算、审批、插件发布、审计导出 |
| `If-Match` | PATCH/PUT 推荐 | 乐观锁版本控制，用于课程更新、队伍配置等 |

### 通用响应包

```json
{
  "request_id": "req_xxx",
  "code": "OK",
  "message": "success",
  "data": {}
}
```

错误响应统一格式：

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

### 幂等与审计规则

所有写接口一律写入 `AuditLog`；关键写接口必须满足“同租户、同 actor、同资源路径、同幂等键、同请求体哈希”不产生重复副作用。正式结算接口必须以 `run_id + round_no + decision_batch_id + parameter_set_id + random_seed` 生成稳定结果与 `replay_hash`；`Approved ParameterSet` 不能被覆盖，只能废弃并新发版本；AI 输出不得通过任何路径回写真值字段。  
**主要依据**：`docs/architecture/system-architecture.md` 第2、6、12、13、14、23章；`SimWar架构下基于BLP的三大商战平台融合设计报告.txt` 有关 settle 幂等与 replay hash 的章节；`SimWar_计量核心模型深化与工程契约报告_清洁版_v3.0 (3).txt` 第1、2、3、16、18、22章；`SimWar_核心引擎与小模型体系深化设计报告_清洁版.txt` 第7章与 Definition of Done 段落。

### 角色代码

| 角色代码 | 说明 |
|---|---|
| `platform_admin` | 平台级超级管理员 |
| `tenant_admin` | 租户管理员 |
| `teacher` | 教师/教练 |
| `learner` | 学员 |
| `team_captain` | 队长 |
| `scenario_designer` | 场景设计师 |
| `model_governor` | 模型治理/参数审批人员 |
| `ops` | 系统运维/审计人员 |
| `service_kernel` | 内部仿真内核服务身份 |
| `service_ai` | 内部 AI 服务身份，只读业务快照 |

## 接口总览

| 编号 | 模块 | 方法 | 路径 | 优先级 |
|---|---|---|---|---|
| API-001 | 用户认证与权限 | POST | `/api/v1/auth/login` | P0 |
| API-002 | 用户认证与权限 | POST | `/api/v1/auth/refresh` | P0 |
| API-003 | 用户认证与权限 | GET | `/api/v1/auth/me` | P0 |
| API-004 | 用户认证与权限 | POST | `/api/v1/role-bindings` | P0 |
| API-005 | 课程管理 | GET | `/api/v1/courses` | P0 |
| API-006 | 课程管理 | POST | `/api/v1/courses` | P0 |
| API-007 | 课程管理 | POST | `/api/v1/scenarios/compile` | P0 |
| API-008 | 课程管理 | PATCH | `/api/v1/courses/{courseId}` | P0 |
| API-009 | 课程管理 | POST | `/api/v1/courses/{courseId}/publish` | P0 |
| API-010 | 课程管理 | POST | `/api/v1/courses/{courseId}/archive` | P1 |
| API-011 | 队伍与角色管理 | POST | `/api/v1/courses/{courseId}/teams` | P0 |
| API-012 | 队伍与角色管理 | PUT | `/api/v1/teams/{teamId}/members` | P0 |
| API-013 | 队伍与角色管理 | GET | `/api/v1/teams/{teamId}/dashboard` | P0 |
| API-014 | 回合与决策管理 | POST | `/api/v1/courses/{courseId}/runs` | P0 |
| API-015 | 回合与决策管理 | POST | `/api/v1/runs/{runId}/rounds/{roundNo}/start` | P0 |
| API-016 | 回合与决策管理 | POST | `/api/v1/runs/{runId}/rounds/{roundNo}/lock` | P0 |
| API-017 | 回合与决策管理 | POST | `/api/v1/runs/{runId}/rounds/{roundNo}/decisions` | P0 |
| API-018 | 回合与决策管理 | GET | `/api/v1/runs/{runId}/rounds/{roundNo}/state-snapshot` | P0 |
| API-019 | 仿真结算接口 | POST | `/internal/v1/runs/{runId}/rounds/{roundNo}/settle` | P0 |
| API-020 | 仿真结算接口 | GET | `/api/v1/runs/{runId}/rounds/{roundNo}/results` | P0 |
| API-021 | AI 建议接口 | POST | `/api/v1/agents/strategy-advisor/propose` | P1 |
| API-022 | AI 建议接口 | POST | `/api/v1/agents/debrief-coach/generate` | P1 |
| API-023 | AI 建议接口 | POST | `/api/v1/recommendations/learning-feed` | P2 |
| API-024 | Replay / Shadow Replay | POST | `/api/v1/replays/shadow` | P0 |
| API-025 | Replay / Shadow Replay | GET | `/api/v1/replays/{replayId}` | P0 |
| API-026 | Replay / Shadow Replay | POST | `/api/v1/governance/parameter-sets/{parameterSetId}/approve` | P0 |
| API-027 | 行业插件管理 | GET | `/api/v1/plugins` | P1 |
| API-028 | 行业插件管理 | POST | `/api/v1/plugins` | P0 |
| API-029 | 行业插件管理 | POST | `/api/v1/plugins/{pluginId}/compile-context` | P1 |
| API-030 | 行业插件管理 | POST | `/api/v1/plugins/{pluginId}/release` | P0 |
| API-031 | 审计与日志 | GET | `/api/v1/audit/logs` | P0 |
| API-032 | 审计与日志 | GET | `/api/v1/audit/entities/{entityType}/{entityId}/timeline` | P1 |
| API-033 | 审计与日志 | POST | `/api/v1/audit/exports` | P1 |

## 用户认证与权限

本组接口服务于多租户认证、课程级授权与角色绑定。接口设计依据现有架构中的 RBAC、多租户隔离、JWT、审计日志与 AI 只读边界要求，同时吸收教师端/学员端分角色视图要求。  
**主要依据**：`docs/architecture/system-architecture.md` 第3、5、12、13、14章；`整体架构-教师端学生端.md` 教师/学员功能表；`SimWar架构下基于BLP的三大商战平台融合设计报告.txt` 关于 LTI/SCIM/OpenAPI 三轨接口建议。

**API-001 登录**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-001 |
| 模块归属 | 用户认证与权限 |
| 方法 | `POST` |
| 路径 | `/api/v1/auth/login` |
| 描述 | 用户登录并获取访问令牌与刷新令牌 |
| 权限要求 | 匿名 |
| 优先级 | P0 |
| Header | `X-Tenant-Id` |
| Body | `username`、`password`、`client_type` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_login_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"access_token\": \"<ACCESS_TOKEN>\",\n    \"refresh_token\": \"<REFRESH_TOKEN>\",\n    \"expires_in\": 3600,\n    \"user\": {\n      \"user_id\": \"usr_001\",\n      \"display_name\": \"<USER_NAME>\",\n      \"roles\": [\"teacher\"],\n      \"tenant_id\": \"tenant_demo\"\n    }\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`400 AUTH-400-001` 参数缺失；`401 AUTH-401-001` 用户名或密码错误；`423 AUTH-423-001` 账号锁定 |
| 可测试验收标准 | 正确凭证可返回 token；错误凭证不泄露账户存在性；登录成功写入一条审计登录事件 |
| 注意事项 | 不返回敏感资料原文；支持 MFA 扩展位，但不在本版强制实现 |
| 来源依据 | `docs/architecture/system-architecture.md` 第12、13章；`整体架构-教师端学生端.md` 教师/学员登录流前提 |

**API-002 刷新令牌**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-002 |
| 模块归属 | 用户认证与权限 |
| 方法 | `POST` |
| 路径 | `/api/v1/auth/refresh` |
| 描述 | 使用刷新令牌换取新的访问令牌 |
| 权限要求 | 已持有有效刷新令牌 |
| 优先级 | P0 |
| Header | `X-Tenant-Id` |
| Body | `refresh_token` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_refresh_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"access_token\": \"<NEW_ACCESS_TOKEN>\",\n    \"expires_in\": 3600\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`401 AUTH-401-002` 刷新令牌失效；`409 AUTH-409-001` 会话已吊销 |
| 可测试验收标准 | 旧 access token 过期但 refresh token 有效时可刷新；被吊销会话必须刷新失败；审计记录包含旧会话与新会话关联 |
| 注意事项 | 不延展课程/队伍授权边界；刷新不会改变角色集合 |
| 来源依据 | `docs/architecture/system-architecture.md` 第13章；认证/授权服务职责表 |

**API-003 查询当前会话**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-003 |
| 模块归属 | 用户认证与权限 |
| 方法 | `GET` |
| 路径 | `/api/v1/auth/me` |
| 描述 | 查询当前用户、租户、角色与课程/团队上下文 |
| 权限要求 | 任意已认证用户 |
| 优先级 | P0 |
| Header | `Authorization`、`X-Tenant-Id` |
| Query | `include_bindings=true|false` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_me_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"user_id\": \"usr_001\",\n    \"tenant_id\": \"tenant_demo\",\n    \"roles\": [\"teacher\"],\n    \"course_bindings\": [\n      {\"course_id\": \"course_001\", \"role\": \"teacher\"}\n    ]\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`401 AUTH-401-003` 令牌无效 |
| 可测试验收标准 | `teacher` 可看到其课程绑定；`learner` 可看到所属团队上下文；跨租户 token 不得越权返回其他租户信息 |
| 注意事项 | 只返回当前用户上下文，不承担成员目录功能 |
| 来源依据 | `docs/architecture/system-architecture.md` 第13章；`整体架构-教师端学生端.md` 角色视图划分 |

**API-004 创建角色绑定**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-004 |
| 模块归属 | 用户认证与权限 |
| 方法 | `POST` |
| 路径 | `/api/v1/role-bindings` |
| 描述 | 将用户绑定到租户、课程或团队级角色 |
| 权限要求 | `platform_admin`、`tenant_admin`、课程内 `teacher` 仅可绑定本课程学员团队角色 |
| 优先级 | P0 |
| Header | `Authorization`、`X-Tenant-Id`、`Idempotency-Key` |
| Body | `user_id`、`scope_type(tenant|course|team)`、`scope_id`、`role_code`、`effective_from` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_role_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"binding_id\": \"rb_001\",\n    \"status\": \"active\"\n  }\n}\n``` |
| 状态码与错误码 | `201` 创建成功；`403 AUTH-403-001` 权限不足；`409 AUTH-409-002` 绑定冲突；`422 AUTH-422-001` 角色与作用域不兼容 |
| 可测试验收标准 | 同一幂等键重试不创建重复绑定；教师不能给别的租户授予角色；写入必须生成审计日志 |
| 注意事项 | 推荐后台实现最小权限原则与冲突检查，例如一个用户不能在同一团队同时被绑定为 `learner` 与 `team_captain` 之外的互斥角色 |
| 来源依据 | `docs/architecture/system-architecture.md` 第13章；`整体建构-功能深化.md` 关于学员、队长、教师、管理员、场景设计师、合规员等角色描述 |

## 课程管理、队伍与角色、回合与决策

本组接口覆盖教师最核心的业务闭环：建课、编译场景、配置队伍、创建 run、启动/锁定回合、提交决策、读取状态快照。接口设计直接映射 `CourseService`、`ScenarioService`、`RoundService`、`TeamService`、`DecisionService` 与学员端仪表盘，并与 `Course / Run / Round / Decision` 状态机一致。  
**主要依据**：`docs/architecture/system-architecture.md` 第5、6、8、12、14章；`整体架构-教师端学生端.md` 的课程管理、场景配置、回合控制、团队驾驶舱、决策表单；`SimWar_核心引擎与小模型体系深化设计报告_清洁版.txt` 第7章；`SimWar_计量核心模型深化与工程契约报告_清洁版_v3.0 (3).txt` 有关 `Decision Validator`、`Feature Mapper`、三态快照与冻结参数的章节。

**API-005 查询课程列表**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-005 |
| 模块归属 | 课程管理 |
| 方法 | `GET` |
| 路径 | `/api/v1/courses` |
| 描述 | 查询课程列表，支持按状态、教师、租户过滤 |
| 权限要求 | `tenant_admin`、`teacher` |
| 优先级 | P0 |
| Query | `status`、`teacher_id`、`page`、`page_size` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_course_list_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"items\": [\n      {\n        \"course_id\": \"course_001\",\n        \"name\": \"SimWar 演练班\",\n        \"status\": \"draft\",\n        \"scenario_package_id\": \"scn_001\",\n        \"parameter_set_id\": \"param_approved_1_4_2\"\n      }\n    ],\n    \"total\": 1\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`403 CRS-403-001` 无课程查看权限 |
| 可测试验收标准 | 教师只能看到自己负责课程；租户管理员可看到本租户全部课程；分页参数有效 |
| 注意事项 | 读取接口默认不写审计；若启用合规增强，可记录敏感对象访问痕迹 |
| 来源依据 | `docs/architecture/system-architecture.md` 第12、13、14章；`整体架构-教师端学生端.md` 课程管理 |

**API-006 创建课程**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-006 |
| 模块归属 | 课程管理 |
| 方法 | `POST` |
| 路径 | `/api/v1/courses` |
| 描述 | 创建课程草稿并绑定初始教学目标 |
| 权限要求 | `teacher`、`tenant_admin` |
| 优先级 | P0 |
| Header | `Idempotency-Key` |
| Body | `name`、`description`、`teaching_objectives`、`review_required`、`planned_rounds` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_course_create_001\",\n  \"code\": \"OK\",\n  \"message\": \"created\",\n  \"data\": {\n    \"course_id\": \"course_001\",\n    \"status\": \"draft\"\n  }\n}\n``` |
| 状态码与错误码 | `201` 创建成功；`409 CRS-409-001` 名称冲突；`422 CRS-422-001` 课程参数不完整 |
| 可测试验收标准 | 默认状态为 `draft`；创建成功写入审计日志；同幂等键重试返回同一课程 ID |
| 注意事项 | 本接口不直接发布课程，也不冻结参数 |
| 来源依据 | `docs/architecture/system-architecture.md` 第8、14章；`整体架构-教师端学生端.md` 课程管理流程 |

**API-007 编译场景包**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-007 |
| 模块归属 | 课程管理 |
| 方法 | `POST` |
| 路径 | `/api/v1/scenarios/compile` |
| 描述 | 依据场景模板、政策参数、轮次脚本与插件上下文，编译可执行 `ScenarioPackage` |
| 权限要求 | `teacher`、`scenario_designer`、`tenant_admin` |
| 优先级 | P0 |
| Header | `Idempotency-Key` |
| Body | `scenario_template_id`、`plugin_id`、`plugin_version`、`policy_params`、`round_script`、`evidence_refs` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_scn_compile_001\",\n  \"code\": \"OK\",\n  \"message\": \"compiled\",\n  \"data\": {\n    \"scenario_package_id\": \"scn_001\",\n    \"version\": \"1.0.0\",\n    \"status\": \"draft\",\n    \"mapping_trace_ref\": \"mt_001\"\n  }\n}\n``` |
| 状态码与错误码 | `201` 编译成功；`409 SCN-409-001` 模板版本冲突；`422 SCN-422-001` 模板或证据不满足契约 |
| 可测试验收标准 | 编译结果必须包含 package version；无效插件版本须拒绝；编译事件写入审计与版本库 |
| 注意事项 | 本接口只生成草稿场景包，不启动正式 run |
| 来源依据 | `整体架构-教师端学生端.md` 场景配置；`基于 SimWar 行业无关内核与行业插件架构的康养定制模拟商战模型与算法报告.md`“关键接口规范”；`docs/architecture/system-architecture.md` 第6、7、11、12章 |

**API-008 更新课程**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-008 |
| 模块归属 | 课程管理 |
| 方法 | `PATCH` |
| 路径 | `/api/v1/courses/{courseId}` |
| 描述 | 更新课程草稿信息，或在发布前绑定 `ScenarioPackage` 与 `ParameterSet` |
| 权限要求 | `teacher`、`tenant_admin` |
| 优先级 | P0 |
| Header | `If-Match`、`Idempotency-Key` |
| Path | `courseId` |
| Body | 可更新字段：`name`、`description`、`scenario_package_id`、`parameter_set_id`、`schedule` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_course_patch_001\",\n  \"code\": \"OK\",\n  \"message\": \"updated\",\n  \"data\": {\n    \"course_id\": \"course_001\",\n    \"status\": \"draft\",\n    \"version\": 3\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`409 CRS-409-002` 版本冲突；`422 CRS-422-002` 参数集未批准或场景未编译完成 |
| 可测试验收标准 | 发布后仅允许有限字段更新；不满足审批状态的 `ParameterSet` 禁止绑定；更新产生审计明细 |
| 注意事项 | 推荐仅允许在 `draft/review` 阶段修改核心绑定 |
| 来源依据 | `docs/architecture/system-architecture.md` 第6、12、14章；`SimWar_计量核心模型深化与工程契约报告_清洁版_v3.0 (3).txt` ParameterSet 生命周期说明 |

**API-009 发布课程**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-009 |
| 模块归属 | 课程管理 |
| 方法 | `POST` |
| 路径 | `/api/v1/courses/{courseId}/publish` |
| 描述 | 将课程从草稿/待审核状态发布为可创建 run 的课程 |
| 权限要求 | `teacher`、`tenant_admin`；若启用审核，需有审核通过记录 |
| 优先级 | P0 |
| Header | `Idempotency-Key` |
| Body | `publish_note` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_course_publish_001\",\n  \"code\": \"OK\",\n  \"message\": \"published\",\n  \"data\": {\n    \"course_id\": \"course_001\",\n    \"status\": \"published\"\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`409 CRS-409-003` 当前状态不可发布；`428 CRS-428-001` 缺少已批准参数集或可执行场景包 |
| 可测试验收标准 | 发布前必须校验 `ScenarioPackage`、`PluginVersion`、`ParameterSet` 均可用；成功发布后课程状态变更进入状态机历史；审计日志完整 |
| 注意事项 | 发布不等于启动 run；正式参数冻结发生在 run 创建时 |
| 来源依据 | `docs/architecture/system-architecture.md` 第8、14章；`SimWar_计量核心模型深化与工程契约报告_清洁版_v3.0 (3).txt` 第2、16章 |

**API-010 归档课程**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-010 |
| 模块归属 | 课程管理 |
| 方法 | `POST` |
| 路径 | `/api/v1/courses/{courseId}/archive` |
| 描述 | 将课程归档，停止新 run 创建 |
| 权限要求 | `teacher`、`tenant_admin` |
| 优先级 | P1 |
| Header | `Idempotency-Key` |
| Body | `reason` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_course_archive_001\",\n  \"code\": \"OK\",\n  \"message\": \"archived\",\n  \"data\": {\n    \"course_id\": \"course_001\",\n    \"status\": \"archived\"\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`409 CRS-409-004` 有进行中 run 不可归档 |
| 可测试验收标准 | 进行中 run 时禁止归档；归档后只读；审计日志记录原因 |
| 注意事项 | 归档不删除历史数据 |
| 来源依据 | `docs/architecture/system-architecture.md` 第14章 |

**API-011 创建队伍**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-011 |
| 模块归属 | 队伍与角色管理 |
| 方法 | `POST` |
| 路径 | `/api/v1/courses/{courseId}/teams` |
| 描述 | 在课程下创建一个队伍 |
| 权限要求 | `teacher`、`tenant_admin` |
| 优先级 | P0 |
| Header | `Idempotency-Key` |
| Body | `name`、`team_code`、`initial_capital`、`risk_limits` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_team_create_001\",\n  \"code\": \"OK\",\n  \"message\": \"created\",\n  \"data\": {\n    \"team_id\": \"team_001\",\n    \"course_id\": \"course_001\"\n  }\n}\n``` |
| 状态码与错误码 | `201` 成功；`409 TEAM-409-001` 队伍编码冲突；`422 TEAM-422-001` 初始资本或风险限额非法 |
| 可测试验收标准 | 创建后可被队员绑定；同幂等键不可重复建队；写入审计 |
| 注意事项 | 队伍创建不自动分配成员 |
| 来源依据 | `docs/architecture/system-architecture.md` 第6章；`整体架构-教师端学生端.md` 团队驾驶舱与队伍组织需求；`SimWar 在 BLP 核心上的行业无关 Kernel 与行业插件融合架构研究.md` 对 `Team` 对象的定义 |

**API-012 批量配置队伍成员与角色槽位**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-012 |
| 模块归属 | 队伍与角色管理 |
| 方法 | `PUT` |
| 路径 | `/api/v1/teams/{teamId}/members` |
| 描述 | 批量设置成员、队长与角色槽位，如 CEO/CFO/CMO/COO |
| 权限要求 | `teacher`、`tenant_admin` |
| 优先级 | P0 |
| Header | `Idempotency-Key`、`If-Match` |
| Body | `members[]`，每项含 `user_id`、`role_slot`、`is_captain` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_team_members_001\",\n  \"code\": \"OK\",\n  \"message\": \"updated\",\n  \"data\": {\n    \"team_id\": \"team_001\",\n    \"member_count\": 5,\n    \"role_slots\": [\"CEO\", \"CFO\", \"CMO\", \"COO\"]\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`409 TEAM-409-002` 角色槽位冲突；`422 TEAM-422-002` 用户不在课程范围内 |
| 可测试验收标准 | 同一角色槽位不重复分配；队长唯一；更新写入成员审计和绑定审计 |
| 注意事项 | 允许预留空槽位，供系统代管/Autopilot 使用，但必须显式标记 |
| 来源依据 | `整体架构-教师端学生端.md` 队伍与角色协作视图；`SimWar 在 BLP 核心上的行业无关 Kernel 与行业插件融合架构研究.md` 中 `role_slots` 与缺岗代管逻辑；`SimWar架构下基于BLP的三大商战平台融合设计报告.txt`“团队角色小模型与跨团队博弈协同” |

**API-013 查询团队驾驶舱**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-013 |
| 模块归属 | 队伍与角色管理 |
| 方法 | `GET` |
| 路径 | `/api/v1/teams/{teamId}/dashboard` |
| 描述 | 返回团队 KPI、历史成绩、当前回合上下文和公开排名摘要 |
| 权限要求 | 团队成员、课程教师、租户管理员 |
| 优先级 | P0 |
| Query | `run_id`、`visible_state=state_obs|state_est` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_team_dashboard_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"team_id\": \"team_001\",\n    \"run_id\": \"run_001\",\n    \"kpis\": {\n      \"revenue\": 1200000,\n      \"profit\": 180000,\n      \"rank\": 2,\n      \"risk_score\": 0.12\n    },\n    \"visible_state\": \"state_obs\"\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`403 TEAM-403-001` 非本队学员不可查看私有驾驶舱；`404 TEAM-404-001` 队伍不存在 |
| 可测试验收标准 | 学员默认只看到 `state_obs/state_est`；教师可看到教师级摘要；跨队私有数据隔离生效 |
| 注意事项 | 禁止暴露 `state_true` 明细与完整参数集 |
| 来源依据 | `整体架构-教师端学生端.md` 团队驾驶舱；`SimWar_计量核心模型深化与工程契约报告_清洁版_v3.0 (3).txt` 学员端只看 `state_obs/state_est`；`SimWar康养定制模拟商战模型与算法研究报告.md` 三态可见性约束 |

**API-014 创建运行**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-014 |
| 模块归属 | 回合与决策管理 |
| 方法 | `POST` |
| 路径 | `/api/v1/courses/{courseId}/runs` |
| 描述 | 基于已发布课程创建一次 `Run`，并冻结所用场景包、插件版本、参数集版本 |
| 权限要求 | `teacher`、`tenant_admin` |
| 优先级 | P0 |
| Header | `Idempotency-Key` |
| Body | `stage`、`seed`、`start_round_no`、`plugin_version_overrides` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_run_create_001\",\n  \"code\": \"OK\",\n  \"message\": \"created\",\n  \"data\": {\n    \"run_id\": \"run_001\",\n    \"status\": \"preparing\",\n    \"bound_parameter_set_id\": \"param_approved_1_4_2\",\n    \"bound_plugin_versions\": [{\"plugin_id\": \"plugin_eldercare\", \"version\": \"1.2.0\"}]\n  }\n}\n``` |
| 状态码与错误码 | `201` 成功；`409 RUN-409-001` 课程状态不可创建 run；`428 RUN-428-001` 参数集/插件版本未批准 |
| 可测试验收标准 | 创建 run 后绑定版本不可改写；重复请求按幂等键安全返回；审计日志记录绑定详情 |
| 注意事项 | `seed` 推荐显式传入，以支持 deterministic replay |
| 来源依据 | `docs/architecture/system-architecture.md` 第6、8、14章；`SimWar 在 BLP 核心上的行业无关 Kernel 与行业插件融合架构研究.md` 关于 `Run` 的定义；`SimWar_计量核心模型深化与工程契约报告_清洁版_v3.0 (3).txt` 冻参数与可复算要求 |

**API-015 启动回合**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-015 |
| 模块归属 | 回合与决策管理 |
| 方法 | `POST` |
| 路径 | `/api/v1/runs/{runId}/rounds/{roundNo}/start` |
| 描述 | 启动指定回合并开放决策窗口 |
| 权限要求 | `teacher`、`tenant_admin` |
| 优先级 | P0 |
| Header | `Idempotency-Key` |
| Body | `window_open_at`、`window_close_at`、`shock_plan_refs` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_round_start_001\",\n  \"code\": \"OK\",\n  \"message\": \"started\",\n  \"data\": {\n    \"run_id\": \"run_001\",\n    \"round_no\": 1,\n    \"status\": \"in_progress\"\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`409 ROUND-409-001` 当前回合状态不可启动；`422 ROUND-422-001` 时间窗非法 |
| 可测试验收标准 | 回合状态从 `pending` -> `in_progress`；未绑定 run 的课程不可启动；审计日志记录操作者和窗口时间 |
| 注意事项 | 一次仅允许一个活动回合 |
| 来源依据 | `docs/architecture/system-architecture.md` 第8、14章；`整体架构-教师端学生端.md` 回合控制流程 |

**API-016 锁定回合**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-016 |
| 模块归属 | 回合与决策管理 |
| 方法 | `POST` |
| 路径 | `/api/v1/runs/{runId}/rounds/{roundNo}/lock` |
| 描述 | 关闭本回合决策提交窗口并进入待结算状态 |
| 权限要求 | `teacher`、`tenant_admin` |
| 优先级 | P0 |
| Header | `Idempotency-Key` |
| Body | `lock_reason` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_round_lock_001\",\n  \"code\": \"OK\",\n  \"message\": \"locked\",\n  \"data\": {\n    \"run_id\": \"run_001\",\n    \"round_no\": 1,\n    \"status\": \"locked_for_settlement\",\n    \"decision_batch_id\": \"dec_batch_r1\"\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`409 ROUND-409-002` 仍有必填团队未提交且不允许自动补足；`423 ROUND-423-001` 已锁定 |
| 可测试验收标准 | 锁定后普通学员再提交决策返回 `409`；锁定事件形成稳定 `decision_batch_id`；写入审计 |
| 注意事项 | 若启用缺岗/缺队自动补足，必须明确体现在审计和后续结算输入中 |
| 来源依据 | `docs/architecture/system-architecture.md` 第8、14章；`SimWar 在 BLP 核心上的行业无关 Kernel 与行业插件融合架构研究.md` 关于锁轮与系统代管；`整体架构-教师端学生端.md` 回合控制 |

**API-017 提交决策**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-017 |
| 模块归属 | 回合与决策管理 |
| 方法 | `POST` |
| 路径 | `/api/v1/runs/{runId}/rounds/{roundNo}/decisions` |
| 描述 | 提交团队本回合决策，进入 `Decision Validator` 校验链路 |
| 权限要求 | `learner`、`team_captain`、课程教师代理提交 |
| 优先级 | P0 |
| Header | `Idempotency-Key` |
| Body | `team_id`、`decision_payload`、`agent_proposal_refs[]`、`client_revision` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_decision_submit_001\",\n  \"code\": \"OK\",\n  \"message\": \"submitted\",\n  \"data\": {\n    \"decision_id\": \"decision_001\",\n    \"status\": \"submitted\",\n    \"validation_report\": {\n      \"passed\": true,\n      \"warnings\": []\n    }\n  }\n}\n``` |
| 状态码与错误码 | `201` 成功；`409 DEC-409-001` 回合已锁定；`422 DEC-422-001` 校验失败；`428 DEC-428-001` 所属 run 未冻结参数集 |
| 可测试验收标准 | 合法决策返回 `submitted/validated`；非法字段返回结构化错误；`agent_proposal_refs` 仅用于审计/复盘，不能直接影响结算结果 |
| 注意事项 | 建议保留提交修订版本历史，而不是原地覆盖；最新有效版本在锁轮时固化到 `decision_batch_id` |
| 来源依据 | `SimWar_核心引擎与小模型体系深化设计报告_清洁版.txt` 第7.4 节；`docs/architecture/system-architecture.md` 第8、9、12、14章；`SimWar 在 BLP 核心上的行业无关 Kernel 与行业插件融合架构研究.md`“接口规范建议” |

**API-018 获取状态快照**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-018 |
| 模块归属 | 回合与决策管理 |
| 方法 | `GET` |
| 路径 | `/api/v1/runs/{runId}/rounds/{roundNo}/state-snapshot` |
| 描述 | 读取指定 run/round 的可见状态快照 |
| 权限要求 | 团队成员、教师、管理员、只读 AI 服务 |
| 优先级 | P0 |
| Query | `team_id`、`visible_state=state_obs|state_est|teacher_summary` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_snapshot_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"snapshot_id\": \"snap_obs_r1_t1\",\n    \"visible_state\": \"state_obs\",\n    \"team_id\": \"team_001\",\n    \"metrics\": {\n      \"sales\": 820,\n      \"inventory\": 64,\n      \"cash\": 540000\n    }\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`403 SNAP-403-001` 请求了超出权限的可见态；`404 SNAP-404-001` 快照不存在 |
| 可测试验收标准 | 学员不可请求 `state_true`；教师仅能拿到授权摘要；AI 服务调用应记录来源模型与工具链 |
| 注意事项 | AI 模型调用此接口必须走只读服务身份；禁止返回完整 `agent_pool` 与完整 `ParameterSet` |
| 来源依据 | `SimWar_核心引擎与小模型体系深化设计报告_清洁版.txt` 7.2 节；`SimWar_计量核心模型深化与工程契约报告_清洁版_v3.0 (3).txt` 关于三态输出与学员端可见性；`docs/architecture/system-architecture.md` 第10、13章 |

## 仿真结算、AI 建议、Replay / Shadow Replay、行业插件

本组接口覆盖平台可信闭环的四个关键层：正式结算、AI 建议、Shadow Replay 发布门禁、插件运行与发布。它们共同保障“Kernel 唯一真值、AI 只读、Plugin 局部写、Replay 可审计”的制度化落地。  
**主要依据**：`docs/architecture/system-architecture.md` 第8、9、10、11、12、13、14、23章；`SimWar_计量核心模型深化与工程契约报告_清洁版_v3.0 (3).txt` 第3、13、16、18、22章；`SimWar_核心引擎与小模型体系深化设计报告_清洁版.txt` 第7章；`SimWar康养定制模拟商战模型与算法研究报告.md`、`基于 SimWar 行业无关内核与行业插件架构的康养定制模拟商战模型与算法报告.md` 的接口表与插件边界。

**API-019 正式结算回合**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-019 |
| 模块归属 | 仿真结算接口 |
| 方法 | `POST` |
| 路径 | `/internal/v1/runs/{runId}/rounds/{roundNo}/settle` |
| 描述 | 内核唯一真值写入口；以冻结决策、冻结参数集、插件输出和随机种子执行正式结算 |
| 权限要求 | `service_kernel` |
| 优先级 | P0 |
| Header | `Idempotency-Key`，内部服务凭证 |
| Body | `parameter_set_id`、`decision_batch_id`、`state_snapshot_id`、`shock_events[]`、`mode=official`、`random_seed` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_settle_001\",\n  \"code\": \"OK\",\n  \"message\": \"settled\",\n  \"data\": {\n    \"status\": \"settled\",\n    \"state_true_snapshot_id\": \"state_r4_true\",\n    \"state_obs_snapshot_id\": \"state_r4_obs\",\n    \"ledger_id\": \"ledger_r4\",\n    \"result_summary\": {\n      \"market_share_by_firm\": {\"team_001\": 0.31, \"team_002\": 0.27},\n      \"average_markup\": 0.24,\n      \"consumer_surplus_index\": 1.07,\n      \"rank_snapshot\": [{\"team_id\": \"team_001\", \"rank\": 1}]\n    },\n    \"replay_hash\": \"sha256:<REPLAY_HASH>\"\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`409 SET-409-001` 回合同一批次已结算；`428 SET-428-001` 参数集未冻结；`500 SET-500-001` 求解失败并进入 shadow queue |
| 可测试验收标准 | 相同 `runId + roundNo + decision_batch_id + parameter_set_id + random_seed` 重试必须返回同一 `replay_hash`；成功后写入 `state_true/state_obs/state_est` 与账本；AI 与前端无权调用 |
| 注意事项 | 这是平台最关键的幂等接口；任何历史修正只能通过追加事件，不允许覆盖结算结果 |
| 来源依据 | `SimWar_计量核心模型深化与工程契约报告_清洁版_v3.0 (3).txt` 18.1 节示例；`docs/architecture/system-architecture.md` 第8、9、12、23章；`SimWar架构下基于BLP的三大商战平台融合设计报告.txt` settle 幂等要求 |

**API-020 查询回合结果**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-020 |
| 模块归属 | 仿真结算接口 |
| 方法 | `GET` |
| 路径 | `/api/v1/runs/{runId}/rounds/{roundNo}/results` |
| 描述 | 返回回合结果、排名快照与三段式反馈骨架 |
| 权限要求 | 团队成员、教师、管理员 |
| 优先级 | P0 |
| Query | `team_id`、`view=team|teacher|public` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_result_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"round_no\": 1,\n    \"team_id\": \"team_001\",\n    \"what_happened\": {\"revenue\": 1200000, \"profit\": 180000, \"rank\": 2},\n    \"why\": [\"price improved conversion\", \"inventory shortage limited upside\"],\n    \"next_risk\": [\"cash runway tightening\"],\n    \"result_ref\": \"settlement_001\"\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`403 RES-403-001` 查看权限不足；`404 RES-404-001` 结果尚未发布 |
| 可测试验收标准 | 学员默认只能返回本队结果与公开排名；教师视图可查看全班摘要；结果引用正式 `SettlementResult` 而非 AI 生成文本 |
| 注意事项 | 文本说明可由后续 AI 复盘补充，但数值必须来自正式结算结果 |
| 来源依据 | `整体架构-教师端学生端.md` 结果查看与复盘分析；`docs/architecture/system-architecture.md` 第8、10章；`SimWar_计量核心模型深化与工程契约报告_清洁版_v3.0 (3).txt` 学员端反馈原则 |

**API-021 生成策略建议**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-021 |
| 模块归属 | AI 建议接口 |
| 方法 | `POST` |
| 路径 | `/api/v1/agents/strategy-advisor/propose` |
| 描述 | 基于状态快照、允许工具结果与教学目标生成建议，但不得写真值 |
| 权限要求 | `learner`、`teacher`、`service_ai` |
| 优先级 | P1 |
| Header | `Authorization`、`X-Tenant-Id` |
| Body | `run_id`、`round_no`、`team_id`、`visible_state_ref`、`objective`、`allowed_tools[]` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_ai_strategy_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"proposal_id\": \"prop_001\",\n    \"advisory_only\": true,\n    \"truth_write_attempted\": false,\n    \"recommendations\": [\n      {\"topic\": \"pricing\", \"suggestion\": \"consider a modest price decrease\"}\n    ],\n    \"evidence_cards\": [\n      {\"metric\": \"inventory_days\", \"value\": 4.2}\n    ],\n    \"risk_cards\": [\n      {\"risk\": \"stockout\"}\n    ]\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`403 AI-403-001` AI 服务请求越权快照；`422 AI-422-001` 输入不符合 advisory schema |
| 可测试验收标准 | 返回值必须包含 `advisory_only=true` 与 `truth_write_attempted=false`；调用写真值接口的尝试必须被阻断并告警；输出记录进入 `CoachOutput` |
| 注意事项 | 生成内容仅供参考；后续若学员采纳，仍须通过 API-017 正式提交决策 |
| 来源依据 | `SimWar_核心引擎与小模型体系深化设计报告_清洁版.txt` 7.3 节；`docs/architecture/system-architecture.md` 第10、13章 |

**API-022 生成回合复盘**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-022 |
| 模块归属 | AI 建议接口 |
| 方法 | `POST` |
| 路径 | `/api/v1/agents/debrief-coach/generate` |
| 描述 | 基于正式结果和可见状态生成教学复盘草稿 |
| 权限要求 | `teacher`、团队成员查看本队版，`service_ai` |
| 优先级 | P1 |
| Header | `Authorization` |
| Body | `run_id`、`round_no`、`team_id`、`result_ref`、`audience=teacher|team` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_ai_debrief_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"debrief_id\": \"debrief_001\",\n    \"summary\": \"team improved margin but underinvested in capacity\",\n    \"evidence_cards\": [\n      {\"metric\": \"gross_margin\", \"value\": 0.32}\n    ],\n    \"improvement_actions\": [\n      \"review capacity expansion before next round\"\n    ]\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`404 AI-404-001` 引用结果不存在；`403 AI-403-002` 请求了无权可见数据 |
| 可测试验收标准 | 输出必须引用正式结果对象；学员版不得暴露教师摘要或完整 `state_true`；复盘生成行为可审计 |
| 注意事项 | 本接口生成的是草稿，教师可编辑后发布 |
| 来源依据 | `整体架构-教师端学生端.md` 复盘分析与反思诊断；`docs/architecture/system-architecture.md` 第10章；`SimWar_核心引擎与小模型体系深化设计报告_清洁版.txt` 7.6 节 |

**API-023 生成学习推荐流**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-023 |
| 模块归属 | AI 建议接口 |
| 方法 | `POST` |
| 路径 | `/api/v1/recommendations/learning-feed` |
| 描述 | 根据学习记录、角色画像与能力缺口推荐内容、案例、同伴或训练任务 |
| 权限要求 | `learner`、`teacher` |
| 优先级 | P2 |
| Body | `user_id`、`course_id`、`goal_tags[]`、`context_window` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_learning_feed_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"items\": [\n      {\n        \"type\": \"case\",\n        \"ref_id\": \"case_001\",\n        \"reason\": \"evidence_use_gap\"\n      }\n    ]\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`403 REC-403-001` 不可读取他人学习画像 |
| 可测试验收标准 | 推荐结果不泄露跨租户记录；推荐解释字段存在；若引用授权内容，必须落在许可范围内 |
| 注意事项 | 推荐层属于学习支持层，不进入正式结算 |
| 来源依据 | `SimWar_核心引擎与小模型体系深化设计报告_清洁版.txt` 推荐接口与学习图谱章节；`docs/architecture/system-architecture.md` 第10章 |

**API-024 创建 Shadow Replay**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-024 |
| 模块归属 | Replay / Shadow Replay |
| 方法 | `POST` |
| 路径 | `/api/v1/replays/shadow` |
| 描述 | 使用候选参数集、候选插件版本或候选场景包对历史 run 进行旁路重放 |
| 权限要求 | `teacher`、`model_governor`、`tenant_admin` |
| 优先级 | P0 |
| Header | `Idempotency-Key` |
| Body | `source_run_id`、`candidate_parameter_set_id`、`candidate_plugin_versions[]`、`candidate_scenario_package_id`、`acceptance_profile` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_shadow_001\",\n  \"code\": \"OK\",\n  \"message\": \"accepted\",\n  \"data\": {\n    \"replay_id\": \"replay_001\",\n    \"mode\": \"shadow\",\n    \"status\": \"queued\"\n  }\n}\n``` |
| 状态码与错误码 | `202` 已受理；`409 REP-409-001` 正在执行同一候选组合；`422 REP-422-001` 候选对象不满足回放条件 |
| 可测试验收标准 | 可对历史 run 发起重放；不修改任何历史正式成绩；写入治理与审计记录 |
| 注意事项 | 必须显式记录候选版本组合，供审批复核 |
| 来源依据 | `docs/architecture/system-architecture.md` 第8、12、16、23章；`SimWar_计量核心模型深化与工程契约报告_清洁版_v3.0 (3).txt` 第16、18章；`基于 SimWar 行业无关内核与行业插件架构的康养定制模拟商战模型与算法报告.md` `/api/replays/shadow` |

**API-025 查询 Replay 报告**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-025 |
| 模块归属 | Replay / Shadow Replay |
| 方法 | `GET` |
| 路径 | `/api/v1/replays/{replayId}` |
| 描述 | 查询 Replay/Shadow Replay 差异报告与是否过门禁 |
| 权限要求 | `teacher`、`model_governor`、`tenant_admin`、`platform_admin` |
| 优先级 | P0 |
| Path | `replayId` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_replay_get_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"replay_id\": \"replay_001\",\n    \"status\": \"completed\",\n    \"passed\": true,\n    \"diff_summary\": {\n      \"score_delta_max\": 0.003,\n      \"rank_changed_teams\": 0,\n      \"fairness_risk\": \"low\"\n    }\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`404 REP-404-001` 报告不存在 |
| 可测试验收标准 | 报告必须展示候选版本与正式版本对比；支持教师解释与治理审批引用；读取不改变状态 |
| 注意事项 | 若报告未完成，应返回进行中状态而非空对象 |
| 来源依据 | `docs/architecture/system-architecture.md` 第8、16章；`SimWar_计量核心模型深化与工程契约报告_清洁版_v3.0 (3).txt` ReplayReport 对象定义；`SimWar 在 BLP 核心上的行业无关 Kernel 与行业插件融合架构研究.md` Replay & Audit 设计 |

**API-026 审批 ParameterSet 发布**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-026 |
| 模块归属 | Replay / Shadow Replay |
| 方法 | `POST` |
| 路径 | `/api/v1/governance/parameter-sets/{parameterSetId}/approve` |
| 描述 | 将候选参数集从 `candidate/shadow_passed` 变更为 `approved` |
| 权限要求 | `model_governor`、`platform_admin` |
| 优先级 | P0 |
| Header | `Idempotency-Key` |
| Body | `decision`、`shadow_replay_id`、`approval_note` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_param_approve_001\",\n  \"code\": \"OK\",\n  \"message\": \"approved\",\n  \"data\": {\n    \"parameter_set_id\": \"param_approved_1_4_2\",\n    \"status\": \"approved\"\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`409 GOV-409-001` 未通过 Shadow Replay 不可审批；`422 GOV-422-001` 当前状态不可转移 |
| 可测试验收标准 | 仅允许由治理角色审批；已 `approved` 参数集不可被覆盖；审批动作写入治理审计 |
| 注意事项 | 若需回滚，应新发弃用/替代事件，而不是覆盖原批准结果 |
| 来源依据 | `SimWar_计量核心模型深化与工程契约报告_清洁版_v3.0 (3).txt` ParameterSet 状态；`docs/architecture/system-architecture.md` 第14、23章；`SimWar架构下基于BLP的三大商战平台融合设计报告.txt` 关于 approved parameter set 不可覆盖 |

**API-027 查询插件列表**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-027 |
| 模块归属 | 行业插件管理 |
| 方法 | `GET` |
| 路径 | `/api/v1/plugins` |
| 描述 | 查询当前租户可用插件及版本状态 |
| 权限要求 | `teacher`、`scenario_designer`、`tenant_admin` |
| 优先级 | P1 |
| Query | `status`、`industry` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_plugin_list_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"items\": [\n      {\n        \"plugin_id\": \"plugin_eldercare\",\n        \"name\": \"Eldercare Plugin\",\n        \"status\": \"released\",\n        \"latest_version\": \"1.2.0\"\n      }\n    ]\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`403 PLG-403-001` 无插件列表查看权限 |
| 可测试验收标准 | 仅返回本租户有权使用的插件；可区分 `draft/released/disabled` 状态 |
| 注意事项 | 读取不代表激活绑定到某课程或 run |
| 来源依据 | `docs/architecture/system-architecture.md` 第11、12、14章 |

**API-028 上传插件包**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-028 |
| 模块归属 | 行业插件管理 |
| 方法 | `POST` |
| 路径 | `/api/v1/plugins` |
| 描述 | 上传新的插件包或新版本草稿 |
| 权限要求 | `platform_admin`、`scenario_designer`（受租户策略限制） |
| 优先级 | P0 |
| Header | `Idempotency-Key` |
| Body | `plugin_name`、`industry`、`version`、`manifest`、`artifact_ref` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_plugin_upload_001\",\n  \"code\": \"OK\",\n  \"message\": \"created\",\n  \"data\": {\n    \"plugin_id\": \"plugin_eldercare\",\n    \"version\": \"1.3.0\",\n    \"status\": \"draft\"\n  }\n}\n``` |
| 状态码与错误码 | `201` 成功；`409 PLG-409-001` 版本已存在；`422 PLG-422-001` Manifest 不通过契约校验 |
| 可测试验收标准 | 上传后先处于 `draft`；必须通过兼容性与 Shadow Replay 才能发布；审计记录版本、上传者与 artifact 摘要 |
| 注意事项 | 上传并不自动执行启用 |
| 来源依据 | `docs/architecture/system-architecture.md` 第11、12、14章；`SimWar康养定制模拟商战模型与算法研究报告.md` 插件契约建议；`基于 SimWar 行业无关内核与行业插件架构的康养定制模拟商战模型与算法报告.md` 插件接口表 |

**API-029 编译插件上下文**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-029 |
| 模块归属 | 行业插件管理 |
| 方法 | `POST` |
| 路径 | `/api/v1/plugins/{pluginId}/compile-context` |
| 描述 | 将行业事实、政策、地理与课程场景要素编译为插件执行上下文 |
| 权限要求 | `teacher`、`scenario_designer`、`service_kernel` |
| 优先级 | P1 |
| Header | `Idempotency-Key` |
| Body | `plugin_version`、`facts`、`policy_facts`、`geo_facts`、`scenario_template_id` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_plugin_ctx_001\",\n  \"code\": \"OK\",\n  \"message\": \"compiled\",\n  \"data\": {\n    \"plugin_context_id\": \"plgctx_001\",\n    \"plugin_id\": \"plugin_eldercare\",\n    \"context_hash\": \"sha256:<CTX_HASH>\"\n  }\n}\n``` |
| 状态码与错误码 | `201` 成功；`422 PLG-422-002` 行业事实不足或不匹配插件 schema |
| 可测试验收标准 | 上下文对象可被后续场景编译引用；不允许直接产出真值字段；写入审计 |
| 注意事项 | 该接口产物属于插件局部上下文，不等同于正式结算结果 |
| 来源依据 | `基于 SimWar 行业无关内核与行业插件架构的康养定制模拟商战模型与算法报告.md` `/api/plugins/{id}/compile-context`；`SimWar康养定制模拟商战模型与算法研究报告.md` 插件上下文建议；`docs/architecture/system-architecture.md` 第11章 |

**API-030 发布插件版本**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-030 |
| 模块归属 | 行业插件管理 |
| 方法 | `POST` |
| 路径 | `/api/v1/plugins/{pluginId}/release` |
| 描述 | 将草稿插件版本发布为 `released`，供课程与场景编译使用 |
| 权限要求 | `platform_admin`、`model_governor` |
| 优先级 | P0 |
| Header | `Idempotency-Key` |
| Body | `version`、`shadow_replay_id`、`compatibility_report_ref` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_plugin_release_001\",\n  \"code\": \"OK\",\n  \"message\": \"released\",\n  \"data\": {\n    \"plugin_id\": \"plugin_eldercare\",\n    \"version\": \"1.3.0\",\n    \"status\": \"released\"\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`409 PLG-409-002` 缺少兼容报告或 Shadow Replay；`422 PLG-422-003` 状态不可转移 |
| 可测试验收标准 | 未通过兼容测试不可发布；发布写入版本审计；已绑定到进行中 run 的旧版本不得被热替换 |
| 注意事项 | 运行中的 run 仍使用冻结的插件版本 |
| 来源依据 | `docs/architecture/system-architecture.md` 第11、14、21章；`SimWar 在 BLP 核心上的行业无关 Kernel 与行业插件融合架构研究.md` 插件版本冻结与 Shadow Replay 要求；`SimWar架构下基于BLP的三大商战平台融合设计报告.txt` 灰度前必须过 Shadow Replay |

## 审计与日志、通用错误码与验收清单

本组接口服务于可追溯、可对账、可申诉与合规留痕。由于平台要求所有写操作留痕、事件不可覆写、历史结果可回放，因此审计接口不是可选配套，而是正式系统的一部分。  
**主要依据**：`docs/architecture/system-architecture.md` 第3、5、6、7、12、13、16、17、20、23章；`SimWar_核心引擎与小模型体系深化设计报告_清洁版.txt` 事件流标准与 Definition of Done；`SimWar 在 BLP 核心上的行业无关 Kernel 与行业插件融合架构研究.md` Replay & Audit；`SimWar架构下基于BLP的三大商战平台融合设计报告.txt` 关于 Decision Audit、replay hash、审计与申诉。

**API-031 查询审计日志**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-031 |
| 模块归属 | 审计与日志 |
| 方法 | `GET` |
| 路径 | `/api/v1/audit/logs` |
| 描述 | 分页查询审计日志，支持按 actor、entity、time range、action 过滤 |
| 权限要求 | `tenant_admin`、`ops`、`platform_admin`；教师只可查看与自己课程相关的审计 |
| 优先级 | P0 |
| Query | `entity_type`、`entity_id`、`actor_id`、`action`、`start_at`、`end_at`、`page`、`page_size` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_audit_logs_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"items\": [\n      {\n        \"log_id\": \"audit_001\",\n        \"action\": \"DECISION_SUBMITTED\",\n        \"entity_type\": \"Decision\",\n        \"entity_id\": \"decision_001\",\n        \"actor_id\": \"usr_101\",\n        \"occurred_at\": \"<TIMESTAMP>\"\n      }\n    ],\n    \"total\": 1\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`403 AUD-403-001` 无日志查询权限 |
| 可测试验收标准 | 写操作必须可被检索到；过滤条件准确；跨租户日志不可见 |
| 注意事项 | 读取日志本身通常不写业务审计，但可在高合规环境记录访问痕迹 |
| 来源依据 | `docs/architecture/system-architecture.md` 第5、6、13、16章 |

**API-032 查询实体审计时间线**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-032 |
| 模块归属 | 审计与日志 |
| 方法 | `GET` |
| 路径 | `/api/v1/audit/entities/{entityType}/{entityId}/timeline` |
| 描述 | 查看某一个对象的完整时间线，如课程、run、round、decision、parameter set、plugin version |
| 权限要求 | `teacher`（限自己课程相关对象）、`tenant_admin`、`ops`、`platform_admin` |
| 优先级 | P1 |
| Path | `entityType`、`entityId` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_audit_timeline_001\",\n  \"code\": \"OK\",\n  \"message\": \"success\",\n  \"data\": {\n    \"entity_type\": \"Run\",\n    \"entity_id\": \"run_001\",\n    \"timeline\": [\n      {\"action\": \"RUN_CREATED\", \"at\": \"<TIMESTAMP>\"},\n      {\"action\": \"ROUND_STARTED\", \"at\": \"<TIMESTAMP>\"},\n      {\"action\": \"ROUND_SETTLED\", \"at\": \"<TIMESTAMP>\"}\n    ]\n  }\n}\n``` |
| 状态码与错误码 | `200` 成功；`404 AUD-404-001` 实体不存在；`403 AUD-403-002` 无对象级查看权限 |
| 可测试验收标准 | 时间线顺序正确；能串联到 replay/report/result 等引用对象；不暴露无权细节字段 |
| 注意事项 | 适用于申诉处理、课后复盘和问题定位 |
| 来源依据 | `docs/architecture/system-architecture.md` 第6、8、13、16章；`SimWar 在 BLP 核心上的行业无关 Kernel 与行业插件融合架构研究.md` Replay & Audit |

**API-033 导出审计包**

| 字段 | 内容 |
|---|---|
| 接口编号 | API-033 |
| 模块归属 | 审计与日志 |
| 方法 | `POST` |
| 路径 | `/api/v1/audit/exports` |
| 描述 | 按 run、course 或 replay 维度导出审计包，用于治理复核、申诉或外部合规存档 |
| 权限要求 | `ops`、`platform_admin`、`model_governor`；租户级导出需额外策略授权 |
| 优先级 | P1 |
| Header | `Idempotency-Key` |
| Body | `scope_type(course|run|replay)`、`scope_id`、`include_event_store`、`include_replay_report` |
| 响应示例 | ```json\n{\n  \"request_id\": \"req_audit_export_001\",\n  \"code\": \"OK\",\n  \"message\": \"accepted\",\n  \"data\": {\n    \"export_id\": \"exp_001\",\n    \"status\": \"queued\"\n  }\n}\n``` |
| 状态码与错误码 | `202` 已受理；`403 AUD-403-003` 无导出权限；`422 AUD-422-001` 导出范围非法 |
| 可测试验收标准 | 导出任务异步执行；导出产物可追溯到 scope 与申请人；导出行为写入审计 |
| 注意事项 | 含敏感内容的导出应二次确认，并按租户与合规策略脱敏 |
| 来源依据 | `docs/architecture/system-architecture.md` 第13、16、17、20章；`SimWar_核心引擎与小模型体系深化设计报告_清洁版.txt` 授权内容治理与审计要求 |

### 通用错误码字典

| 错误码 | HTTP | 含义 |
|---|---:|---|
| `AUTH-401-001` | 401 | 登录失败，凭证无效 |
| `AUTH-403-001` | 403 | 无权限进行角色绑定 |
| `CRS-428-001` | 428 | 发布课程前缺少已批准参数集或可执行场景包 |
| `TEAM-409-002` | 409 | 队伍角色槽位冲突 |
| `ROUND-409-002` | 409 | 回合已锁定，不能继续提交 |
| `DEC-422-001` | 422 | 决策校验失败 |
| `DEC-428-001` | 428 | run 尚未冻结参数集 |
| `SET-428-001` | 428 | 正式结算时参数集未冻结 |
| `SET-500-001` | 500 | 求解失败，进入 Shadow Queue |
| `REP-409-001` | 409 | 同一 Shadow Replay 正在执行 |
| `GOV-409-001` | 409 | 未通过 Shadow Replay，不可审批 |
| `PLG-422-001` | 422 | 插件 Manifest 不通过契约校验 |
| `AUD-403-003` | 403 | 审计导出权限不足 |

### 全局验收清单

| 验收主题 | 验收要求 |
|---|---|
| 真值边界 | 任何 AI 接口都不能直接写市场份额、现金流、利润、评分、排名、`ParameterSet` |
| 参数治理 | `Approved ParameterSet` 不可覆盖；正式 run 启动必须绑定并冻结参数版本 |
| 幂等性 | 提交决策、锁轮、结算、审批、插件发布、审计导出支持安全重试；正式结算返回稳定 `replay_hash` |
| 审计 | 所有写接口产生日志；日志可按实体、actor、时间窗查询；事件与状态快照均可追溯 |
| 可见性隔离 | 学员默认只看 `state_obs/state_est`；教师看摘要；`state_true` 不对学员开放 |
| 版本冻结 | run 创建后绑定的 `ScenarioPackage`、`PluginVersion`、`ParameterSet` 不因后续发布而漂移 |
| Shadow Gate | 参数审批与插件发布必须依赖 Replay/Shadow Replay 结果 |
| 多租户隔离 | 任意课程、队伍、日志与结果查询都必须受 `X-Tenant-Id` 和 RBAC 共同约束 |
| OpenAPI-First | 所有 P0 接口需先落地 OpenAPI、JSON Schema、示例、错误码、契约测试 |
| 申诉与回放 | 任意正式回合结果都能通过事件账本、快照与 replay hash 复算并对账 |

### 开放问题与限制

当前 `docs/architecture/system-architecture.md` 已给出一版 API 总览，但教师端/学员端文档与计量工程契约文档对部分路径采用了不同层级命名，例如 `/api/v1/runs/{run_id}/rounds/{round_no}/settle` 与 `/internal/v1/runs/{run_id}/rounds/{round_id}/settle`。本文档将正式结算接口固定为 **内部可信接口**，而将结果查询与教学视图保留在外部 API 中；如果后续实现决定统一为单一路径，需要在 OpenAPI 与网关权限策略中再做一次收口。另一个未完全展开的部分是 LTI、SCIM、xAPI/LRS 的标准接入细节；它们已在研究材料中被明确为平台边界的重要组成，但不属于本版 `API.md` 的核心业务接口清单，因此只在设计依据中保留，不在本版逐条展开。
