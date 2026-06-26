# Human Decision: ADR-DATA-005

```yaml
decision_id: ADR-DATA-005
status: accepted
accepted_by: Project Owner
accepted_at: 2026-06-26
scope: >
  Accept PostgreSQL as the target durable authority for the operational
  control plane and governance assets of Team, TeamMember, ParameterSet,
  and ScenarioPackage metadata, while preserving Core Simulation Engine
  L1-L3 as the sole formal simulation truth writer.
non_goals: >
  This decision does not authorize SQL, schema design, migration,
  PostgreSQL runtime activation, database connections, transactions,
  row locks, unique constraints, cross-process implementation,
  production data migration, durable settlement implementation,
  or closure of #111, #114, or #115.
next_allowed_task: P0-GOV-EXEC-001
supersedes:
```

## Decision

接受 `ADR-DATA-005: Authority Boundary and Transition Strategy for Team, ScenarioPackage, and ParameterSet`，采用：

```text
ACCEPTED_TARGET_WITH_DEFERRED_DETAILS
```

接受以下目标架构原则：

1. PostgreSQL 是 Team、TeamMember、ParameterSet 与 ScenarioPackage metadata 的目标 durable authority，并承担相应运行控制面、版本、治理、审批、冻结和审计能力的长期承载责任。

2. Core Simulation Engine 的 L1-L3 继续是正式仿真真值、正式结算、Score 与 Rank 的唯一写入者。

3. JSON 继续作为当前 active default runtime；未来目标角色限定为 fixture、seed、demo、import/export 或受控兼容层。JSON 不得与 PostgreSQL 对同一正式领域对象长期形成无治理的双权威写入。

4. ScenarioPackage 的 metadata、版本、状态、artifact reference、content digest 与 Plugin dependency 属于治理边界；大型 payload、附件、快照、报告和行业资源的存储策略留待后续领域设计决定。

5. Team / TeamMember 的成员变化、角色变化、提交资格、权限语义和历史 Run 解释细则，留待后续 Team Domain Design 决定。

6. ParameterSet 的 clone、candidate、approval、revoke、deprecated、Shadow Replay 与细化审批流程，留待后续 ParameterSet Domain Design 决定。

7. Official Run Manifest 的计算性输入与 Teaching / Audit Context 输入必须分层；AI 的 ModelPolicy、ModelVersion、PromptVersion、RAG KnowledgeSetVersion、ToolPolicyVersion 默认属于教学与审计上下文，不得自动成为 L1-L3 正式结算输入。

8. wellness / eldercare demo 被接受为当前 M1 的候选产品语义输入；正式 MVP 行业、课程运行方式、教师/学员/管理员最小动作集合，仍由 `M1-PRODUCT-BOUNDARY-01` 决定。

## Explicit Non-Goals

本决定不授权：

```text
SQL
schema
migration
PostgreSQL runtime activation
database connection
transaction
unique constraint
row lock
cross-process implementation
crash recovery
production data migration
durable settlement implementation
#111 closeout
#114 closeout
#115 closeout
```

## Next Allowed Task

```text
P0-GOV-EXEC-001
Codex Execution Governance Baseline
```
