# FE_AUTHORITY_VISIBILITY_BOUNDARY

**绑定 SHA**：`bb343faf0c38e4a4a6d8b7928d0a0f35ecf8ad37`

**主要源码证据**：`services/api/src/teacher-student-bff-dto.ts`、`apps/admin/src/admin-bff.ts`、`apps/teacher/src/App.tsx`、`apps/student/src/App.tsx`

**目的**：为 Design System、页面迁移和状态组件提供不可越过的 Authority/Visibility 合同。它不是新增权限，也不是 API 设计替代品。

## 1. Authority 分层

| 层                              | Sole Writer/Authority                                                | 前端可做                                                              | 前端禁止                                                                             |
| ------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 结构化仿真与正式结算            | simulation-core、受控 settlement 路径                                | 读取 server-safe result、显示 Receipt、提交受控 command               | 计算市场/运营/财务/评分，写 `state_true`/SettlementResult/score/rank                 |
| canonical Decision              | Role section → merge commit → team confirmation → canonical Decision | 展示角色草稿、ready、merge、confirm 的状态与差异                      | 将 role draft、AI advice、learning evidence 或未确认 merge 当正式 Decision           |
| Replay/Truth hash               | server replay manifest/hash service                                  | 展示只读 hash、status、diff receipt                                   | 修改 replay hash 输入、覆盖正式结果、把 advisory/billing/entitlement 放入 truth hash |
| BFF projection                  | API BFF DTO 与 `allowed_actions`                                     | 只消费 DTO、`visible_state`、`source_runtime_path`、`audit_reference` | 从 URL/localStorage/历史文档补权限、上下文或字段                                     |
| AI/Agent                        | advisory-only Agent gateway                                          | 展示 `CoachOutput`/`ModelCallLog` 引用、保存 advisory 草稿            | 让 AI 成为 truth writer、覆盖正式 score/rank/settlement                              |
| Billing/Entitlement/Data Policy | Payment → Entitlement ledger 与治理审批                              | 展示访问/额度/审批状态                                                | 让权益写入 market/score/rank/ParameterSet 或把 default policy 当 approved            |

## 2. 角色可见性矩阵

| 角色/投影                  | 可见来源                                                                                        | 可执行动作                                                                                                                               | 明确隐藏/禁止                                                                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform Admin             | `createPlatformAdminAuthorityDto`；`scope=platform`；tenant IDs、平台动作和 audit reference     | `tenant:create/read`、`user:read`、`audit:read`（以服务端 `allowed_actions` 为准）                                                       | tenant private payload、Student private replay、secrets；不得变成业务结算 Authority                                                                                           |
| Tenant Admin               | `createTenantAdminSummaryDto`；当前 `tenant_id` 的 course/team/run/audit counts                 | tenant-scoped read、user/course/audit 读取和受控 export/lifecycle actions                                                                | other tenant data、platform authority、Student private replay、formal truth write                                                                                             |
| Teacher                    | `createTeacherBffWorkspaceDto` 的 dashboard/course/round/team monitor/replay summary            | `course:read`、`round:lock`、受控 settlement/release command、`result:read`、`audit:read`、teacher evidence/confirmation/closure actions | direct store mutation、Student private fields、未确认 role draft、AI advisory truth；`formal_truth_write_allowed=false`                                                       |
| Student / team member      | `createStudentBffCockpitDto` 的 cockpit/decision form/published result/feedback/learning report | `course:read`、`decision:submit`、`result:read`、自己的 role section/ready/merge/confirm commands（以当前 role/team scope 为准）         | `state_true`、full manifest、private parameter/scenario/plugin/replay、canonical evidence digest、decision batch hash、other team/tenant data、teacher/admin private metadata |
| Enterprise Sponsor/Factory | 当前没有独立 BFF/authority                                                                      | 只能复用已有 Admin/Teacher safe projection，或显示 Closed/Known Limit                                                                    | 新建第二业务引擎、读取企业私有 raw data、扩大 tenant/role/Student visibility                                                                                                  |

## 3. Student 禁止字段（服务端 DTO 直接冻结）

`STUDENT_BFF_FORBIDDEN_FIELDS` 当前包含：

```text
state_true
replay_hash
full_manifest
private_parameter_set
private_scenario_assumption
private_scenario_diff
private_plugin_trace
private_shock_internal_detail
private_replay_artifact
canonical_evidence_digest
decision_batch_hash
json_runtime_source_digest
other_team_data
other_tenant_data
teacher_private_evidence
admin_private_metadata
```

前端迁移必须对以上字段保持 deny-by-default。设计稿、截图、`code-connect-map.json` 和测试 fixture 不能通过示例数据暗示这些字段存在或可获取。

## 4. BFF → Design System 数据流

```text
AuthSession / BFF DTO
  ├─ ContextBar ← tenant/course/session/run/round/team/role/mode
  ├─ AuthorityBadge ← canonical enum + evidence_label / source_runtime_path / projection role
  ├─ AllowedActionButton ← allowed_actions + server reason
  ├─ ReceiptPanel ← audit_reference / command receipt / correlation_id / status / reuse_conflict / exact_ref
  ├─ EvidenceDrawer ← read-only exact refs / version / visibility scope
  └─ StatePanel ← server status + next safe action
```

任何组件若没有对应服务端字段，必须显示 Unknown/Known Limit，而不是从客户端状态补齐。组件只管理交互状态（展开、焦点、草稿、过滤器、重试）和请求生命周期；正式业务数值由 server projection 提供。

### AuthorityBadge canonical enum

`AuthorityBadge` 只接受以下 canonical enum；中文是用户可见 label，不能另造 `formal`、`suggestion`、`system` 或 `teacher` 别名：

| enum              | 中文 label | 语义                                                   |
| ----------------- | ---------- | ------------------------------------------------------ |
| `official`        | 正式       | server-owned official result/authority                 |
| `draft`           | 草稿       | 可修改的候选或版本草稿                                 |
| `shadow`          | 影子       | Shadow Replay/候选差异，不写正式结果                   |
| `advisory`        | 建议       | AI/Agent/分析建议，不是 writer                         |
| `system-result`   | 系统结果   | 核心系统计算后的结果投影                               |
| `ai-explanation`  | AI 解释    | 对已存在输入/结果的 advisory explanation               |
| `teacher-comment` | 教师点评   | teacher-authored commentary，受 visibility policy 控制 |
| `unknown`         | 未知       | 服务端未提供足够证据；不能伪装成 Empty/official        |

## 5. 命令边界和禁止动作

### 允许的前端 command

- Student role section `draft/ready`、merge、team confirm：只写当前 team/role 的协作记录，遵守顺序 `RoleDecisionSection → DecisionMergeCommit → TeamConfirmation → canonical Decision`。
- Student `decision:submit`：只有在 BFF `editable_fields` 和当前 round 状态允许时提交；不能绕过 role workflow 或团队确认。
- Teacher round lock/publish、evidence capture/confirm/revise、course/blueprint/package draft/clone：调用对应 BFF/受控 route，并展示 submitting/committed/reused/conflict/failed receipt。
- Admin tenant-safe summary/report/export/lifecycle：只在当前 tenant scope 和 server `allowed_actions` 内执行。

### 明确禁止的前端 command

- `state_true`、score、rank、SettlementResult、Replay truth hash 或 canonical decision 的直接写入。
- 任何 `store`/文件快照/本地数据库直写；前端 API client 只能向 route/BFF 发结构化请求。
- 从前端调用 internal settle route 或把 `settle` 暴露成未经受控的独立 UI 权限。当前 SHA 的 `apps/teacher/src/App.tsx` 旧 `runNextStep` 结算分支（约第 965 行）是必须在后续 PR 中收敛的 debt，不应被新 AppShell 复制。
- 将 AI advisory、learning evidence、billing、entitlement、data policy 或 case candidate 写入正式 truth hash/settlement。
- 在 Student UI 展示 teacher/admin private evidence、其他队伍/租户字段或内部 digest。

## 6. 设计审计规则

1. 每个 `AllowedActionButton` 都显示动作状态和禁用原因；没有 `allowed_actions` 就显示“当前操作不可用”，不猜测。
2. 每个 `ReceiptPanel` 都显示 command、actor、timestamp、correlation_id、status、`reuse_conflict`、`exact_ref`。`reuse_conflict=reused` 表示相同幂等 command 复用既有服务端 receipt；`reuse_conflict=conflict` 表示版本/状态/权限冲突，需要显示原因和安全恢复路径，不能冒充 committed。
3. 每个 `EvidenceDrawer` 默认只读；想改变正式对象时跳到其 Sole Writer 并创建新版本。
4. 每个 Known Limit 都说明“当前限制、不影响什么、尚未证明什么、适用范围”；`JSON_INTERNAL_ONLY`、`SYNTHETIC_ONLY`、Human Validation 未执行等状态不能省略。
5. 视觉 token 只影响展示，不改变 allowed action、visibility 或业务数值；`color.editorialCrimson` 与 `color.officialRiskRed` 不得互换。
6. 最终 browser/contract/source review 必须证明 `FRONTEND_DIRECT_STORE=0`、`STUDENT_VISIBILITY_WIDENING=0`、`AUTHORITY_BREACH=0`；若未测量，报告 `UNKNOWN`，不写 PASS。
