export const OPERATING_WORLD_SCHEMA_VERSION = "simwar.sh-m3-operating-world.v1" as const;
export const OPERATING_WORLD_MISSION_ID =
  "SIMWAR-SH-M3-W5-OPERATING-WORLD-MACRO-R2-20260823" as const;

export type OperatingWorldFamily = "SH-16" | "SH-17" | "SH-18" | "SH-19";
export type OperatingWorldDraftStatus = "DRAFT" | "VALIDATED" | "FROZEN" | "BOUND";
export type OperatingWorldPreviewVariant = "LOW" | "BASE" | "HIGH";
export type OperatingWorldEffectClass =
  | "OFFICIAL_CONSUMER_ELIGIBLE"
  | "SHADOW_ONLY"
  | "INFORMATION_ONLY"
  | "BLOCKED";
export type OperatingWorldSourceCategory =
  | "LOCAL_DATA"
  | "OFFICIAL_PRIMARY"
  | "SYNTHETIC"
  | "ASSUMPTION"
  | "TEACHER_INPUT";
export type OperatingWorldFreshness = "CURRENT" | "STALE" | "UNKNOWN";
export type OperatingWorldConfidence = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export interface OperatingWorldInfo {
  confidence: OperatingWorldConfidence;
  demand_signal: number;
  freshness: OperatingWorldFreshness;
  known_limits: readonly string[];
  source_category: OperatingWorldSourceCategory;
  source_ref: string;
}

export interface OperatingWorldSH16 {
  info: OperatingWorldInfo;
  quality_target: number;
  recovery_lag: number;
  recruitment_pressure: number;
  service_capacity: number;
  staffing_floor: number;
  turnover_pressure: number;
  wage_pressure: number;
  workforce_supply: number;
}

export interface OperatingWorldSH17 {
  approved_capacity_max: number;
  approved_capacity_min: number;
  capital_cost: number;
  construction_cost: number;
  construction_cycle: number;
  covenant_tightness: number;
  credit_availability: number;
  financing_availability: number;
  info: OperatingWorldInfo;
}

export interface OperatingWorldSH18 {
  economic_cycle: string;
  effective_time: string;
  info: OperatingWorldInfo;
  policy_pack_ref: string;
  priority: "low" | "normal" | "high";
  shock_ref: string;
  visibility: "STUDENT_SAFE" | "TEACHER_ONLY";
}

export interface OperatingWorldSH19 {
  info: OperatingWorldInfo;
  market_node_ref: string;
  portfolio_constraints: readonly string[];
  project_option_compatibility: readonly string[];
  project_slot_ref: string;
}

export interface OperatingWorldFamilies {
  "SH-16": OperatingWorldSH16;
  "SH-17": OperatingWorldSH17;
  "SH-18": OperatingWorldSH18;
  "SH-19": OperatingWorldSH19;
}

/**
 * Explicit demo-only seed input for the Teacher Studio. Callers must send the
 * returned families in the create request; the API never silently supplies it.
 */
export function createDefaultOperatingWorldFamilies(): OperatingWorldFamilies {
  const baseInfo = (source_category: OperatingWorldSourceCategory): OperatingWorldInfo => ({
    confidence: source_category === "SYNTHETIC" ? "HIGH" : "MEDIUM",
    demand_signal: 0.6,
    freshness: "CURRENT",
    known_limits: ["默认教学场景，需要教师在真实项目中校准"],
    source_category,
    source_ref: `scenario://shanghai/${source_category.toLowerCase()}`
  });
  return {
    "SH-16": {
      info: baseInfo("SYNTHETIC"),
      quality_target: 0.9,
      recovery_lag: 2,
      recruitment_pressure: 0.2,
      service_capacity: 100,
      staffing_floor: 80,
      turnover_pressure: 0.12,
      wage_pressure: 0.08,
      workforce_supply: 120
    },
    "SH-17": {
      approved_capacity_max: 240,
      approved_capacity_min: 60,
      capital_cost: 0.055,
      construction_cost: 120000,
      construction_cycle: 3,
      covenant_tightness: 0.3,
      credit_availability: 0.7,
      financing_availability: 0.68,
      info: baseInfo("SYNTHETIC")
    },
    "SH-18": {
      economic_cycle: "slow-growth",
      effective_time: "2026-Q3",
      info: baseInfo("TEACHER_INPUT"),
      policy_pack_ref: "sh-policy-default-v1",
      priority: "normal",
      shock_ref: "none",
      visibility: "STUDENT_SAFE"
    },
    "SH-19": {
      info: baseInfo("ASSUMPTION"),
      market_node_ref: "shanghai-core-node",
      portfolio_constraints: ["single-campus-cap"],
      project_option_compatibility: ["community-care-v2"],
      project_slot_ref: "shanghai-project-slot-01"
    }
  };
}

export interface OperatingWorldExactBinding {
  binding_digest: string;
  binding_id: string;
  course_id: string;
  model_version_ref: string;
  no_implicit_latest: true;
  parameter_set_reference: {
    content_digest: string;
    parameter_set_id: string;
    version: string;
  };
  round_no: number;
  run_id: string;
  scenario_package_reference: {
    content_digest: string;
    scenario_package_id: string;
    tenant_id: string;
    version: string;
  };
  seed: number;
  status: "BOUND";
  tenant_id: string;
}

export interface OperatingWorldDraft {
  created_by: string;
  draft_id: string;
  families: OperatingWorldFamilies;
  model_version_ref: string;
  seed: number;
  status: OperatingWorldDraftStatus;
  tenant_id: string;
  title: string;
  course_id: string;
  updated_at: string;
  binding: OperatingWorldExactBinding | null;
}

export interface OperatingWorldPreviewReceipt {
  consumer_ref: "W4_CAPITAL_ACTION_OR_NEW_PROJECT_ADMISSION";
  diagnostics: readonly string[];
  effect_class: OperatingWorldEffectClass;
  input_digest: string;
  known_limits: readonly string[];
  no_official_write: true;
  parameter_delta: Readonly<Record<string, number>>;
  predicted_outputs: Readonly<Record<string, number>>;
  preview_digest: string;
  preview_id: string;
  scenario_variant: OperatingWorldPreviewVariant;
  seed: number;
  uncertainty: Readonly<Record<string, number>>;
}

export interface OperatingWorldOfficialConsumerInput {
  capital_cost: number;
  construction_cost: number;
  construction_cycle: number;
  credit_availability: number;
  effect_class: "OFFICIAL_CONSUMER_ELIGIBLE";
  source_binding_digest: string;
  consumer_ref: "W4_CAPITAL_ACTION_OR_NEW_PROJECT_ADMISSION";
}

export interface OperatingWorldTeacherProjection {
  drafts: readonly OperatingWorldDraft[];
  known_limits: readonly string[];
  mission_id: typeof OPERATING_WORLD_MISSION_ID;
  operation_id: "SH_M3_TEACHER_OPERATING_WORLD_STUDIO_GET_V1";
}

export interface OperatingWorldStudentBrief {
  construction_cost_range: readonly [number, number];
  construction_cycle_range: readonly [number, number];
  demand_outlook: number;
  financing_environment: number;
  known_limits: readonly string[];
  service_capacity: number;
  visible_policy: string;
  wage_pressure: number;
  workforce_supply: number;
}

export interface OperatingWorldStudentProjection {
  brief: OperatingWorldStudentBrief;
  binding_digest: string;
  mission_id: typeof OPERATING_WORLD_MISSION_ID;
  operation_id: "SH_M3_STUDENT_OPERATING_WORLD_BRIEF_GET_V1";
  visibility: "ROLE_SAFE_STUDENT";
}

export interface OperatingWorldAdminAudit {
  binding: OperatingWorldExactBinding | null;
  draft_id: string;
  effect_class: OperatingWorldEffectClass;
  freshness: Readonly<Record<OperatingWorldFamily, OperatingWorldFreshness>>;
  known_limits: readonly string[];
  readiness: OperatingWorldDraftStatus;
  stale_or_conflict: boolean;
}
