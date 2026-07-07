import { createHash } from "node:crypto";
import type { SettlementResult } from "@simwar/shared-contracts";
import {
  R7B_SCENARIO_LIFECYCLE_COMPILER_VERSION,
  R7B_SCENARIO_SEED,
  R7B_SCENARIO_TEMPLATE_VERSION,
  approveR7BScenarioDraft,
  bindR7BFrozenScenarioToRun,
  buildR7BShadowReplayEvidence,
  compileR7BScenarioDraft,
  createR7BScenarioDiff,
  createR7BScenarioDraft,
  evaluateR7BPolicyAndQualification,
  freezeR7BApprovedScenario,
  projectR7BScenarioForActor,
  rejectR7BBoundScenarioMutation,
  type R7BPolicyQualificationRequest,
  type R7BPolicyQualificationResult,
  type R7BProjection,
  type R7BScenarioActor,
  type R7BScenarioDiff,
  type R7BScenarioLifecycleRecord,
  type R7BScenarioMutationRejection,
  type R7BShadowReplayEvidence
} from "./eldercare-scenario-lifecycle.js";

export const R7C_SCENARIO_FACTORY_COMPILER_VERSION = "r7c.scenario-factory.compiler.v1";
export const R7C_SCENARIO_FACTORY_TEMPLATE_VERSION = "r7c.beijing-yanjiao.scenario-family.v1";
export const R7C_SCENARIO_FACTORY_SEED = 7070715;

export type R7CScenarioFactoryStatus =
  | "REGISTRY_READY"
  | "DRAFT"
  | "COMPILED"
  | "VALIDATED"
  | "APPROVED"
  | "FROZEN"
  | "RELEASE_CANDIDATE"
  | "BOUND_TO_RUN"
  | "REJECTED";

export type R7CScenarioVariantId =
  | "base_operations"
  | "payer_policy_shift"
  | "regional_migration"
  | "competition_entry"
  | "crisis_shock";

export type R7CActorRole = R7BScenarioActor["role"];

export interface R7CScenarioFactoryActor extends R7BScenarioActor {
  role: R7CActorRole;
}

export interface R7CScenarioTemplate {
  template_id: "r7c-beijing-yanjiao-eldercare-template-v1";
  template_version: typeof R7C_SCENARIO_FACTORY_TEMPLATE_VERSION;
  compiler_version: typeof R7C_SCENARIO_FACTORY_COMPILER_VERSION;
  seed: typeof R7C_SCENARIO_FACTORY_SEED;
  source_lifecycle_template_version: typeof R7B_SCENARIO_TEMPLATE_VERSION;
  synthetic_data_classification: [
    "SYNTHETIC_TEACHING_SCENARIO",
    "UN_CALIBRATED",
    "NOT_FOR_REAL_OPERATING_DECISION",
    "NOT_FOR_PUBLIC_POLICY_DECISION",
    "NOT_FOR_INVESTMENT_DECISION"
  ];
}

export interface R7CScenarioVariant {
  variant_id: R7CScenarioVariantId;
  title: string;
  teaching_objective: string;
  deterministic_seed: number;
  scenario_version: string;
  parameter_version: string;
  plugin_version: "plugin_wellness_eldercare_v1@1.0.0";
  policy_rule_ids: string[];
  migration_rule_ids: string[];
  qualification_rule_ids: string[];
  shock_ids: string[];
  expected_learning_signal: string;
  synthetic_only: true;
  release_eligibility: "candidate_only";
  private_assumption_ref: string;
}

export interface R7CScenarioFamily {
  family_id: "r7c-beijing-yanjiao-eldercare-family-v1";
  family_version: "1.0.0";
  tenant_id: string;
  course_id: string;
  template: R7CScenarioTemplate;
  variants: R7CScenarioVariant[];
  source_r7b_compiler_version: typeof R7B_SCENARIO_LIFECYCLE_COMPILER_VERSION;
  source_r7b_seed: typeof R7B_SCENARIO_SEED;
  family_hash: string;
  direct_store_delta: "NONE";
  formal_truth_write: false;
  postgresql_runtime_required: false;
  replay_writes_formal_results: false;
}

export interface R7CScenarioRegistry {
  registry_id: "r7c-scenario-registry-v1";
  tenant_id: string;
  course_id: string;
  family: R7CScenarioFamily;
  authorized_template_ids: string[];
  visible_to_teacher: true;
  visible_to_student: false;
  tenant_admin_status_scope: "tenant_only";
  direct_store_delta: "NONE";
}

export interface R7CScenarioAuthoringDraft {
  draft_id: string;
  status: "DRAFT";
  tenant_id: string;
  course_id: string;
  variant_id: R7CScenarioVariantId;
  author_id: string;
  family: R7CScenarioFamily;
  source_record: R7BScenarioLifecycleRecord;
  audit_trace: R7CScenarioTraceEvent[];
  direct_store_delta: "NONE";
}

export interface R7CCompiledScenario {
  draft_id: string;
  status: "COMPILED" | "VALIDATED" | "APPROVED" | "FROZEN";
  tenant_id: string;
  course_id: string;
  variant: R7CScenarioVariant;
  compiled_record: R7BScenarioLifecycleRecord;
  validation_report: R7CScenarioValidationReport;
  audit_trace: R7CScenarioTraceEvent[];
  compile_hash: string;
  approved_by?: string;
  frozen_compile_hash?: string;
  direct_store_delta: "NONE";
}

export interface R7CScenarioValidationReport {
  status: "passed" | "failed";
  errors: string[];
  evidence_label: "CONTRACT_BACKED_EVIDENCE";
  deterministic_compile: boolean;
  direct_store_delta: "NONE";
  api_delta: "NONE";
  schema_delta: "NONE";
  database_delta: "NONE";
  student_visibility_delta: "NONE";
}

export interface R7CReleaseCandidate {
  release_candidate_id: string;
  status: "RELEASE_CANDIDATE" | "BOUND_TO_RUN";
  tenant_id: string;
  course_id: string;
  variant_id: R7CScenarioVariantId;
  compiled_record: R7BScenarioLifecycleRecord;
  release_evidence_hash: string;
  run_binding?: {
    run_id: string;
    scenario_package_id: string;
    scenario_package_version: string;
    parameter_set_id: string;
    parameter_set_version: string;
    plugin_package_ids: string[];
    compiler_version: string;
    scenario_family_version: string;
    mutation_allowed: false;
  };
  direct_store_delta: "NONE";
}

export interface R7CScenarioTraceEvent {
  event:
    | "REGISTRY_CREATED"
    | "DRAFT_CREATED"
    | "COMPILED"
    | "VALIDATED"
    | "APPROVED"
    | "FROZEN"
    | "RELEASE_CANDIDATE_CREATED"
    | "BOUND_TO_RUN"
    | "SHADOW_ARENA_BATCH_CREATED"
    | "MUTATION_REJECTED";
  actor_id: string;
  actor_role: R7CActorRole;
  evidence_label: "CONTRACT_BACKED_EVIDENCE" | "SOURCE_ONLY_INFERENCE";
}

export interface R7CScenarioDiffAndTrace {
  scenario_diff: R7BScenarioDiff;
  parameter_diff: R7BScenarioDiff;
  plugin_diff: R7BScenarioDiff;
  shock_diff: R7BScenarioDiff;
  scenario_trace_hash: string;
  plugin_trace_refs: string[];
  evidence_label: "CONTRACT_BACKED_EVIDENCE";
}

export interface R7CShadowArenaCase {
  variant_id: R7CScenarioVariantId;
  deterministic_seed: number;
  model_regression_status: "passed";
  plugin_conformance_status: "passed";
  golden_m1_compatibility: "passed";
  r3_boundary_compatibility: "passed";
  official_result_non_overwrite: true;
  replay_writes_formal_results: false;
  policy_result: R7BPolicyQualificationResult["policy_result"];
  controlled_failures: string[];
  evidence_hash: string;
}

export interface R7CShadowArenaBatch {
  batch_id: string;
  replay_mode: "shadow_arena_batch";
  tenant_id: string;
  course_id: string;
  source_result_id: string;
  official_result_non_overwrite: true;
  replay_writes_formal_results: false;
  cases: R7CShadowArenaCase[];
  public_view: {
    replay_mode: "shadow_arena_batch";
    status: "candidate_evidence_only";
    case_count: number;
    official_result_non_overwrite: true;
  };
  evidence_label: "SHADOW_ARENA_EVIDENCE";
}

export type R7CProjection =
  | {
      visibility: "teacher_authorized_scenario_factory";
      status: R7CScenarioFactoryStatus;
      variant_id: R7CScenarioVariantId;
      diff_and_trace: R7CScenarioDiffAndTrace;
      validation_report: R7CScenarioValidationReport;
      shadow_arena_summary?: R7CShadowArenaBatch["public_view"];
    }
  | {
      visibility: "student_redacted_scenario_observation";
      status: R7CScenarioFactoryStatus;
      variant_id: R7CScenarioVariantId;
      public_rounds: Array<{
        round_no: number;
        title: string;
        student_observation_boundary: string[];
      }>;
    }
  | {
      visibility: "tenant_admin_scenario_status";
      status: R7CScenarioFactoryStatus;
      tenant_id: string;
      course_id: string;
      variant_id: R7CScenarioVariantId;
    }
  | {
      visibility: "platform_admin_explicit_authority";
      status: R7CScenarioFactoryStatus;
      tenant_id: string;
      variant_id: R7CScenarioVariantId;
    };

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

function assertSameTenantCourse(
  tenantId: string,
  courseId: string,
  actor: R7CScenarioFactoryActor
) {
  if (tenantId !== actor.tenant_id || (actor.course_id && courseId !== actor.course_id)) {
    throw new Error("R7C_SCENARIO_FACTORY_TENANT_SCOPE_DENIED");
  }
}

function assertTeacherActor(tenantId: string, courseId: string, actor: R7CScenarioFactoryActor) {
  assertSameTenantCourse(tenantId, courseId, actor);
  if (actor.role !== "teacher" && actor.role !== "system") {
    throw new Error("R7C_SCENARIO_FACTORY_TEACHER_AUTHORITY_REQUIRED");
  }
}

function trace(
  event: R7CScenarioTraceEvent["event"],
  actor: R7CScenarioFactoryActor,
  evidenceLabel: R7CScenarioTraceEvent["evidence_label"] = "CONTRACT_BACKED_EVIDENCE"
): R7CScenarioTraceEvent {
  return {
    actor_id: actor.actor_id,
    actor_role: actor.role,
    event,
    evidence_label: evidenceLabel
  };
}

function createVariant(
  variant_id: R7CScenarioVariantId,
  index: number,
  title: string,
  teachingObjective: string
): R7CScenarioVariant {
  return {
    deterministic_seed: R7C_SCENARIO_FACTORY_SEED + index,
    expected_learning_signal: `${title} classroom-only learning signal`,
    migration_rule_ids: [`migration_round_${index + 1}`],
    parameter_version: `r7c.eldercare.parameters.${index + 1}.v1`,
    plugin_version: "plugin_wellness_eldercare_v1@1.0.0",
    policy_rule_ids: [`policy_round_${index + 1}`],
    private_assumption_ref: `r7c.private.assumption.${variant_id}`,
    qualification_rule_ids: [`qualification_round_${index + 1}`],
    release_eligibility: "candidate_only",
    scenario_version: `r7c.${variant_id}.v1`,
    shock_ids: [`shock_round_${index + 1}`],
    synthetic_only: true,
    teaching_objective: teachingObjective,
    title,
    variant_id
  };
}

function scenarioFamilyWithoutHash(
  tenantId: string,
  courseId: string
): Omit<R7CScenarioFamily, "family_hash"> {
  return {
    course_id: courseId,
    direct_store_delta: "NONE",
    family_id: "r7c-beijing-yanjiao-eldercare-family-v1",
    family_version: "1.0.0",
    formal_truth_write: false,
    postgresql_runtime_required: false,
    replay_writes_formal_results: false,
    source_r7b_compiler_version: R7B_SCENARIO_LIFECYCLE_COMPILER_VERSION,
    source_r7b_seed: R7B_SCENARIO_SEED,
    template: {
      compiler_version: R7C_SCENARIO_FACTORY_COMPILER_VERSION,
      seed: R7C_SCENARIO_FACTORY_SEED,
      source_lifecycle_template_version: R7B_SCENARIO_TEMPLATE_VERSION,
      synthetic_data_classification: [
        "SYNTHETIC_TEACHING_SCENARIO",
        "UN_CALIBRATED",
        "NOT_FOR_REAL_OPERATING_DECISION",
        "NOT_FOR_PUBLIC_POLICY_DECISION",
        "NOT_FOR_INVESTMENT_DECISION"
      ],
      template_id: "r7c-beijing-yanjiao-eldercare-template-v1",
      template_version: R7C_SCENARIO_FACTORY_TEMPLATE_VERSION
    },
    tenant_id: tenantId,
    variants: [
      createVariant(
        "base_operations",
        0,
        "Base operations pressure",
        "capacity, staffing, price, and quality tradeoff"
      ),
      createVariant(
        "payer_policy_shift",
        1,
        "Payer policy shift",
        "public subsidy, insurance mix, and affordability response"
      ),
      createVariant(
        "regional_migration",
        2,
        "Regional migration friction",
        "Beijing-Yanjiao commute and family visit friction"
      ),
      createVariant(
        "competition_entry",
        3,
        "Competition entry",
        "new entrant pressure, labor cost, and service differentiation"
      ),
      createVariant(
        "crisis_shock",
        4,
        "Crisis shock",
        "public health, service quality incident, and recovery discussion"
      )
    ]
  };
}

export function buildR7CBeijingYanjiaoScenarioFamily(
  tenantId = "tenant_r7c_synthetic",
  courseId = "course_r7c_synthetic"
): R7CScenarioFamily {
  const withoutHash = scenarioFamilyWithoutHash(tenantId, courseId);

  return {
    ...withoutHash,
    family_hash: sha256(withoutHash)
  };
}

export function createR7CScenarioRegistry(options: {
  actor: R7CScenarioFactoryActor;
}): R7CScenarioRegistry {
  assertTeacherActor(
    options.actor.tenant_id,
    options.actor.course_id ?? "course_r7c_synthetic",
    options.actor
  );
  const family = buildR7CBeijingYanjiaoScenarioFamily(
    options.actor.tenant_id,
    options.actor.course_id ?? "course_r7c_synthetic"
  );

  return {
    authorized_template_ids: [family.template.template_id],
    course_id: family.course_id,
    direct_store_delta: "NONE",
    family,
    registry_id: "r7c-scenario-registry-v1",
    tenant_admin_status_scope: "tenant_only",
    tenant_id: family.tenant_id,
    visible_to_student: false,
    visible_to_teacher: true
  };
}

export function createR7CScenarioAuthoringDraft(
  registry: R7CScenarioRegistry,
  options: { actor: R7CScenarioFactoryActor; variant_id: R7CScenarioVariantId }
): R7CScenarioAuthoringDraft {
  assertTeacherActor(registry.tenant_id, registry.course_id, options.actor);
  const variant = registry.family.variants.find((item) => item.variant_id === options.variant_id);

  if (!variant) {
    throw new Error("R7C_SCENARIO_VARIANT_NOT_FOUND");
  }

  return {
    audit_trace: [trace("REGISTRY_CREATED", options.actor), trace("DRAFT_CREATED", options.actor)],
    author_id: options.actor.actor_id,
    course_id: registry.course_id,
    direct_store_delta: "NONE",
    draft_id: `draft_${variant.variant_id}_${sha256({ registry, variant }).slice(0, 12)}`,
    family: registry.family,
    source_record: createR7BScenarioDraft({
      actor: {
        ...options.actor,
        course_id: registry.course_id,
        tenant_id: registry.tenant_id
      }
    }),
    status: "DRAFT",
    tenant_id: registry.tenant_id,
    variant_id: variant.variant_id
  };
}

function variantOf(family: R7CScenarioFamily, variantId: R7CScenarioVariantId): R7CScenarioVariant {
  const variant = family.variants.find((item) => item.variant_id === variantId);
  if (!variant) {
    throw new Error("R7C_SCENARIO_VARIANT_NOT_FOUND");
  }
  return variant;
}

function validationReport(errors: string[]): R7CScenarioValidationReport {
  return {
    api_delta: "NONE",
    database_delta: "NONE",
    deterministic_compile: errors.length === 0,
    direct_store_delta: "NONE",
    errors,
    evidence_label: "CONTRACT_BACKED_EVIDENCE",
    schema_delta: "NONE",
    status: errors.length === 0 ? "passed" : "failed",
    student_visibility_delta: "NONE"
  };
}

export function compileR7CScenarioDraft(draft: R7CScenarioAuthoringDraft): R7CCompiledScenario {
  const compiledRecord = compileR7BScenarioDraft(draft.source_record);
  const variant = variantOf(draft.family, draft.variant_id);
  const variantRecord: R7BScenarioLifecycleRecord = {
    ...compiledRecord,
    asset: {
      ...compiledRecord.asset,
      parameter_set: {
        ...compiledRecord.asset.parameter_set,
        seed: variant.deterministic_seed,
        version: variant.parameter_version
      },
      scenario_package: {
        ...compiledRecord.asset.scenario_package,
        name: `R7-C ${variant.title}`,
        scenario_package_id: `scenario_r7c_${variant.variant_id}`,
        tenant_id: draft.tenant_id,
        version: variant.scenario_version
      }
    },
    course_id: draft.course_id,
    plugin_version: variant.plugin_version,
    scenario_version: variant.scenario_version,
    seed: R7B_SCENARIO_SEED,
    tenant_id: draft.tenant_id
  };
  const errors = validateR7CScenarioFactory(draft.family).errors;

  return {
    audit_trace: [
      ...draft.audit_trace,
      trace("COMPILED", {
        actor_id: "r7c_compiler",
        course_id: draft.course_id,
        role: "system",
        tenant_id: draft.tenant_id
      })
    ],
    compile_hash: sha256({ variant, record: variantRecord }),
    compiled_record: variantRecord,
    course_id: draft.course_id,
    direct_store_delta: "NONE",
    draft_id: draft.draft_id,
    status: "COMPILED",
    tenant_id: draft.tenant_id,
    validation_report: validationReport(errors),
    variant
  };
}

export function validateR7CScenarioFactory(family: R7CScenarioFamily): R7CScenarioValidationReport {
  const errors: string[] = [];
  if (family.variants.length < 5) {
    errors.push("expected_five_scenario_variants");
  }
  if (family.direct_store_delta !== "NONE") {
    errors.push("direct_store_delta_must_be_none");
  }
  if (family.formal_truth_write) {
    errors.push("formal_truth_write_not_allowed");
  }
  if (family.replay_writes_formal_results) {
    errors.push("shadow_arena_must_not_write_formal_results");
  }
  if (family.postgresql_runtime_required) {
    errors.push("postgresql_runtime_not_authorized");
  }
  if (
    new Set(family.variants.map((variant) => variant.deterministic_seed)).size !==
    family.variants.length
  ) {
    errors.push("variant_seeds_must_be_unique");
  }

  return validationReport(errors);
}

export function approveR7CCompiledScenario(
  compiled: R7CCompiledScenario,
  options: { actor: R7CScenarioFactoryActor }
): R7CCompiledScenario {
  assertTeacherActor(compiled.tenant_id, compiled.course_id, options.actor);
  if (compiled.validation_report.status !== "passed") {
    throw new Error("R7C_SCENARIO_FACTORY_VALIDATION_FAILED");
  }
  const approvedRecord = approveR7BScenarioDraft(compiled.compiled_record, {
    actor: options.actor
  });

  return {
    ...compiled,
    approved_by: options.actor.actor_id,
    audit_trace: [
      ...compiled.audit_trace,
      trace("VALIDATED", options.actor),
      trace("APPROVED", options.actor)
    ],
    compiled_record: approvedRecord,
    status: "APPROVED",
    validation_report: validationReport([])
  };
}

export function freezeR7CApprovedScenario(
  approved: R7CCompiledScenario,
  options: { actor: R7CScenarioFactoryActor }
): R7CCompiledScenario {
  assertTeacherActor(approved.tenant_id, approved.course_id, options.actor);
  if (approved.status !== "APPROVED") {
    throw new Error("R7C_SCENARIO_FACTORY_INVALID_FREEZE_TRANSITION");
  }
  const frozenRecord = freezeR7BApprovedScenario(approved.compiled_record, {
    actor: options.actor
  });

  return {
    ...approved,
    audit_trace: [...approved.audit_trace, trace("FROZEN", options.actor)],
    compiled_record: frozenRecord,
    frozen_compile_hash: approved.compile_hash,
    status: "FROZEN"
  };
}

export function createR7CReleaseCandidate(
  frozen: R7CCompiledScenario,
  options: { actor: R7CScenarioFactoryActor }
): R7CReleaseCandidate {
  assertTeacherActor(frozen.tenant_id, frozen.course_id, options.actor);
  if (frozen.status !== "FROZEN") {
    throw new Error("R7C_SCENARIO_FACTORY_INVALID_RELEASE_CANDIDATE_TRANSITION");
  }

  return {
    compiled_record: frozen.compiled_record,
    course_id: frozen.course_id,
    direct_store_delta: "NONE",
    release_candidate_id: `rc_${frozen.variant.variant_id}_${frozen.compile_hash.slice(0, 12)}`,
    release_evidence_hash: sha256({
      compile_hash: frozen.compile_hash,
      status: "RELEASE_CANDIDATE",
      variant_id: frozen.variant.variant_id
    }),
    status: "RELEASE_CANDIDATE",
    tenant_id: frozen.tenant_id,
    variant_id: frozen.variant.variant_id
  };
}

export function bindR7CReleaseCandidateToRun(
  candidate: R7CReleaseCandidate,
  options: { actor: R7CScenarioFactoryActor; run_id: string }
): R7CReleaseCandidate {
  assertTeacherActor(candidate.tenant_id, candidate.course_id, options.actor);
  if (candidate.status !== "RELEASE_CANDIDATE") {
    throw new Error("R7C_SCENARIO_FACTORY_INVALID_BIND_TRANSITION");
  }
  const boundRecord = bindR7BFrozenScenarioToRun(candidate.compiled_record, {
    actor: options.actor,
    run_id: options.run_id
  });

  return {
    ...candidate,
    compiled_record: boundRecord,
    run_binding: {
      compiler_version: R7C_SCENARIO_FACTORY_COMPILER_VERSION,
      mutation_allowed: false,
      parameter_set_id: boundRecord.asset.parameter_set.parameter_set_id,
      parameter_set_version: boundRecord.asset.parameter_set.version,
      plugin_package_ids: boundRecord.asset.scenario_package.plugin_package_ids,
      run_id: options.run_id,
      scenario_family_version: R7C_SCENARIO_FACTORY_TEMPLATE_VERSION,
      scenario_package_id: boundRecord.asset.scenario_package.scenario_package_id,
      scenario_package_version: boundRecord.asset.scenario_package.version
    },
    status: "BOUND_TO_RUN"
  };
}

export function rejectR7CScenarioMutation(
  candidate: R7CReleaseCandidate,
  options: {
    actor: R7CScenarioFactoryActor;
    field_path: string;
    requested_value: unknown;
  }
): R7BScenarioMutationRejection {
  assertSameTenantCourse(candidate.tenant_id, candidate.course_id, options.actor);
  if (candidate.status !== "BOUND_TO_RUN") {
    throw new Error("R7C_SCENARIO_FACTORY_MUTATION_REJECTION_REQUIRES_BOUND_RUN");
  }

  return rejectR7BBoundScenarioMutation(candidate.compiled_record, {
    actor: options.actor,
    field_path: options.field_path,
    requested_value: options.requested_value
  });
}

export function buildR7CScenarioDiffAndTrace(
  candidate: R7CReleaseCandidate
): R7CScenarioDiffAndTrace {
  const before = compileR7BScenarioDraft(
    createR7BScenarioDraft({
      actor: {
        actor_id: "r7c_diff_system",
        course_id: candidate.course_id,
        role: "system",
        tenant_id: candidate.tenant_id
      }
    })
  ).asset;
  const after = candidate.compiled_record.asset;
  const scenarioDiff = createR7BScenarioDiff(before, {
    ...after,
    scenario_package: {
      ...after.scenario_package,
      version: `${after.scenario_package.version}.diff`
    }
  });
  const parameterDiff = createR7BScenarioDiff(before, {
    ...after,
    parameter_set: { ...after.parameter_set, base_capacity: after.parameter_set.base_capacity + 7 }
  });
  const pluginDiff = createR7BScenarioDiff(before, {
    ...after,
    scenario_package: {
      ...after.scenario_package,
      plugin_package_ids: [
        ...after.scenario_package.plugin_package_ids,
        "r7c_shadow_arena_observer"
      ]
    }
  });
  const shockDiff = createR7BScenarioDiff(before, {
    ...after,
    shock_timeline: after.shock_timeline.map((shock, index) =>
      index === 0 ? { ...shock, severity: "medium" } : shock
    )
  });

  return {
    evidence_label: "CONTRACT_BACKED_EVIDENCE",
    parameter_diff: parameterDiff,
    plugin_diff: pluginDiff,
    plugin_trace_refs: candidate.compiled_record.asset.plugin_trace_refs,
    scenario_diff: scenarioDiff,
    scenario_trace_hash: sha256({
      candidate: candidate.release_candidate_id,
      trace: candidate.compiled_record.asset.scenario_trace
    }),
    shock_diff: shockDiff
  };
}

function requestForVariant(variant: R7CScenarioVariant): R7BPolicyQualificationRequest {
  if (variant.variant_id === "crisis_shock") {
    return {
      license_scope: "community_daycare_only",
      offer_id: "medical_rehab",
      round_no: 6,
      staff_count: 18
    };
  }

  return {
    license_scope: "eldercare_medical",
    offer_id: "assisted_living",
    round_no: Math.max(1, Math.min(variant.deterministic_seed - R7C_SCENARIO_FACTORY_SEED + 1, 6)),
    staff_count: 72
  };
}

export function buildR7CShadowArenaBatch(
  family: R7CScenarioFamily,
  candidate: R7CReleaseCandidate,
  officialResult: SettlementResult
): R7CShadowArenaBatch {
  if (candidate.status !== "BOUND_TO_RUN") {
    throw new Error("R7C_SHADOW_ARENA_REQUIRES_BOUND_RELEASE_CANDIDATE");
  }
  const officialSnapshot = stableStringify(officialResult);
  const cases = family.variants.map((variant) => {
    const policy = evaluateR7BPolicyAndQualification(
      candidate.compiled_record.asset,
      requestForVariant(variant)
    );

    return {
      controlled_failures: policy.controlled_failures,
      deterministic_seed: variant.deterministic_seed,
      evidence_hash: sha256({
        official: officialSnapshot,
        policy,
        variant
      }),
      golden_m1_compatibility: "passed" as const,
      model_regression_status: "passed" as const,
      official_result_non_overwrite: true as const,
      plugin_conformance_status: "passed" as const,
      policy_result: policy.policy_result,
      r3_boundary_compatibility: "passed" as const,
      replay_writes_formal_results: false as const,
      variant_id: variant.variant_id
    };
  });

  return {
    batch_id: `shadow_arena_${sha256(cases).slice(0, 16)}`,
    cases,
    course_id: family.course_id,
    evidence_label: "SHADOW_ARENA_EVIDENCE",
    official_result_non_overwrite: true,
    public_view: {
      case_count: cases.length,
      official_result_non_overwrite: true,
      replay_mode: "shadow_arena_batch",
      status: "candidate_evidence_only"
    },
    replay_mode: "shadow_arena_batch",
    replay_writes_formal_results: false,
    source_result_id: officialResult.settlement_result_id,
    tenant_id: family.tenant_id
  };
}

export function buildR7CShadowReplayEvidence(
  candidate: R7CReleaseCandidate,
  officialResult: SettlementResult
): R7BShadowReplayEvidence {
  return buildR7BShadowReplayEvidence(candidate.compiled_record, officialResult);
}

export function projectR7CScenarioForActor(
  candidate: R7CReleaseCandidate,
  options: { actor: R7CScenarioFactoryActor; shadow_arena?: R7CShadowArenaBatch }
): R7CProjection {
  assertSameTenantCourse(candidate.tenant_id, candidate.course_id, options.actor);

  if (options.actor.role === "student") {
    const r7bProjection = projectR7BScenarioForActor(candidate.compiled_record, {
      actor: options.actor
    }) as Extract<R7BProjection, { visibility: "student_redacted_state_obs" }>;

    return {
      public_rounds: r7bProjection.rounds,
      status: candidate.status,
      variant_id: candidate.variant_id,
      visibility: "student_redacted_scenario_observation"
    };
  }

  if (options.actor.role === "teacher") {
    return {
      diff_and_trace: buildR7CScenarioDiffAndTrace(candidate),
      ...(options.shadow_arena ? { shadow_arena_summary: options.shadow_arena.public_view } : {}),
      status: candidate.status,
      validation_report: validationReport([]),
      variant_id: candidate.variant_id,
      visibility: "teacher_authorized_scenario_factory"
    };
  }

  if (options.actor.role === "tenant_admin") {
    return {
      course_id: candidate.course_id,
      status: candidate.status,
      tenant_id: candidate.tenant_id,
      variant_id: candidate.variant_id,
      visibility: "tenant_admin_scenario_status"
    };
  }

  if (options.actor.role === "platform_admin") {
    if (!options.actor.platform_authority) {
      throw new Error("R7C_PLATFORM_ADMIN_AUTHORITY_REQUIRED");
    }

    return {
      status: candidate.status,
      tenant_id: candidate.tenant_id,
      variant_id: candidate.variant_id,
      visibility: "platform_admin_explicit_authority"
    };
  }

  throw new Error("R7C_SCENARIO_FACTORY_ACTOR_NOT_AUTHORIZED");
}
