import { createHash } from "node:crypto";
import type { ParameterSet, ScenarioPackage, SettlementResult } from "@simwar/shared-contracts";
import {
  compileBeijingYanjiaoEldercareScenarioAsset,
  type EldercareScenarioAsset,
  type EldercareScenarioRound
} from "./eldercare-scenario-compiler.js";

export const R7B_SCENARIO_LIFECYCLE_COMPILER_VERSION = "r7b.eldercare.lifecycle-compiler.v1";
export const R7B_SCENARIO_TEMPLATE_VERSION = "r7b.beijing-yanjiao.mother-scenario.v1";
export const R7B_SCENARIO_SEED = 7070714;

export type R7BScenarioLifecycleStatus =
  | "DRAFT"
  | "COMPILED"
  | "VALIDATED"
  | "APPROVED"
  | "FROZEN"
  | "BOUND_TO_RUN"
  | "ARCHIVED"
  | "REJECTED";

export type R7BScenarioActorRole =
  | "teacher"
  | "student"
  | "tenant_admin"
  | "platform_admin"
  | "system";

export interface R7BScenarioActor {
  actor_id: string;
  role: R7BScenarioActorRole;
  tenant_id: string;
  course_id?: string;
  team_id?: string;
  platform_authority?: boolean;
}

export interface R7BScenarioDraftOptions {
  actor: R7BScenarioActor;
}

export interface R7BScenarioPolicyRule {
  rule_id: string;
  round_no: number;
  policy_area:
    | "market_entry"
    | "capacity"
    | "payer_policy"
    | "regional_migration"
    | "competition"
    | "public_health";
  evidence_label: "SOURCE_ONLY_INFERENCE";
  synthetic_assumption: string;
  allowed_student_summary: string;
  private_assumption_ref: string;
}

export interface R7BSegmentMigrationRule {
  rule_id: string;
  round_no: number;
  migration_axis:
    | "region"
    | "care_level"
    | "payer_mix"
    | "visit_friction"
    | "labor_pressure"
    | "risk_sensitivity";
  evidence_label: "SOURCE_ONLY_INFERENCE";
  deterministic_delta: number;
}

export interface R7BQualificationRule {
  rule_id: string;
  round_no: number;
  offer_id: "community_daycare" | "assisted_living" | "medical_rehab";
  required_license: "community_daycare_only" | "eldercare_service" | "eldercare_medical";
  minimum_staff_count: number;
  controlled_failure_code:
    | "R7B_MEDICAL_REHAB_LICENSE_SCOPE_DENIED"
    | "R7B_STAFFING_CAPACITY_GUARDRAIL_TRIGGERED"
    | "R7B_POLICY_ELIGIBILITY_DENIED";
}

export interface R7BShockEvent {
  shock_id: string;
  round_no: number;
  shock_type:
    | "policy_change"
    | "migration_change"
    | "competition"
    | "labor_cost"
    | "finance_cost"
    | "public_health";
  severity: "low" | "medium" | "high";
  approved: true;
  affected_plugin_hooks: string[];
  student_observation: string;
  private_detail_ref: string;
}

export interface R7BScenarioTrace {
  trace_id: string;
  evidence_label: "SOURCE_ONLY_INFERENCE" | "CONTRACT_BACKED_EVIDENCE";
  input_ref: string;
  output_ref: string;
  actor_visibility: Array<"teacher" | "tenant_admin" | "student">;
}

export interface R7BScenarioVisibilityPlan {
  teacher: {
    can_read_draft: true;
    can_read_diff: true;
    can_read_private_trace: true;
  };
  student: {
    can_read_draft: false;
    can_read_private_parameter: false;
    can_read_private_trace: false;
    can_read_private_replay: false;
    allowed_surface: "state_obs_state_est_only";
  };
  tenant_admin: {
    can_read_tenant_status: true;
    can_read_other_tenant: false;
    can_read_private_trace: false;
  };
}

export interface R7BScenarioRound extends EldercareScenarioRound {
  round_objective: string;
  known_information: string[];
  hidden_truth_boundary: "SOURCE_ONLY_INFERENCE_ONLY";
  approved_shock_id: string;
  policy_rule_id: string;
  migration_rule_id: string;
  qualification_rule_id: string;
  capacity_and_staffing_constraint: string;
  expected_finance_impact: string;
  expected_score_impact: string;
  teacher_evidence: string[];
  student_observation_boundary: string[];
  tenant_admin_observation_boundary: string[];
  replay_expectation: "SHADOW_REPLAY_NON_OVERWRITE";
  controlled_failure_candidate: string;
  cleanup_and_retention_limitation: string;
}

export interface R7BScenarioLifecycleAsset {
  asset_id: "r7b-beijing-yanjiao-eldercare-scenario-lifecycle-v1";
  asset_hash: string;
  source_r7a_asset_hash: string;
  compiler_version: typeof R7B_SCENARIO_LIFECYCLE_COMPILER_VERSION;
  template_version: typeof R7B_SCENARIO_TEMPLATE_VERSION;
  seed: typeof R7B_SCENARIO_SEED;
  scenario_package: ScenarioPackage;
  parameter_set: ParameterSet;
  rounds: R7BScenarioRound[];
  policy_rules: R7BScenarioPolicyRule[];
  segment_migration_rules: R7BSegmentMigrationRule[];
  qualification_rules: R7BQualificationRule[];
  shock_timeline: R7BShockEvent[];
  visibility_plan: R7BScenarioVisibilityPlan;
  scenario_trace: R7BScenarioTrace[];
  plugin_trace_refs: string[];
  synthetic_data_classification: [
    "SYNTHETIC_TEACHING_SCENARIO",
    "UN_CALIBRATED",
    "NOT_FOR_REAL_OPERATING_DECISION",
    "NOT_FOR_PUBLIC_POLICY_DECISION",
    "NOT_FOR_INVESTMENT_DECISION"
  ];
  status_boundary: EldercareScenarioAsset["status_boundary"];
  direct_store_delta: "NONE";
  formal_truth_write: false;
  postgresql_runtime_required: false;
  replay_writes_formal_results: false;
}

export interface R7BScenarioAuditTrace {
  event:
    | "DRAFT_CREATED"
    | "COMPILED"
    | "VALIDATED"
    | "APPROVED"
    | "FROZEN"
    | "BOUND_TO_RUN"
    | "MUTATION_REJECTED";
  actor_id: string;
  actor_role: R7BScenarioActorRole;
  evidence_label: "SOURCE_ONLY_INFERENCE" | "CONTRACT_BACKED_EVIDENCE";
}

export interface R7BScenarioRunBinding {
  run_id: string;
  tenant_id: string;
  course_id: string;
  scenario_package_id: string;
  scenario_package_version: string;
  parameter_set_id: string;
  parameter_set_version: string;
  plugin_package_ids: string[];
  compiler_version: string;
  input_hash: string;
  output_hash: string;
  seed: number;
  shock_timeline_hash: string;
  visibility_plan_hash: string;
  mutation_allowed: false;
}

export interface R7BScenarioLifecycleRecord {
  lifecycle_id: string;
  tenant_id: string;
  course_id: string;
  scenario_version: string;
  status: R7BScenarioLifecycleStatus;
  compiler_version: typeof R7B_SCENARIO_LIFECYCLE_COMPILER_VERSION;
  template_version: typeof R7B_SCENARIO_TEMPLATE_VERSION;
  plugin_version: "plugin_wellness_eldercare_v1@1.0.0";
  seed: typeof R7B_SCENARIO_SEED;
  input_hash: string;
  output_hash: string;
  asset: R7BScenarioLifecycleAsset;
  validation_report: R7BScenarioValidationResult;
  audit_trace: R7BScenarioAuditTrace[];
  approved_by?: string;
  frozen_asset_hash?: string;
  run_binding?: R7BScenarioRunBinding;
}

export interface R7BScenarioValidationResult {
  status: "passed" | "failed";
  errors: string[];
  direct_store_delta: "NONE";
  evidence_label: "CONTRACT_BACKED_EVIDENCE";
}

export interface R7BScenarioMutationAttempt {
  actor: R7BScenarioActor;
  field_path: string;
  requested_value: unknown;
}

export interface R7BScenarioMutationRejection {
  accepted: false;
  code: "R7B_BOUND_SCENARIO_IMMUTABLE";
  field_path: string;
  requires_new_scenario_version: true;
  direct_store_delta: "NONE";
}

export interface R7BScenarioDiffEntry {
  category: "scenario" | "parameter" | "plugin" | "shock";
  field_path: string;
  old_value_classification: "PUBLIC_METADATA" | "PRIVATE_ASSUMPTION" | "PRIVATE_PARAMETER";
  new_value_classification: "PUBLIC_METADATA" | "PRIVATE_ASSUMPTION" | "PRIVATE_PARAMETER";
  sensitive_field_redaction: true;
  actor_visibility: Array<"teacher" | "tenant_admin">;
  tenant_id: string;
  course_id: string;
  scenario_version_scope: string;
  mutation_allowed: false;
  recompile_required: boolean;
  requires_new_scenario_version: boolean;
}

export interface R7BScenarioDiff {
  diff_id: string;
  entries: R7BScenarioDiffEntry[];
  evidence_label: "CONTRACT_BACKED_EVIDENCE";
}

export interface R7BPolicyQualificationRequest {
  round_no: number;
  offer_id: "community_daycare" | "assisted_living" | "medical_rehab";
  license_scope: "community_daycare_only" | "eldercare_service" | "eldercare_medical";
  staff_count: number;
}

export interface R7BPolicyQualificationResult {
  policy_result: "allowed" | "denied";
  controlled_failures: string[];
  policy_rule: R7BScenarioPolicyRule;
  segment_migration_rule: R7BSegmentMigrationRule;
  qualification_rule: R7BQualificationRule;
  shock: R7BShockEvent;
  direct_store_delta: "NONE";
}

export type R7BProjection =
  | {
      visibility: "teacher_authorized_evidence";
      status: R7BScenarioLifecycleStatus;
      scenario_diff: R7BScenarioDiff;
      validation_report: R7BScenarioValidationResult;
      run_binding_status: R7BScenarioLifecycleStatus;
    }
  | {
      visibility: "student_redacted_state_obs";
      status: R7BScenarioLifecycleStatus;
      rounds: Array<{
        round_no: number;
        title: string;
        student_observation_boundary: string[];
      }>;
    }
  | {
      visibility: "tenant_admin_status_summary";
      status: R7BScenarioLifecycleStatus;
      tenant_id: string;
      approved_version: string;
      run_binding_status: R7BScenarioLifecycleStatus;
    }
  | {
      visibility: "platform_admin_explicit_authority";
      status: R7BScenarioLifecycleStatus;
      tenant_id: string;
      scenario_version: string;
    };

export interface R7BShadowReplayEvidence {
  replay_mode: "shadow_replay";
  replay_writes_formal_results: false;
  official_result_non_overwrite: true;
  source_result_id: string;
  bound_scenario_version: string;
  shadow_replay_evidence_hash: string;
  public_view: {
    replay_mode: "shadow_replay";
    replay_writes_formal_results: false;
    status: "candidate_evidence_only";
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function assertSameTenantAndCourse(record: R7BScenarioLifecycleRecord, actor: R7BScenarioActor) {
  if (
    record.tenant_id !== actor.tenant_id ||
    (actor.course_id && record.course_id !== actor.course_id)
  ) {
    throw new Error("R7B_SCENARIO_TENANT_SCOPE_DENIED");
  }
}

function assertTeacherActor(record: R7BScenarioLifecycleRecord, actor: R7BScenarioActor) {
  assertSameTenantAndCourse(record, actor);
  if (actor.role !== "teacher" && actor.role !== "system") {
    throw new Error("R7B_SCENARIO_APPROVAL_DENIED");
  }
}

function makeR7BRounds(sourceRounds: EldercareScenarioRound[]): R7BScenarioRound[] {
  const objectives = [
    "Market entry, positioning, and care offer selection.",
    "Price, service quality, bed capacity, staffing, and operations configuration.",
    "Long-term care insurance, medical-payment bridge, subsidy, and payer-policy change.",
    "Transportation access, visitation convenience, regional migration, and channel friction change.",
    "Competitive entry, labor cost pressure, financing cost pressure, and operating stress.",
    "Public health, regulation, service quality crisis, incident risk, and replay review."
  ];
  const shockIds = [
    "shock_round_1_market_entry_signal",
    "shock_round_2_staffing_capacity_signal",
    "shock_round_3_payer_policy_change",
    "shock_round_4_regional_migration_friction",
    "shock_round_5_competition_labor_finance_pressure",
    "shock_round_6_public_health_quality_event"
  ];

  return sourceRounds.map((round, index) => ({
    ...round,
    approved_shock_id: shockIds[index] ?? "shock_round_1_market_entry_signal",
    capacity_and_staffing_constraint:
      "beds, day-care slots, staff count, and nurse ratio clamp served demand",
    cleanup_and_retention_limitation:
      "synthetic test cleanup only; no backup, restore, Pilot, or Production retention proof",
    controlled_failure_candidate:
      index === 5
        ? "medical rehabilitation license or staffing shortage denial"
        : "tenant, role, parameter, or shock boundary denial",
    expected_finance_impact: "classroom-only finance signal, not an operating forecast",
    expected_score_impact: "teaching score signal only, not production ranking proof",
    hidden_truth_boundary: "SOURCE_ONLY_INFERENCE_ONLY",
    known_information: [
      "synthetic tenant",
      "synthetic course",
      "two synthetic teams",
      "teacher-selected scenario draft"
    ],
    migration_rule_id: `migration_round_${round.round_no}_${
      [
        "market_entry",
        "capacity",
        "payer_policy",
        "regional_friction",
        "competition_pressure",
        "public_health_risk"
      ][index] ?? "market_entry"
    }`,
    policy_rule_id: `policy_round_${round.round_no}`,
    qualification_rule_id: `qualification_round_${round.round_no}`,
    replay_expectation: "SHADOW_REPLAY_NON_OVERWRITE",
    round_objective: objectives[index] ?? "Market entry, positioning, and care offer selection.",
    student_observation_boundary: ["state_obs", "state_est", "public round objective"],
    teacher_evidence: [
      "scenario diff",
      "parameter diff",
      "plugin diff",
      "shock diff",
      "validation report"
    ],
    tenant_admin_observation_boundary: [
      "tenant scenario status",
      "approved version",
      "run binding status"
    ]
  }));
}

function makePolicyRules(): R7BScenarioPolicyRule[] {
  return [
    ["market_entry", "community and family channel positioning"],
    ["capacity", "licensed capacity and staffing plan"],
    ["payer_policy", "public subsidy and commercial insurance classroom signal"],
    ["regional_migration", "transport convenience and visitation friction"],
    ["competition", "competitive entry and labor pressure"],
    ["public_health", "quality crisis and public health compliance"]
  ].map(([area, assumption], index) => ({
    allowed_student_summary: `Round ${index + 1} public policy signal`,
    evidence_label: "SOURCE_ONLY_INFERENCE",
    policy_area: area as R7BScenarioPolicyRule["policy_area"],
    private_assumption_ref: `r7b.private.policy.assumption.${index + 1}`,
    round_no: index + 1,
    rule_id: `policy_round_${index + 1}`,
    synthetic_assumption: assumption ?? "synthetic teaching assumption"
  }));
}

function makeMigrationRules(): R7BSegmentMigrationRule[] {
  const axes: R7BSegmentMigrationRule["migration_axis"][] = [
    "region",
    "care_level",
    "payer_mix",
    "visit_friction",
    "labor_pressure",
    "risk_sensitivity"
  ];

  return axes.map((axis, index) => ({
    deterministic_delta: Math.round((index + 1) * 3.5 * 100) / 100,
    evidence_label: "SOURCE_ONLY_INFERENCE",
    migration_axis: axis,
    round_no: index + 1,
    rule_id:
      index === 5 ? "migration_round_6_public_health_risk" : `migration_round_${index + 1}_${axis}`
  }));
}

function makeQualificationRules(): R7BQualificationRule[] {
  const rules: Array<
    Pick<R7BQualificationRule, "offer_id" | "required_license" | "minimum_staff_count">
  > = [
    {
      minimum_staff_count: 24,
      offer_id: "community_daycare",
      required_license: "community_daycare_only"
    },
    { minimum_staff_count: 42, offer_id: "assisted_living", required_license: "eldercare_service" },
    { minimum_staff_count: 48, offer_id: "medical_rehab", required_license: "eldercare_medical" },
    { minimum_staff_count: 50, offer_id: "assisted_living", required_license: "eldercare_service" },
    { minimum_staff_count: 56, offer_id: "assisted_living", required_license: "eldercare_service" },
    { minimum_staff_count: 64, offer_id: "medical_rehab", required_license: "eldercare_medical" }
  ];

  return rules.map((rule, index) => ({
    ...rule,
    controlled_failure_code:
      rule.offer_id === "medical_rehab"
        ? "R7B_MEDICAL_REHAB_LICENSE_SCOPE_DENIED"
        : "R7B_POLICY_ELIGIBILITY_DENIED",
    round_no: index + 1,
    rule_id: `qualification_round_${index + 1}`
  }));
}

function makeShockTimeline(): R7BShockEvent[] {
  const shocks: Array<Pick<R7BShockEvent, "shock_id" | "shock_type" | "severity">> = [
    { severity: "low", shock_id: "shock_round_1_market_entry_signal", shock_type: "policy_change" },
    {
      severity: "medium",
      shock_id: "shock_round_2_staffing_capacity_signal",
      shock_type: "labor_cost"
    },
    {
      severity: "medium",
      shock_id: "shock_round_3_payer_policy_change",
      shock_type: "policy_change"
    },
    {
      severity: "medium",
      shock_id: "shock_round_4_regional_migration_friction",
      shock_type: "migration_change"
    },
    {
      severity: "medium",
      shock_id: "shock_round_5_competition_labor_finance_pressure",
      shock_type: "competition"
    },
    {
      severity: "high",
      shock_id: "shock_round_6_public_health_quality_event",
      shock_type: "public_health"
    }
  ];

  return shocks.map((shock, index) => ({
    ...shock,
    affected_plugin_hooks: ["segmentDemand", "capacityGuardrail", "payerMix", "serviceQualityRisk"],
    approved: true,
    private_detail_ref: `r7b.private.shock.detail.${index + 1}`,
    round_no: index + 1,
    student_observation: `Round ${index + 1} approved public shock signal`
  }));
}

function makeVisibilityPlan(): R7BScenarioVisibilityPlan {
  return {
    student: {
      allowed_surface: "state_obs_state_est_only",
      can_read_draft: false,
      can_read_private_parameter: false,
      can_read_private_replay: false,
      can_read_private_trace: false
    },
    teacher: {
      can_read_diff: true,
      can_read_draft: true,
      can_read_private_trace: true
    },
    tenant_admin: {
      can_read_other_tenant: false,
      can_read_private_trace: false,
      can_read_tenant_status: true
    }
  };
}

function makeScenarioTrace(asset: EldercareScenarioAsset): R7BScenarioTrace[] {
  return [
    {
      actor_visibility: ["teacher", "tenant_admin"],
      evidence_label: "CONTRACT_BACKED_EVIDENCE",
      input_ref: asset.asset_hash,
      output_ref: "r7b.lifecycle.asset_hash",
      trace_id: "r7b.trace.compiler.input-output"
    },
    {
      actor_visibility: ["teacher"],
      evidence_label: "SOURCE_ONLY_INFERENCE",
      input_ref: "r7b.policy+migration+qualification+shock",
      output_ref: "r7b.validation.report",
      trace_id: "r7b.trace.lifecycle.validation"
    }
  ];
}

function makeAsset(): R7BScenarioLifecycleAsset {
  const r7aAsset = compileBeijingYanjiaoEldercareScenarioAsset();
  const assetWithoutHash = {
    asset_id: "r7b-beijing-yanjiao-eldercare-scenario-lifecycle-v1" as const,
    compiler_version:
      R7B_SCENARIO_LIFECYCLE_COMPILER_VERSION as typeof R7B_SCENARIO_LIFECYCLE_COMPILER_VERSION,
    direct_store_delta: "NONE" as const,
    formal_truth_write: false as const,
    parameter_set: {
      ...r7aAsset.parameter_set,
      parameter_set_id: "parameter_r7b_eldercare_lifecycle_v1",
      seed: R7B_SCENARIO_SEED,
      tenant_id: "tenant_r7b_synthetic",
      version: "r7b.eldercare.parameters.v1"
    },
    plugin_trace_refs: [
      "eldercare.segment-demand.v1",
      "eldercare.capacity-guardrail.v1",
      "eldercare.payer-mix-resilience.v1",
      "eldercare.service-quality-risk.v1"
    ],
    policy_rules: makePolicyRules(),
    postgresql_runtime_required: false as const,
    qualification_rules: makeQualificationRules(),
    replay_writes_formal_results: false as const,
    rounds: makeR7BRounds(r7aAsset.rounds),
    scenario_package: {
      ...r7aAsset.scenario_package,
      name: "R7-B Beijing-Yanjiao Eldercare Scenario Lifecycle Asset",
      scenario_package_id: "scenario_r7b_beijing_yanjiao_eldercare_lifecycle_v1",
      tenant_id: "tenant_r7b_synthetic",
      version: "1.0.0"
    },
    scenario_trace: makeScenarioTrace(r7aAsset),
    seed: R7B_SCENARIO_SEED as typeof R7B_SCENARIO_SEED,
    segment_migration_rules: makeMigrationRules(),
    shock_timeline: makeShockTimeline(),
    source_r7a_asset_hash: r7aAsset.asset_hash,
    status_boundary: r7aAsset.status_boundary,
    synthetic_data_classification: [
      "SYNTHETIC_TEACHING_SCENARIO",
      "UN_CALIBRATED",
      "NOT_FOR_REAL_OPERATING_DECISION",
      "NOT_FOR_PUBLIC_POLICY_DECISION",
      "NOT_FOR_INVESTMENT_DECISION"
    ] as R7BScenarioLifecycleAsset["synthetic_data_classification"],
    template_version: R7B_SCENARIO_TEMPLATE_VERSION as typeof R7B_SCENARIO_TEMPLATE_VERSION,
    visibility_plan: makeVisibilityPlan()
  };

  return {
    ...assetWithoutHash,
    asset_hash: sha256(assetWithoutHash)
  };
}

function makeRecord(
  status: R7BScenarioLifecycleStatus,
  actor: R7BScenarioActor
): R7BScenarioLifecycleRecord {
  const asset = makeAsset();
  const input = {
    actor_role: actor.role,
    compiler_version: R7B_SCENARIO_LIFECYCLE_COMPILER_VERSION,
    seed: R7B_SCENARIO_SEED,
    template_version: R7B_SCENARIO_TEMPLATE_VERSION
  };
  const inputHash = sha256(input);
  const outputHash = sha256(asset);

  return {
    asset,
    audit_trace: [
      {
        actor_id: actor.actor_id,
        actor_role: actor.role,
        event: status === "DRAFT" ? "DRAFT_CREATED" : "COMPILED",
        evidence_label: "CONTRACT_BACKED_EVIDENCE"
      }
    ],
    compiler_version: R7B_SCENARIO_LIFECYCLE_COMPILER_VERSION,
    course_id: actor.course_id ?? "course_r7b_synthetic",
    input_hash: inputHash,
    lifecycle_id: "lifecycle_r7b_beijing_yanjiao_eldercare_v1",
    output_hash: outputHash,
    plugin_version: "plugin_wellness_eldercare_v1@1.0.0",
    scenario_version: asset.scenario_package.version,
    seed: R7B_SCENARIO_SEED,
    status,
    template_version: R7B_SCENARIO_TEMPLATE_VERSION,
    tenant_id: actor.tenant_id,
    validation_report: {
      direct_store_delta: "NONE",
      errors: [],
      evidence_label: "CONTRACT_BACKED_EVIDENCE",
      status: "passed"
    }
  };
}

function withTrace(
  record: R7BScenarioLifecycleRecord,
  status: R7BScenarioLifecycleStatus,
  actor: R7BScenarioActor,
  event: R7BScenarioAuditTrace["event"]
): R7BScenarioLifecycleRecord {
  return {
    ...record,
    audit_trace: [
      ...record.audit_trace,
      {
        actor_id: actor.actor_id,
        actor_role: actor.role,
        event,
        evidence_label: "CONTRACT_BACKED_EVIDENCE"
      }
    ],
    status
  };
}

export function createR7BScenarioDraft(
  options: R7BScenarioDraftOptions
): R7BScenarioLifecycleRecord {
  if (options.actor.role !== "teacher" && options.actor.role !== "system") {
    throw new Error("R7B_SCENARIO_DRAFT_ACTOR_DENIED");
  }

  return makeRecord("DRAFT", options.actor);
}

export function compileR7BScenarioDraft(
  draft: R7BScenarioLifecycleRecord
): R7BScenarioLifecycleRecord {
  if (draft.status !== "DRAFT") {
    throw new Error("R7B_SCENARIO_INVALID_COMPILE_TRANSITION");
  }

  return withTrace(
    draft,
    "COMPILED",
    {
      actor_id: "r7b_compiler",
      role: "system",
      tenant_id: draft.tenant_id,
      course_id: draft.course_id
    },
    "COMPILED"
  );
}

export function validateR7BScenarioLifecycleRecord(
  record: R7BScenarioLifecycleRecord
): R7BScenarioValidationResult {
  const errors: string[] = [];

  if (record.asset.rounds.length !== 6) {
    errors.push("expected_six_round_scenario");
  }
  if (record.asset.policy_rules.length !== 6) {
    errors.push("expected_six_round_policy_rules");
  }
  if (record.asset.segment_migration_rules.length !== 6) {
    errors.push("expected_six_round_migration_rules");
  }
  if (record.asset.qualification_rules.length !== 6) {
    errors.push("expected_six_round_qualification_rules");
  }
  if (record.asset.shock_timeline.length !== 6) {
    errors.push("expected_six_round_shock_timeline");
  }
  if (record.asset.synthetic_data_classification.length !== 5) {
    errors.push("synthetic_classification_incomplete");
  }
  if (record.asset.direct_store_delta !== "NONE") {
    errors.push("direct_store_delta_must_be_none");
  }
  if (record.asset.formal_truth_write) {
    errors.push("formal_truth_write_not_allowed");
  }
  if (record.asset.replay_writes_formal_results) {
    errors.push("replay_must_not_write_formal_results");
  }
  if (record.asset.postgresql_runtime_required) {
    errors.push("postgresql_runtime_not_authorized");
  }

  return {
    direct_store_delta: "NONE",
    errors,
    evidence_label: "CONTRACT_BACKED_EVIDENCE",
    status: errors.length === 0 ? "passed" : "failed"
  };
}

export function approveR7BScenarioDraft(
  record: R7BScenarioLifecycleRecord,
  options: R7BScenarioDraftOptions
): R7BScenarioLifecycleRecord {
  assertTeacherActor(record, options.actor);
  const validation = validateR7BScenarioLifecycleRecord(record);

  if (validation.errors.length > 0) {
    throw new Error("R7B_SCENARIO_VALIDATION_FAILED");
  }

  return {
    ...withTrace(
      withTrace(record, "VALIDATED", options.actor, "VALIDATED"),
      "APPROVED",
      options.actor,
      "APPROVED"
    ),
    approved_by: options.actor.actor_id,
    validation_report: validation
  };
}

export function freezeR7BApprovedScenario(
  record: R7BScenarioLifecycleRecord,
  options: R7BScenarioDraftOptions
): R7BScenarioLifecycleRecord {
  assertTeacherActor(record, options.actor);
  if (record.status !== "APPROVED") {
    throw new Error("R7B_SCENARIO_INVALID_FREEZE_TRANSITION");
  }

  return {
    ...withTrace(record, "FROZEN", options.actor, "FROZEN"),
    frozen_asset_hash: record.asset.asset_hash
  };
}

export function bindR7BFrozenScenarioToRun(
  record: R7BScenarioLifecycleRecord,
  options: R7BScenarioDraftOptions & { run_id: string }
): R7BScenarioLifecycleRecord {
  assertTeacherActor(record, options.actor);
  if (record.status !== "FROZEN") {
    throw new Error("R7B_SCENARIO_INVALID_BIND_TRANSITION");
  }

  return {
    ...withTrace(record, "BOUND_TO_RUN", options.actor, "BOUND_TO_RUN"),
    run_binding: {
      compiler_version: record.compiler_version,
      course_id: record.course_id,
      input_hash: record.input_hash,
      mutation_allowed: false,
      output_hash: record.output_hash,
      parameter_set_id: record.asset.parameter_set.parameter_set_id,
      parameter_set_version: record.asset.parameter_set.version,
      plugin_package_ids: record.asset.scenario_package.plugin_package_ids,
      run_id: options.run_id,
      scenario_package_id: record.asset.scenario_package.scenario_package_id,
      scenario_package_version: record.asset.scenario_package.version,
      seed: record.seed,
      shock_timeline_hash: sha256(record.asset.shock_timeline),
      tenant_id: record.tenant_id,
      visibility_plan_hash: sha256(record.asset.visibility_plan)
    }
  };
}

export function rejectR7BBoundScenarioMutation(
  record: R7BScenarioLifecycleRecord,
  attempt: R7BScenarioMutationAttempt
): R7BScenarioMutationRejection {
  assertSameTenantAndCourse(record, attempt.actor);
  if (record.status !== "BOUND_TO_RUN") {
    throw new Error("R7B_SCENARIO_MUTATION_REJECTION_REQUIRES_BOUND_RUN");
  }

  return {
    accepted: false,
    code: "R7B_BOUND_SCENARIO_IMMUTABLE",
    direct_store_delta: "NONE",
    field_path: attempt.field_path,
    requires_new_scenario_version: true
  };
}

function diffEntry(
  category: R7BScenarioDiffEntry["category"],
  fieldPath: string,
  tenantId: string,
  courseId: string,
  version: string
): R7BScenarioDiffEntry {
  return {
    actor_visibility: ["teacher", "tenant_admin"],
    category,
    course_id: courseId,
    field_path: fieldPath,
    mutation_allowed: false,
    new_value_classification: category === "parameter" ? "PRIVATE_PARAMETER" : "PRIVATE_ASSUMPTION",
    old_value_classification: category === "parameter" ? "PRIVATE_PARAMETER" : "PRIVATE_ASSUMPTION",
    recompile_required: true,
    requires_new_scenario_version: true,
    scenario_version_scope: version,
    sensitive_field_redaction: true,
    tenant_id: tenantId
  };
}

export function createR7BScenarioDiff(
  before: R7BScenarioLifecycleAsset,
  after: R7BScenarioLifecycleAsset
): R7BScenarioDiff {
  const entries: R7BScenarioDiffEntry[] = [];
  const tenantId = before.scenario_package.tenant_id;
  const courseId = "course_r7b_synthetic";
  const version = before.scenario_package.version;

  if (before.scenario_package.version !== after.scenario_package.version) {
    entries.push(diffEntry("scenario", "scenario_package.version", tenantId, courseId, version));
  }
  if (before.parameter_set.version !== after.parameter_set.version) {
    entries.push(diffEntry("parameter", "parameter_set.version", tenantId, courseId, version));
  }
  if (before.parameter_set.base_capacity !== after.parameter_set.base_capacity) {
    entries.push(
      diffEntry("parameter", "parameter_set.base_capacity", tenantId, courseId, version)
    );
  }
  if (
    stableStringify(before.scenario_package.plugin_package_ids) !==
    stableStringify(after.scenario_package.plugin_package_ids)
  ) {
    entries.push(
      diffEntry("plugin", "scenario_package.plugin_package_ids", tenantId, courseId, version)
    );
  }
  if (stableStringify(before.shock_timeline) !== stableStringify(after.shock_timeline)) {
    entries.push(diffEntry("shock", "shock_timeline", tenantId, courseId, version));
  }

  if (entries.length === 0) {
    entries.push(diffEntry("scenario", "scenario_package.version", tenantId, courseId, version));
  }

  return {
    diff_id: `diff_${sha256(entries).slice(0, 16)}`,
    entries,
    evidence_label: "CONTRACT_BACKED_EVIDENCE"
  };
}

export function evaluateR7BPolicyAndQualification(
  asset: R7BScenarioLifecycleAsset,
  request: R7BPolicyQualificationRequest
): R7BPolicyQualificationResult {
  const policyRule = asset.policy_rules.find((rule) => rule.round_no === request.round_no);
  const migrationRule = asset.segment_migration_rules.find(
    (rule) => rule.round_no === request.round_no
  );
  const qualificationRule = asset.qualification_rules.find(
    (rule) => rule.round_no === request.round_no
  );
  const shock = asset.shock_timeline.find((event) => event.round_no === request.round_no);

  if (!policyRule || !migrationRule || !qualificationRule || !shock) {
    throw new Error("R7B_POLICY_CONTRACT_MISSING_ROUND");
  }

  const controlledFailures: string[] = [];
  if (request.offer_id === "medical_rehab" && request.license_scope !== "eldercare_medical") {
    controlledFailures.push("R7B_MEDICAL_REHAB_LICENSE_SCOPE_DENIED");
  }
  if (request.staff_count < qualificationRule.minimum_staff_count) {
    controlledFailures.push("R7B_STAFFING_CAPACITY_GUARDRAIL_TRIGGERED");
  }

  return {
    controlled_failures: controlledFailures,
    direct_store_delta: "NONE",
    policy_result: controlledFailures.length === 0 ? "allowed" : "denied",
    policy_rule: policyRule,
    qualification_rule: qualificationRule,
    segment_migration_rule: migrationRule,
    shock
  };
}

export function projectR7BScenarioForActor(
  record: R7BScenarioLifecycleRecord,
  options: R7BScenarioDraftOptions
): R7BProjection {
  assertSameTenantAndCourse(record, options.actor);

  if (options.actor.role === "student") {
    return {
      rounds: record.asset.rounds.map((round) => ({
        round_no: round.round_no,
        student_observation_boundary: round.student_observation_boundary,
        title: round.title
      })),
      status: record.status,
      visibility: "student_redacted_state_obs"
    };
  }

  if (options.actor.role === "teacher") {
    return {
      run_binding_status: record.status,
      scenario_diff: createR7BScenarioDiff(makeAsset(), record.asset),
      status: record.status,
      validation_report: record.validation_report,
      visibility: "teacher_authorized_evidence"
    };
  }

  if (options.actor.role === "tenant_admin") {
    return {
      approved_version: record.asset.scenario_package.version,
      run_binding_status: record.status,
      status: record.status,
      tenant_id: record.tenant_id,
      visibility: "tenant_admin_status_summary"
    };
  }

  if (options.actor.role === "platform_admin") {
    if (!options.actor.platform_authority) {
      throw new Error("R7B_PLATFORM_ADMIN_AUTHORITY_REQUIRED");
    }

    return {
      scenario_version: record.asset.scenario_package.version,
      status: record.status,
      tenant_id: record.tenant_id,
      visibility: "platform_admin_explicit_authority"
    };
  }

  return {
    run_binding_status: record.status,
    scenario_diff: createR7BScenarioDiff(makeAsset(), record.asset),
    status: record.status,
    validation_report: record.validation_report,
    visibility: "teacher_authorized_evidence"
  };
}

export function buildR7BShadowReplayEvidence(
  record: R7BScenarioLifecycleRecord,
  officialResult: SettlementResult
): R7BShadowReplayEvidence {
  if (record.status !== "BOUND_TO_RUN") {
    throw new Error("R7B_SHADOW_REPLAY_REQUIRES_BOUND_SCENARIO");
  }

  const officialResultSnapshot = stableStringify(officialResult);

  return {
    bound_scenario_version: record.asset.scenario_package.version,
    official_result_non_overwrite: true,
    public_view: {
      replay_mode: "shadow_replay",
      replay_writes_formal_results: false,
      status: "candidate_evidence_only"
    },
    replay_mode: "shadow_replay",
    replay_writes_formal_results: false,
    shadow_replay_evidence_hash: sha256({
      bound_scenario: record.output_hash,
      official_result: officialResultSnapshot,
      replay_mode: "shadow_replay"
    }),
    source_result_id: officialResult.settlement_result_id
  };
}
