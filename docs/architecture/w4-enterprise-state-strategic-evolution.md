# W4 Enterprise State 与 Strategic Evolution

## 范围

W4 在 JSON runtime 中提供一条受租户、课程、Run、队伍、回合、角色和活动绑定的闭环：

```text
Opening Enterprise State
  -> canonical Strategic Decision
  -> Commitment
  -> StrategicInitiative
  -> governed lead time / milestones / persistent Effect
  -> Simulation Core settlement
  -> Official Outcome + Closing Enterprise State
  -> exact Closing State ref as next Opening State ref
```

`services/simulation-core/src/enterprise-state.ts` 是 W4 Enterprise State 的唯一状态转换入口。`services/api/src/w4-enterprise-state.ts` 只负责应用服务、生命周期校验、引用校验和一次性 repository commit；Student、Teacher、Admin BFF 只能读取安全投影。

## 事实与引用

- State identity 由 `enterprise_state_id`、tenant/course/run/team scope、round、version 和 SHA-256 `state_digest` 组成；不同 team 在同一 Run/round 下不会共享 state/outcome identity。
- Initial State 的 `parent_state_ref` 为 `null`；Closing State 的 parent 必须是本次输入的完整 Opening State ref。
- 下一回合只接受已存在且 digest 匹配的 Closing State ref，不重建或复制第二份 Opening Truth。
- Official Outcome 与 Closing State 通过一次 repository commit 写入；commit 失败时恢复原快照。
- 后续回合只消费持久 Commitment / Effect，不重新执行历史 Decision；`reexecuted_decision_ids` 固定为空数组。
- 每个 Official Outcome 原子保存 replay input manifest，包含 admitted decision IDs、scenario、parameter set、engine、plugin IDs 和 exact seed；manifest 的 opening ref 必须与本次 settlement 输入完全一致。
- Replay 只产生证据，Shadow Replay 永不应用正式结果。

## 产品垂直与投影

New Project 经过 canonical decision 校验，保存 cost、cycle、area、beds、bed mix、ramp 和 lead time，并以 Initiative milestone 记录 approved、construction、activated 路径。项目只有在 activation round 到达后才进入 active。

Student 通过 `/api/v1/bff/student/w4/.../portfolio` 获取脱敏投影，不包含 cash、`state_true`、score、rank 或其他队伍私有字段；Teacher 读取只读的 Opening/Closing、Commitment、Effect、milestone 和 blocker；Admin 的 `/api/v1/bff/admin/w4/portfolio` 提供 Group / Portfolio / OperatingUnit / Project / Facility 聚合投影。

Process Information 与 Outcome Information 分开表达。前端明确呈现 loading、empty、partial、ready、blocked、permission、stale、conflict、dependency-missing、error 和 retry 状态。

## Tier B 与 Tier C

`product_line_adjustment`、`positioning_adjustment` 和 `organization_adjustment` 复用同一 Commitment / Effect / Initiative 泛化框架，不创建第二套产品真值。

M&A、ABS、IPO、project sale 和 project closure 只通过 typed `W4PolicySeam` 表示。它们必须经过 proposed → under_review → approved/rejected → closed 的政策生命周期；`may_write_enterprise_state=false` 与 `may_write_official_outcome=false` 是契约常量，因此当前不会出现假按钮或即时真值写入。

## 路由安全边界

所有 W4 round-scoped 路由在 route layer 绑定 actor、tenant、course、run、team、round、role 和固定 activity id `w4-enterprise-state-strategic-evolution`，并在应用服务前验证 Run 与 Team 的租户/课程归属。Learner 只能访问自己的 team。Initial State 仅允许 round 1；continuation 必须消费精确的上一 Closing ref 且目标 round 连续；Projection、Replay 与 Shadow Replay 必须使用已知或紧邻下一 round，Replay/Shadow Replay 还必须与 outcome 的 exact round ref 一致。Strategic Decision 不信任客户端的 `canonical` 标记：formal run 必须由现有 role-workflow canonical admission 返回 merge commit/team confirmation 证据，legacy direct 仅接受显式 synthetic admission。Settlement 只接受已锁定（或已结算/发布）的真实 Round，并再次验证该 team 的 canonical admission。Admin aggregate 只在当前 tenant 的 Admin 会话下可读，且不暴露写入接口。

W3 的历史 `W3-SECURITY-LIMIT-ROLE-ACTIVITY-RECEIPT` 未被 W4 新路径复用，保留为 `NOT_CONSUMED_PRESERVED`；W4 不扩展 PostgreSQL/RLS、Pilot 或 Production 权限。
