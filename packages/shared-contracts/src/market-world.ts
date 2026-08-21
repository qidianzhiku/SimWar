export const MARKET_WORLD_SCHEMA_VERSION = "market-world.v1" as const;
export const MARKET_WORLD_STUDENT_BRIEF_SCHEMA_VERSION = "student-market-brief.v1" as const;
export const MARKET_WORLD_BINDING_RECEIPT_SCHEMA_VERSION =
  "market-world-binding-receipt.v1" as const;

export type MarketWorldReadinessStatus = "READY_WITH_LIMITS" | "STALE" | "UNKNOWN";
export type MarketWorldBindingState = "UNBOUND" | "BOUND" | "STALE" | "UNKNOWN" | "CONFLICT";
export type MarketWorldVisibilityState = "PRE_VISIBILITY" | "VISIBLE" | "STALE" | "UNKNOWN";

export interface MarketWorldRef {
  market_world_id: string;
  version: string;
  digest: string;
}

export interface MarketWorldFreshness {
  assessed_at: string;
  source_freshness: "PROJECT_ANCHOR" | "UNKNOWN";
  status: "CURRENT" | "STALE" | "UNKNOWN";
}

export interface MarketWorldReadiness {
  status: MarketWorldReadinessStatus;
  freshness: MarketWorldFreshness;
  confidence: {
    overall: "MEDIUM" | "LOW" | "UNKNOWN";
    customer_choice_frame: "LOW" | "UNKNOWN";
    geo_market: "MEDIUM" | "UNKNOWN";
  };
  uncertainty: readonly string[];
  known_limits: readonly string[];
}

export interface MarketWorldGeoMarketSummary {
  node_count: number;
  observed_provider_record_count: number;
  unit: "provider_record";
  covered_regions: readonly string[];
}

export interface MarketWorldCohortSummary {
  cohort_count: number;
  role_labels: readonly string[];
  weight_scope: "BOUNDED_SYNTHETIC_CHOICE_FRAME";
}

export interface MarketWorldProductLandscapeSummary {
  service_bundle_count: number;
  service_bundle_ids: readonly string[];
  outside_option_count: number;
  outside_option_ids: readonly string[];
}

export interface MarketWorldArchetypeSummary {
  bindable: readonly string[];
  limited: readonly Readonly<{
    type: string;
    status: "DRAFT_NON_BINDABLE";
  }>[];
}

export interface MarketWorldProductProjection {
  schema_version: typeof MARKET_WORLD_SCHEMA_VERSION;
  market_world_id: string;
  version: string;
  digest: string;
  market_world_name: string;
  readiness: MarketWorldReadiness;
  geo_market: MarketWorldGeoMarketSummary;
  cohort_summary: MarketWorldCohortSummary;
  product_landscape: MarketWorldProductLandscapeSummary;
  archetypes: MarketWorldArchetypeSummary;
  source_categories: readonly string[];
  market_structure: string;
  customer_tensions: readonly string[];
  service_landscape: readonly string[];
  outside_options: readonly string[];
  archetype_context: string;
  key_business_tensions: readonly string[];
}

export interface MarketWorldCandidateProjection {
  market_world_reference: MarketWorldRef;
  market_world_name: string;
  readiness: MarketWorldReadiness;
}

export interface MarketWorldBindingReceipt {
  schema_version: typeof MARKET_WORLD_BINDING_RECEIPT_SCHEMA_VERSION;
  operation_id: "TEACHER_MARKET_WORLD_BINDING_POST_V1";
  course_id: string;
  tenant_id: string;
  binding_state: "BOUND";
  idempotent: boolean;
  market_world_reference: MarketWorldRef;
  readiness: MarketWorldReadiness;
  known_limits: readonly string[];
}

export interface TeacherMarketWorldProjection {
  schema_version: typeof MARKET_WORLD_SCHEMA_VERSION;
  course_id: string;
  tenant_id: string;
  binding_state: MarketWorldBindingState;
  market_world_reference?: MarketWorldRef;
  available_market_worlds: readonly MarketWorldCandidateProjection[];
  market_world_name?: string;
  readiness: MarketWorldReadiness;
  geo_market: MarketWorldGeoMarketSummary;
  cohort_summary: MarketWorldCohortSummary;
  product_landscape: MarketWorldProductLandscapeSummary;
  archetypes: MarketWorldArchetypeSummary;
  source_categories: readonly string[];
  market_structure: string;
  customer_tensions: readonly string[];
  service_landscape: readonly string[];
  outside_options: readonly string[];
  archetype_context: string;
  key_business_tensions: readonly string[];
  known_limits: readonly string[];
}

export interface StudentMarketBriefProjection {
  schema_version: typeof MARKET_WORLD_STUDENT_BRIEF_SCHEMA_VERSION;
  brief_kind: "SHANGHAI_MARKET_BRIEF";
  visibility_state: "VISIBLE";
  market_world_reference: MarketWorldRef;
  market_world_name: string;
  market_structure: string;
  customer_tensions: readonly string[];
  service_landscape: readonly string[];
  outside_options: readonly string[];
  archetype_context: string;
  key_business_tensions: readonly string[];
  freshness: MarketWorldFreshness;
  known_limits: readonly string[];
}

export interface AdminMarketWorldAuditProjection {
  schema_version: typeof MARKET_WORLD_SCHEMA_VERSION;
  course_id: string;
  tenant_id: string;
  binding_state: MarketWorldBindingState;
  market_world_reference?: MarketWorldRef;
  readiness: MarketWorldReadiness;
  source_categories: readonly string[];
  limited_archetypes: readonly string[];
  known_limits: readonly string[];
}

export interface AdminMarketWorldBindingsProjection {
  schema_version: "admin-market-world-bindings.v1";
  tenant_id: string;
  courses: readonly AdminMarketWorldAuditProjection[];
}

export const MARKET_WORLD_STUDENT_FORBIDDEN_FIELDS = [
  "state_true",
  "raw_source_path",
  "raw_project_identity",
  "private_coefficient",
  "hidden_calibration",
  "full_private_manifest",
  "other_team_data",
  "unpublished_result",
  "score",
  "rank",
  "settlement_result"
] as const;

const MARKET_WORLD_ALIAS_PATTERN =
  /(?:^|[._:-])(?:latest|current|default|fallback|next|any)(?:$|[._:-])/i;

export class MarketWorldReferenceError extends Error {
  constructor(readonly code: "MARKET_WORLD_REFERENCE_INVALID") {
    super(code);
    this.name = "MarketWorldReferenceError";
  }
}

export function createMarketWorldReference(input: MarketWorldRef): MarketWorldRef {
  if (
    typeof input.market_world_id !== "string" ||
    input.market_world_id.trim().length === 0 ||
    MARKET_WORLD_ALIAS_PATTERN.test(input.market_world_id) ||
    typeof input.version !== "string" ||
    !/^\d{4}-\d{2}-\d{2}\.m\d+\.\d+$/.test(input.version) ||
    MARKET_WORLD_ALIAS_PATTERN.test(input.version) ||
    typeof input.digest !== "string" ||
    !/^[a-f0-9]{64}$/.test(input.digest)
  ) {
    throw new MarketWorldReferenceError("MARKET_WORLD_REFERENCE_INVALID");
  }

  return Object.freeze({
    digest: input.digest,
    market_world_id: input.market_world_id,
    version: input.version
  });
}
