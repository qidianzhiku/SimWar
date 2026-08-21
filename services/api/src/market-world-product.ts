import { createHash } from "node:crypto";
import type {
  AdminMarketWorldAuditProjection,
  Course,
  MarketWorldArchetypeSummary,
  MarketWorldCandidateProjection,
  MarketWorldProductProjection,
  MarketWorldRef,
  StudentMarketBriefProjection,
  TeacherMarketWorldProjection
} from "@simwar/shared-contracts";
import { createMarketWorldReference } from "@simwar/shared-contracts";

export const MARKET_WORLD_SOURCE_PACK_MANIFEST_DIGEST =
  "d4df9955198a9b3f271694f7045f181e0dc78cbe131152f814460b68f5a5510a" as const;
export const MARKET_WORLD_ROLE_SAFE_ASSET_DIGEST =
  "01797e5ddcb4f8798d309c6f495006a5a11bbbdfaa111ec21228a2750597af0f" as const;

const safeArchetypes: MarketWorldArchetypeSummary = {
  bindable: ["DEVELOPER", "MEDICAL_GROUP", "PROFESSIONAL_OPERATOR", "COMMUNITY_PLATFORM"],
  limited: [
    { status: "DRAFT_NON_BINDABLE", type: "INSURANCE_CAPITAL" },
    { status: "DRAFT_NON_BINDABLE", type: "AI_NATIVE_OPERATOR" }
  ]
};

const productPayload: Omit<MarketWorldProductProjection, "digest"> = {
  archetype_context:
    "四类经营者可作为带限制的竞争基线；保险资本与 AI 原生经营者仍是证据不足的 draft，不是已验证玩家基线。",
  archetypes: safeArchetypes,
  cohort_summary: {
    cohort_count: 7,
    role_labels: ["elder", "elder_household", "choice_frame"],
    weight_scope: "BOUNDED_SYNTHETIC_CHOICE_FRAME"
  },
  customer_tensions: [
    "自主生活与照护安全之间的取舍",
    "家庭决策者的可达性、信任与支付约束",
    "机构照护、社区服务与居家照护之间的替代选择"
  ],
  geo_market: {
    covered_regions: [
      "浦东新区",
      "黄浦区",
      "静安区",
      "徐汇区",
      "长宁区",
      "普陀区",
      "虹口区",
      "杨浦区",
      "宝山区",
      "闵行区",
      "嘉定区",
      "金山区",
      "松江区",
      "青浦区",
      "奉贤区",
      "崇明区"
    ],
    node_count: 16,
    observed_provider_record_count: 495,
    unit: "provider_record"
  },
  key_business_tensions: [
    "服务质量、照护强度与可负担性的组合设计",
    "机构床位供给与社区/居家替代方案的边界",
    "医疗联动、人员成本、家庭沟通和增长节奏的平衡",
    "项目锚点与真实市场校准之间的证据不确定性"
  ],
  market_structure:
    "上海养老服务市场以区级 provider-record 观察节点、机构照护/社区居家服务组合和四类外部替代选项构成受限的教学选择框架；它不是完整供给、价格或需求估计。",
  market_world_id: "shanghai-eldercare-market-world",
  market_world_name: "Shanghai ElderCare Market World",
  outside_options: [
    "家庭自护与家庭照护",
    "社区服务、上门服务与送餐",
    "医院照护与临时康复",
    "延迟决策或不正式购买"
  ],
  product_landscape: {
    outside_option_count: 4,
    outside_option_ids: [
      "OUT_HOME_SELF_CARE",
      "OUT_COMMUNITY_SERVICE",
      "OUT_HOSPITAL_REHAB",
      "OUT_DELAY_NO_PURCHASE"
    ],
    service_bundle_count: 7,
    service_bundle_ids: [
      "BASIC_RESIDENTIAL",
      "ASSISTED_LIVING",
      "HIGH_CARE",
      "COGNITIVE_CARE",
      "MEDICAL_REHAB",
      "COMMUNITY_AT_HOME",
      "MEMBERSHIP_RESIDENTIAL"
    ]
  },
  readiness: {
    confidence: { customer_choice_frame: "LOW", geo_market: "MEDIUM", overall: "MEDIUM" },
    freshness: {
      assessed_at: "2026-08-20T16:25:33.000Z",
      source_freshness: "PROJECT_ANCHOR",
      status: "CURRENT"
    },
    known_limits: [
      "没有上海 occupancy、pricing 或 customer sample",
      "travel/medical reference 已结构化但数值仍未绑定",
      "图像表格的 source-date completeness 有限",
      "Market World 仍是产品上下文，不进入 settlement truth"
    ],
    status: "READY_WITH_LIMITS",
    uncertainty: [
      "客户 choice frame 为 bounded synthetic prior，不是官方人口估计",
      "provider-record 节点不代表全部养老供给",
      "未启用 BLP/Huff 或任何上海特定 runtime 参数"
    ]
  },
  schema_version: "market-world.v1",
  service_landscape: [
    "基础居住、照护、膳食与基本生活服务",
    "辅助生活、高照护、认知照护与医疗康复",
    "社区站点、居家服务、送餐、家庭支持与会员使用权"
  ],
  source_categories: [
    "脱敏 provider-record GeoMarket 汇总",
    "康养服务与产品线证据",
    "bounded synthetic household choice frame",
    "cross-market archetype anchor summary",
    "M2 privacy / holdout / lineage gate"
  ],
  version: "2026-08-20.m2.1"
};

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digestForPayload(payload: Omit<MarketWorldProductProjection, "digest">): string {
  return createHash("sha256").update(canonicalize(payload), "utf8").digest("hex");
}

const productDigest = digestForPayload(productPayload);

export const MARKET_WORLD_PRODUCT_PROJECTION: MarketWorldProductProjection = Object.freeze({
  ...productPayload,
  digest: productDigest
});

export function getShanghaiMarketWorldReference(): MarketWorldRef {
  return createMarketWorldReference({
    digest: MARKET_WORLD_PRODUCT_PROJECTION.digest,
    market_world_id: MARKET_WORLD_PRODUCT_PROJECTION.market_world_id,
    version: MARKET_WORLD_PRODUCT_PROJECTION.version
  });
}

export function assertMarketWorldProductIntegrity(
  candidate: MarketWorldProductProjection = MARKET_WORLD_PRODUCT_PROJECTION
): void {
  const { digest, ...payload } = candidate;
  if (
    candidate.schema_version !== "market-world.v1" ||
    candidate.market_world_id !== productPayload.market_world_id ||
    candidate.version !== productPayload.version ||
    digest !== digestForPayload(payload)
  ) {
    throw new Error("MARKET_WORLD_PRODUCT_ASSET_CORRUPT");
  }
}

function referenceState(course: Course): "UNBOUND" | "BOUND" | "STALE" | "UNKNOWN" {
  if (!course.market_world_reference) return "UNBOUND";
  const expected = getShanghaiMarketWorldReference();
  if (
    course.market_world_reference.market_world_id === expected.market_world_id &&
    course.market_world_reference.version === expected.version &&
    course.market_world_reference.digest === expected.digest
  ) {
    return "BOUND";
  }
  if (course.market_world_reference.market_world_id === expected.market_world_id) return "STALE";
  return "UNKNOWN";
}

function candidateProjection(): MarketWorldCandidateProjection {
  return {
    market_world_name: MARKET_WORLD_PRODUCT_PROJECTION.market_world_name,
    market_world_reference: getShanghaiMarketWorldReference(),
    readiness: structuredClone(MARKET_WORLD_PRODUCT_PROJECTION.readiness)
  };
}

export function createTeacherMarketWorldProjection(input: {
  course: Course;
}): TeacherMarketWorldProjection {
  assertMarketWorldProductIntegrity();
  const state = referenceState(input.course);
  return {
    archetype_context: MARKET_WORLD_PRODUCT_PROJECTION.archetype_context,
    archetypes: structuredClone(MARKET_WORLD_PRODUCT_PROJECTION.archetypes),
    available_market_worlds: [candidateProjection()],
    binding_state: state,
    cohort_summary: structuredClone(MARKET_WORLD_PRODUCT_PROJECTION.cohort_summary),
    course_id: input.course.course_id,
    customer_tensions: [...MARKET_WORLD_PRODUCT_PROJECTION.customer_tensions],
    geo_market: structuredClone(MARKET_WORLD_PRODUCT_PROJECTION.geo_market),
    key_business_tensions: [...MARKET_WORLD_PRODUCT_PROJECTION.key_business_tensions],
    known_limits: [...MARKET_WORLD_PRODUCT_PROJECTION.readiness.known_limits],
    market_structure: MARKET_WORLD_PRODUCT_PROJECTION.market_structure,
    ...(input.course.market_world_reference
      ? { market_world_reference: structuredClone(input.course.market_world_reference) }
      : {}),
    ...(state === "BOUND" ? { market_world_name: MARKET_WORLD_PRODUCT_PROJECTION.market_world_name } : {}),
    outside_options: [...MARKET_WORLD_PRODUCT_PROJECTION.outside_options],
    product_landscape: structuredClone(MARKET_WORLD_PRODUCT_PROJECTION.product_landscape),
    readiness: structuredClone(MARKET_WORLD_PRODUCT_PROJECTION.readiness),
    schema_version: "market-world.v1",
    service_landscape: [...MARKET_WORLD_PRODUCT_PROJECTION.service_landscape],
    source_categories: [...MARKET_WORLD_PRODUCT_PROJECTION.source_categories],
    tenant_id: input.course.tenant_id
  };
}

export function createStudentMarketWorldBriefProjection(input: {
  course: Course;
}): StudentMarketBriefProjection | null {
  if (
    (input.course.status !== "published" && input.course.status !== "active") ||
    referenceState(input.course) !== "BOUND"
  ) {
    return null;
  }
  const reference = getShanghaiMarketWorldReference();
  return {
    archetype_context: MARKET_WORLD_PRODUCT_PROJECTION.archetype_context,
    brief_kind: "SHANGHAI_MARKET_BRIEF",
    customer_tensions: [...MARKET_WORLD_PRODUCT_PROJECTION.customer_tensions],
    freshness: structuredClone(MARKET_WORLD_PRODUCT_PROJECTION.readiness.freshness),
    key_business_tensions: [...MARKET_WORLD_PRODUCT_PROJECTION.key_business_tensions],
    known_limits: [...MARKET_WORLD_PRODUCT_PROJECTION.readiness.known_limits],
    market_structure: MARKET_WORLD_PRODUCT_PROJECTION.market_structure,
    market_world_name: MARKET_WORLD_PRODUCT_PROJECTION.market_world_name,
    market_world_reference: reference,
    outside_options: [...MARKET_WORLD_PRODUCT_PROJECTION.outside_options],
    schema_version: "student-market-brief.v1",
    service_landscape: [...MARKET_WORLD_PRODUCT_PROJECTION.service_landscape],
    visibility_state: "VISIBLE"
  };
}

export function createAdminMarketWorldAuditProjection(input: {
  course: Course;
}): AdminMarketWorldAuditProjection {
  const teacher = createTeacherMarketWorldProjection(input);
  return {
    binding_state: teacher.binding_state,
    course_id: teacher.course_id,
    known_limits: teacher.known_limits,
    limited_archetypes: teacher.archetypes.limited.map((archetype) => archetype.type),
    ...(teacher.market_world_reference
      ? { market_world_reference: teacher.market_world_reference }
      : {}),
    readiness: teacher.readiness,
    schema_version: "market-world.v1",
    source_categories: teacher.source_categories,
    tenant_id: teacher.tenant_id
  };
}

export function marketWorldReferenceState(course: Course):
  | "UNBOUND"
  | "BOUND"
  | "STALE"
  | "UNKNOWN" {
  return referenceState(course);
}
