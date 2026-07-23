export const KNOWN_LIMITS_POLICY_VERSION = "phase7-known-limits-runtime.v1" as const;

export type KnownLimitsRole = "teacher" | "student" | "tenant_admin" | "platform_admin";
export type KnownLimitSemanticId =
  | "JSON_INTERNAL_ONLY"
  | "SYNTHETIC_ONLY"
  | "LOOPBACK_ONLY"
  | "POSTGRESQL_NOT_ACTIVE"
  | "DURABLE_SETTLEMENT_NOT_PROVEN"
  | "DURABLE_RECOVERY_NOT_PROVEN"
  | "ABORT_IS_NOT_ROLLBACK"
  | "RESET_IS_NOT_RECOVERY"
  | "CLEANUP_IS_NOT_PURGE"
  | "REPLAY_MATCHED_IS_NOT_BACKUP_OR_RESTORE"
  | "AUTOMATED_VALIDATION_IS_NOT_HUMAN_VALIDATION"
  | "NO_PILOT_OR_PRODUCTION_AUTHORIZATION"
  | "ISSUE_111_OPEN"
  | "ISSUE_114_OPEN"
  | "ISSUE_115_OPEN"
  | "HUMAN_VALIDATION_WAIVED_BY_OWNER"
  | "AI_ADVISORY_ONLY"
  | "SIMULATION_CORE_IS_FORMAL_TRUTH_AUTHORITY";

export interface KnownLimitCatalogItem {
  semantic_id: KnownLimitSemanticId;
  title: string;
  description: string;
  visible_to: readonly KnownLimitsRole[];
}

export interface KnownLimitsProjectionItem extends KnownLimitCatalogItem {
  role_note?: string;
}

export interface KnownLimitsProjection {
  actor_role: KnownLimitsRole;
  allowed_actions: readonly [];
  explicit_non_proofs: readonly string[];
  items: readonly KnownLimitsProjectionItem[];
  mutation_capability: "NONE";
  policy_version: typeof KNOWN_LIMITS_POLICY_VERSION;
  summary: string;
}

const ALL_PRODUCT_ROLES: readonly KnownLimitsRole[] = [
  "teacher",
  "student",
  "tenant_admin",
  "platform_admin"
];
const PRIVILEGED_PRODUCT_ROLES: readonly KnownLimitsRole[] = [
  "teacher",
  "tenant_admin",
  "platform_admin"
];

export const KNOWN_LIMITS_CATALOG: readonly KnownLimitCatalogItem[] = [
  {
    semantic_id: "JSON_INTERNAL_ONLY",
    title: "仅限 JSON 内部运行时",
    description: "当前产品表面仅使用 JSON 内部运行时，不代表持久化运行时已经正式启用。",
    visible_to: ALL_PRODUCT_ROLES
  },
  {
    semantic_id: "SYNTHETIC_ONLY",
    title: "仅限合成数据",
    description: "当前验证与产品表面仅可使用合成或可清理数据，不代表真实客户数据可用。",
    visible_to: ALL_PRODUCT_ROLES
  },
  {
    semantic_id: "LOOPBACK_ONLY",
    title: "仅限本机回环网络",
    description: "当前运行范围限于本机回环网络，不代表外部访问、受控试点或生产网络已获授权。",
    visible_to: ALL_PRODUCT_ROLES
  },
  {
    semantic_id: "POSTGRESQL_NOT_ACTIVE",
    title: "PostgreSQL 尚未激活",
    description: "PostgreSQL 运行时、SQL 与迁移未在当前内部产品范围内激活。",
    visible_to: ALL_PRODUCT_ROLES
  },
  {
    semantic_id: "DURABLE_SETTLEMENT_NOT_PROVEN",
    title: "持久化结算尚未证明",
    description: "当前 JSON 内部运行时不证明结算具备持久化保证。",
    visible_to: ALL_PRODUCT_ROLES
  },
  {
    semantic_id: "DURABLE_RECOVERY_NOT_PROVEN",
    title: "持久化恢复尚未证明",
    description: "当前证据不证明备份、恢复或灾难恢复能力。",
    visible_to: ALL_PRODUCT_ROLES
  },
  {
    semantic_id: "ABORT_IS_NOT_ROLLBACK",
    title: "中止不是回滚",
    description: "ABORT 只改变受控预结算生命周期状态，不会回滚已经形成的正式事实。",
    visible_to: ALL_PRODUCT_ROLES
  },
  {
    semantic_id: "RESET_IS_NOT_RECOVERY",
    title: "重置不是恢复",
    description: "RESET 只可用于受控生命周期准备状态，不构成数据恢复或灾难恢复。",
    visible_to: ALL_PRODUCT_ROLES
  },
  {
    semantic_id: "CLEANUP_IS_NOT_PURGE",
    title: "清理不是通用删除",
    description: "CLEANUP 仅处理受控合成预结算运行，不是通用数据清除能力。",
    visible_to: ALL_PRODUCT_ROLES
  },
  {
    semantic_id: "REPLAY_MATCHED_IS_NOT_BACKUP_OR_RESTORE",
    title: "回放匹配不是备份或恢复",
    description: "Replay 证据用于读取、比较与验证，不能替代备份、恢复或灾难恢复机制。",
    visible_to: ALL_PRODUCT_ROLES
  },
  {
    semantic_id: "AUTOMATED_VALIDATION_IS_NOT_HUMAN_VALIDATION",
    title: "自动化验证不是真人验证",
    description: "自动化角色与浏览器证据不能替代真人参与、真人观察或真人可用性结论。",
    visible_to: ALL_PRODUCT_ROLES
  },
  {
    semantic_id: "NO_PILOT_OR_PRODUCTION_AUTHORIZATION",
    title: "未授权试点或生产",
    description: "本披露和当前内部验证不授予 Controlled Pilot 或 Production 授权。",
    visible_to: ALL_PRODUCT_ROLES
  },
  {
    semantic_id: "ISSUE_111_OPEN",
    title: "Issue #111 仍处于开放状态",
    description: "当前治理连续性要求 #111 保持 OPEN；本披露不构成该 Issue 的关闭条件。",
    visible_to: PRIVILEGED_PRODUCT_ROLES
  },
  {
    semantic_id: "ISSUE_114_OPEN",
    title: "Issue #114 仍处于开放状态",
    description: "当前治理连续性要求 #114 保持 OPEN；本披露不构成该 Issue 的关闭条件。",
    visible_to: PRIVILEGED_PRODUCT_ROLES
  },
  {
    semantic_id: "ISSUE_115_OPEN",
    title: "Issue #115 仍处于开放状态",
    description: "当前治理连续性要求 #115 保持 OPEN；本披露不构成该 Issue 的关闭条件。",
    visible_to: PRIVILEGED_PRODUCT_ROLES
  },
  {
    semantic_id: "HUMAN_VALIDATION_WAIVED_BY_OWNER",
    title: "真人验证由 Owner 豁免",
    description: "当前 L1 内部例外仅接受 Owner 批准的自动化替代证据，不表示真人验证已经完成。",
    visible_to: PRIVILEGED_PRODUCT_ROLES
  },
  {
    semantic_id: "AI_ADVISORY_ONLY",
    title: "AI 仅提供建议",
    description: "AI、Agent 或自动化建议不得改写正式真值、结算结果或权限边界。",
    visible_to: PRIVILEGED_PRODUCT_ROLES
  },
  {
    semantic_id: "SIMULATION_CORE_IS_FORMAL_TRUTH_AUTHORITY",
    title: "仿真内核是真值权威",
    description: "正式市场、运营、财务、评分与结算真值只能由受控仿真内核或插件路径计算。",
    visible_to: PRIVILEGED_PRODUCT_ROLES
  }
] as const;

const ROLE_NOTES: Readonly<Record<KnownLimitsRole, string>> = {
  platform_admin: "平台范围必须来自显式平台权限；本披露不会推导或扩大跨租户读取能力。",
  student: "学习反馈不是正式成绩；本披露不会增加结果、其他队伍或其他租户的可见范围。",
  teacher: "教师操作仍受现有角色权限约束；候选预览不会激活场景、运行结算或发布结果。",
  tenant_admin: "仅说明当前租户范围；本披露不会授予平台权限或跨租户读取能力。"
};

export function getKnownLimitsProjection(role: KnownLimitsRole): KnownLimitsProjection {
  const items = KNOWN_LIMITS_CATALOG.filter((item) => item.visible_to.includes(role));

  return {
    actor_role: role,
    allowed_actions: [],
    explicit_non_proofs: [
      "This disclosure does not grant G0 PASS.",
      "This disclosure does not grant L1 readiness.",
      "This disclosure does not authorize Pilot or Production."
    ],
    items: items.map((item, index) =>
      index === items.length - 1 ? { ...item, role_note: ROLE_NOTES[role] } : item
    ),
    mutation_capability: "NONE",
    policy_version: KNOWN_LIMITS_POLICY_VERSION,
    summary: "以下限制适用于当前内部产品表面，并保留既有权限与真值保护边界。"
  };
}
