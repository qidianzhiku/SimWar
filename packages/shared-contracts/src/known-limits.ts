export const KNOWN_LIMITS_POLICY_VERSION = "phase4-known-limits.v1" as const;

export type KnownLimitsRole = "teacher" | "student" | "tenant_admin" | "platform_admin";
export type KnownLimitSemanticId =
  | "KL-01"
  | "KL-02"
  | "KL-03"
  | "KL-04"
  | "KL-05"
  | "KL-06"
  | "KL-07"
  | "KL-08";

export interface KnownLimitCatalogItem {
  semantic_id: KnownLimitSemanticId;
  title: string;
  description: string;
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

export const KNOWN_LIMITS_CATALOG: readonly KnownLimitCatalogItem[] = [
  {
    semantic_id: "KL-01",
    title: "仅限内部合成验证",
    description: "当前产品表面用于内部合成验证，不代表真实教师试讲、受控试点或生产发布。"
  },
  {
    semantic_id: "KL-02",
    title: "JSON 仍是默认运行时",
    description: "当前界面读取 JSON 运行时能力；该状态不代表持久化运行时已经正式启用。"
  },
  {
    semantic_id: "KL-03",
    title: "重置后数据不可保证保留",
    description: "内部演练数据可能随环境重置而消失，不应作为长期保存或恢复依据。"
  },
  {
    semantic_id: "KL-04",
    title: "回放证据不是备份",
    description: "回放与影子回放证据只用于验证和比较，不能替代备份、恢复或灾难恢复机制。"
  },
  {
    semantic_id: "KL-05",
    title: "持久化正式化尚未启用",
    description: "数据库持久化和 durable settlement 尚未获得授权或证明。"
  },
  {
    semantic_id: "KL-06",
    title: "异常需要人工处置",
    description: "内部演练中的异常、重置与证据差异仍需按现有运维流程人工确认。"
  },
  {
    semantic_id: "KL-07",
    title: "不构成发布许可",
    description: "本披露、局部测试或浏览器证据均不授予 Pilot、Production、G0 PASS 或 L1 READY。"
  },
  {
    semantic_id: "KL-08",
    title: "角色边界保持生效",
    description: "所有可见信息与可用动作仍受当前角色、租户和产品权限边界约束。"
  }
] as const;

const ROLE_NOTES: Readonly<Record<KnownLimitsRole, string>> = {
  platform_admin: "平台范围必须来自显式平台权限；本披露不会推导或扩大跨租户读取能力。",
  student: "学习反馈不是正式成绩；本披露不会增加结果、其他队伍或其他租户的可见范围。",
  teacher: "教师操作仍受现有角色权限约束；候选预览不会激活场景、运行结算或发布结果。",
  tenant_admin: "仅说明当前租户范围；本披露不会授予平台权限或跨租户读取能力。"
};

export function getKnownLimitsProjection(role: KnownLimitsRole): KnownLimitsProjection {
  return {
    actor_role: role,
    allowed_actions: [],
    explicit_non_proofs: [
      "This disclosure does not grant G0 PASS.",
      "This disclosure does not grant L1 readiness.",
      "This disclosure does not authorize Pilot or Production."
    ],
    items: KNOWN_LIMITS_CATALOG.map((item) =>
      item.semantic_id === "KL-08" ? { ...item, role_note: ROLE_NOTES[role] } : item
    ),
    mutation_capability: "NONE",
    policy_version: KNOWN_LIMITS_POLICY_VERSION,
    summary: "以下限制适用于当前内部产品表面，并保留既有权限与真值保护边界。"
  };
}
