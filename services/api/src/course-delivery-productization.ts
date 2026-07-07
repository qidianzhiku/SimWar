import type {
  AuditLog,
  Course,
  ParameterSet,
  PublicResultView,
  Run,
  ScenarioPackage
} from "@simwar/shared-contracts";
import type { R7CReleaseCandidate } from "@simwar/simulation-core";

export const COURSE_DELIVERY_SYNTHETIC_CLASSIFICATION_V1 = [
  "LEARNING_EVIDENCE_ONLY",
  "NOT_SETTLEMENT_INPUT",
  "NOT_FORMAL_TRUTH",
  "NOT_AUTOMATIC_GRADE",
  "NOT_AI_DECISION"
] as const;

export interface CourseDeliveryBlueprintV1 {
  course_id: string;
  tenant_id: string;
  teacher_scope: string;
  scenario_asset_id: string;
  scenario_version: string;
  template_version: string;
  variant_version: string;
  scenario_package_id: string;
  parameter_set_id: string;
  plugin_package_id: string;
  plugin_version: string;
  engine_version: "toy_logit_wellness_v1@current";
  feature_mapper_version: string;
  seed: number;
  course_objective: string;
  round_plan: Array<{
    round_no: number;
    objective: string;
    shock_reference: string;
  }>;
  team_plan: "two_team_synthetic_minimum";
  role_plan: "CEO_captain_default";
  visibility_plan: R7CReleaseCandidate["compiled_record"]["asset"]["visibility_plan"];
  shock_timeline_reference: string[];
  learning_evidence_configuration: typeof COURSE_DELIVERY_SYNTHETIC_CLASSIFICATION_V1;
  synthetic_classification: typeof COURSE_DELIVERY_SYNTHETIC_CLASSIFICATION_V1;
  known_limits_reference: string;
  approval_reference: string;
  freeze_reference: string;
  run_binding_reference: string;
  audit_reference: "course_delivery_state_machine_audit_v1";
}

export interface CourseDeliveryRunBindingEvidenceV1 {
  run_id: string;
  course_id: string;
  scenario_package_id: string;
  scenario_package_version: string;
  parameter_set_id: string;
  parameter_set_version: string;
  plugin_package_ids: string[];
  plugin_version: string;
  engine_version: CourseDeliveryBlueprintV1["engine_version"];
  feature_mapper_version: string;
  seed: number;
  freeze_reference: string;
  mutation_allowed: false;
}

export interface CourseDeliveryThreePartFeedbackV1 {
  what_happened: {
    status: PublicResultView["status"];
    result_count: number;
    visible_team_ids: string[];
  };
  why_it_happened: {
    scenario_observation: string;
    private_trace_included: false;
    protected_truth_included: false;
  };
  next_step_suggestion: {
    advisory_only: true;
    not_automatic_decision: true;
    text: string;
  };
}

export interface CourseDeliveryLearningEvidenceLedgerV1 {
  ledger_kind: "course_delivery_learning_evidence_v1";
  classification: typeof COURSE_DELIVERY_SYNTHETIC_CLASSIFICATION_V1;
  course_id: string;
  run_id: string;
  replay_source_result_id: string;
  excluded_from_truth_hash: true;
  formal_truth_write: false;
  run_binding: CourseDeliveryRunBindingEvidenceV1;
  student_feedback: CourseDeliveryThreePartFeedbackV1;
  shadow_arena_public_view: unknown;
  teacher_evidence: {
    replay_status: "matched" | "mismatch" | "not_run";
    scenario_visibility: string;
  };
}

export interface CourseDeliveryStateTransitionEvidenceV1 {
  action: string;
  audit_log_id: string;
  entity_id: string;
  entity_type: string;
  from_state: string;
  request_id: string;
  tenant_id: string;
  to_state: string;
}

export const COURSE_DELIVERY_API_PERMISSION_MATRIX_V1 = [
  {
    operation: "Course Publish",
    actor: "teacher",
    required_permission: "course:publish",
    forbidden_callers: ["student", "cross_tenant_actor"],
    idempotency_requirement: "repeat_returns_published_without_duplicate_audit",
    audit_event: "course.publish",
    explicit_non_proof: "not_pilot_or_production_readiness"
  },
  {
    operation: "Round Lock",
    actor: "teacher",
    required_permission: "round:lock",
    forbidden_callers: ["student", "cross_tenant_actor"],
    idempotency_requirement: "repeat_returns_locked_without_duplicate_audit",
    audit_event: "round.lock",
    explicit_non_proof: "not_durable_settlement"
  },
  {
    operation: "Round Publish",
    actor: "teacher",
    required_permission: "round:publish",
    forbidden_callers: ["student", "cross_tenant_actor"],
    idempotency_requirement: "repeat_returns_published_without_duplicate_audit",
    audit_event: "round.publish",
    explicit_non_proof: "not_production_publication"
  },
  {
    operation: "Learning Evidence Read",
    actor: "teacher_or_student_redacted",
    required_permission: "result:read",
    forbidden_callers: ["cross_tenant_actor"],
    idempotency_requirement: "read_only",
    audit_event: "none",
    explicit_non_proof: "not_formal_truth_or_automatic_grade"
  }
] as const;

class CourseDeliveryProductizationError extends Error {
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "CourseDeliveryProductizationError";
  }
}

export function createCourseDeliveryBlueprintV1(input: {
  approvalReference: string;
  course: Course;
  knownLimitsReference: string;
  parameterSet: ParameterSet;
  pluginPackageId: string;
  pluginVersion: string;
  releaseCandidate: R7CReleaseCandidate;
  runBindingReference: string;
  scenarioPackage: ScenarioPackage;
  teacherScope: string;
}): CourseDeliveryBlueprintV1 {
  if (input.course.tenant_id !== input.scenarioPackage.tenant_id) {
    throw new CourseDeliveryProductizationError(
      "COURSE_DELIVERY_TENANT_SCOPE_MISMATCH",
      "course and scenario package must share a tenant"
    );
  }

  if (input.parameterSet.status !== "approved") {
    throw new CourseDeliveryProductizationError(
      "COURSE_DELIVERY_PARAMETER_NOT_APPROVED",
      "course delivery requires an approved ParameterSet"
    );
  }

  if (input.scenarioPackage.status !== "approved") {
    throw new CourseDeliveryProductizationError(
      "COURSE_DELIVERY_SCENARIO_NOT_APPROVED",
      "course delivery requires an approved ScenarioPackage"
    );
  }

  if (!input.scenarioPackage.plugin_package_ids.includes(input.pluginPackageId)) {
    throw new CourseDeliveryProductizationError(
      "COURSE_DELIVERY_PLUGIN_NOT_BOUND",
      "plugin package must be bound by the scenario package"
    );
  }

  const asset = input.releaseCandidate.compiled_record.asset;
  return {
    approval_reference: input.approvalReference,
    audit_reference: "course_delivery_state_machine_audit_v1",
    course_id: input.course.course_id,
    course_objective: "Scenario-driven synthetic course delivery and learning evidence",
    engine_version: "toy_logit_wellness_v1@current",
    feature_mapper_version: input.releaseCandidate.compiled_record.compiler_version,
    freeze_reference:
      input.releaseCandidate.compiled_record.frozen_asset_hash ??
      input.releaseCandidate.release_evidence_hash,
    known_limits_reference: input.knownLimitsReference,
    learning_evidence_configuration: COURSE_DELIVERY_SYNTHETIC_CLASSIFICATION_V1,
    parameter_set_id: input.parameterSet.parameter_set_id,
    plugin_package_id: input.pluginPackageId,
    plugin_version: input.pluginVersion,
    role_plan: "CEO_captain_default",
    round_plan: asset.rounds.map((round) => ({
      objective: round.round_objective,
      round_no: round.round_no,
      shock_reference: round.approved_shock_id
    })),
    run_binding_reference: input.runBindingReference,
    scenario_asset_id: asset.asset_id,
    scenario_package_id: input.scenarioPackage.scenario_package_id,
    scenario_version: input.releaseCandidate.compiled_record.scenario_version,
    seed: input.parameterSet.seed,
    shock_timeline_reference: asset.shock_timeline.map((shock) => shock.shock_id),
    synthetic_classification: COURSE_DELIVERY_SYNTHETIC_CLASSIFICATION_V1,
    teacher_scope: input.teacherScope,
    team_plan: "two_team_synthetic_minimum",
    template_version: input.releaseCandidate.compiled_record.template_version,
    tenant_id: input.course.tenant_id,
    variant_version: input.releaseCandidate.variant_id,
    visibility_plan: asset.visibility_plan
  };
}

export function createCourseDeliveryRunBindingEvidenceV1(input: {
  blueprint: CourseDeliveryBlueprintV1;
  releaseCandidate: R7CReleaseCandidate;
  run: Run;
}): CourseDeliveryRunBindingEvidenceV1 {
  const binding = input.releaseCandidate.run_binding;
  if (!binding) {
    throw new CourseDeliveryProductizationError(
      "COURSE_DELIVERY_RUN_BINDING_MISSING",
      "release candidate must be bound to run"
    );
  }

  if (
    input.run.run_id !== binding.run_id ||
    input.run.scenario_package_id !== binding.scenario_package_id ||
    input.run.parameter_set_id !== binding.parameter_set_id
  ) {
    throw new CourseDeliveryProductizationError(
      "COURSE_DELIVERY_RUN_BINDING_MISMATCH",
      "run binding must match frozen run fields"
    );
  }

  return {
    course_id: input.run.course_id,
    engine_version: input.blueprint.engine_version,
    feature_mapper_version: binding.compiler_version,
    freeze_reference: input.blueprint.freeze_reference,
    mutation_allowed: false,
    parameter_set_id: binding.parameter_set_id,
    parameter_set_version: binding.parameter_set_version,
    plugin_package_ids: [...binding.plugin_package_ids],
    plugin_version: input.blueprint.plugin_version,
    run_id: binding.run_id,
    scenario_package_id: binding.scenario_package_id,
    scenario_package_version: binding.scenario_package_version,
    seed: input.run.seed
  };
}

export function buildCourseDeliveryThreePartFeedbackV1(input: {
  deterministicNextStep: string;
  scenarioObservation: string;
  studentResult: PublicResultView;
}): CourseDeliveryThreePartFeedbackV1 {
  return {
    next_step_suggestion: {
      advisory_only: true,
      not_automatic_decision: true,
      text: input.deterministicNextStep
    },
    what_happened: {
      result_count: input.studentResult.results.length,
      status: input.studentResult.status,
      visible_team_ids: input.studentResult.results.map((result) => result.team_id)
    },
    why_it_happened: {
      private_trace_included: false,
      protected_truth_included: false,
      scenario_observation: input.scenarioObservation
    }
  };
}

export function createCourseDeliveryLearningEvidenceLedgerV1(input: {
  blueprint: CourseDeliveryBlueprintV1;
  feedback: CourseDeliveryThreePartFeedbackV1;
  replaySourceResultId: string;
  runBindingEvidence: CourseDeliveryRunBindingEvidenceV1;
  shadowArenaPublicView: unknown;
  teacherEvidence: CourseDeliveryLearningEvidenceLedgerV1["teacher_evidence"];
}): CourseDeliveryLearningEvidenceLedgerV1 {
  return {
    classification: COURSE_DELIVERY_SYNTHETIC_CLASSIFICATION_V1,
    course_id: input.blueprint.course_id,
    excluded_from_truth_hash: true,
    formal_truth_write: false,
    ledger_kind: "course_delivery_learning_evidence_v1",
    replay_source_result_id: input.replaySourceResultId,
    run_binding: input.runBindingEvidence,
    run_id: input.runBindingEvidence.run_id,
    shadow_arena_public_view: input.shadowArenaPublicView,
    student_feedback: input.feedback,
    teacher_evidence: input.teacherEvidence
  };
}

export function summarizeCourseDeliveryStateMachineEvidenceV1(auditLogs: AuditLog[]): {
  duplicate_side_effects_detected: boolean;
  transitions: CourseDeliveryStateTransitionEvidenceV1[];
} {
  const transitions = auditLogs.flatMap((log) => {
    const fromState = typeof log.before?.status === "string" ? log.before.status : undefined;
    const toState = typeof log.after?.status === "string" ? log.after.status : undefined;
    if (!fromState || !toState || fromState === toState) {
      return [];
    }

    return [
      {
        action: log.action,
        audit_log_id: log.audit_id,
        entity_id: log.resource_id,
        entity_type: log.resource_type,
        from_state: fromState,
        request_id: log.request_id,
        tenant_id: log.tenant_id,
        to_state: toState
      }
    ];
  });
  const seen = new Set<string>();
  const duplicateSideEffects = transitions.some((transition) => {
    const key = `${transition.action}:${transition.entity_id}:${transition.to_state}`;
    if (seen.has(key)) {
      return true;
    }
    seen.add(key);
    return false;
  });

  return {
    duplicate_side_effects_detected: duplicateSideEffects,
    transitions
  };
}
