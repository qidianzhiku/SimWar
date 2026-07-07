import type { RunReplayEvidence } from "@simwar/shared-contracts";
import type {
  CourseDeliveryBlueprintV1,
  CourseDeliveryLearningEvidenceLedgerV1,
  CourseDeliveryStateTransitionEvidenceV1,
  CourseDeliveryThreePartFeedbackV1
} from "./course-delivery-productization.js";
import type { CourseDeliveryRuntimeV2Evidence } from "./course-delivery-runtime-v2.js";

export const COURSE_RUNTIME_V3_FORBIDDEN_STUDENT_MARKERS = [
  "state_true",
  "replay_evidence",
  "ReplayManifest",
  "manifest_hash",
  "decision_batch_hash",
  "json_runtime_source_digest",
  "canonical_evidence_digest",
  "private_replay",
  "tenant_other",
  "tenant_platform"
] as const;

export const COURSE_RUNTIME_V3_REQUIRED_CHAIN = [
  "course.blueprint",
  "course.publish",
  "run.create",
  "scenario.bind",
  "round.start",
  "decision.submit",
  "decision.submit.idempotent_replay",
  "round.lock",
  "round.settle_requested",
  "round.publish",
  "result.read.student_redacted",
  "result.read.teacher_evidence",
  "tenant_admin.scope",
  "replay.evidence",
  "shadow_arena.non_overwrite",
  "learning_evidence.excluded_from_truth_hash",
  "audit.integrity"
] as const;

export const COURSE_RUNTIME_V3_KNOWN_LIMITS = [
  "does_not_claim_g0_pass",
  "does_not_claim_l1_ready",
  "does_not_activate_postgresql_runtime",
  "does_not_prove_durable_settlement"
] as const;

export interface CourseRuntimeV3DeniedOperationEvidence {
  actor: string;
  code: string;
  operation: string;
  private_detail_leaked: boolean;
  status: number;
}

export interface CourseRuntimeV3IdempotencyEvidence {
  duplicate_audit_side_effects_detected: boolean;
  duplicate_decision_result_stable: boolean;
  duplicate_publish_result_stable: boolean;
  duplicate_round_lock_result_stable: boolean;
  duplicate_settlement_result_stable: boolean;
}

export interface CourseRuntimeV3EvidenceInput {
  blueprint: CourseDeliveryBlueprintV1;
  deniedOperations: CourseRuntimeV3DeniedOperationEvidence[];
  idempotencyEvidence: CourseRuntimeV3IdempotencyEvidence;
  learningEvidence: CourseDeliveryLearningEvidenceLedgerV1;
  replayEvidence: RunReplayEvidence;
  runtimeV2Evidence: CourseDeliveryRuntimeV2Evidence;
  stateMachineEvidence: {
    duplicate_side_effects_detected: boolean;
    transitions: CourseDeliveryStateTransitionEvidenceV1[];
  };
  studentFeedback: CourseDeliveryThreePartFeedbackV1;
}

export interface CourseRuntimeV3Evidence {
  audit_integrity: {
    audit_events_have_request_id: boolean;
    duplicate_audit_side_effects_detected: boolean;
    observed_request_ids: string[];
  };
  course_blueprint: {
    course_id: string;
    engine_version: CourseDeliveryBlueprintV1["engine_version"];
    mutation_allowed: false;
    parameter_set_id: string;
    plugin_package_id: string;
    scenario_package_id: string;
    seed: number;
  };
  direct_store_delta: "NONE";
  evidence_kind: "course_runtime_v3_synthetic_execution_evidence";
  evidence_version: "course-runtime-v3.synthetic.v1";
  g0_pass: "NOT_GRANTED";
  g0_status: "EXCEPTION";
  idempotency: CourseRuntimeV3IdempotencyEvidence;
  known_limits: typeof COURSE_RUNTIME_V3_KNOWN_LIMITS;
  l1_status: "NOT_READY";
  replay_and_shadow: {
    learning_evidence_excluded_from_truth_hash: true;
    replay_status: RunReplayEvidence["replay_status"];
    replay_writes_formal_results: false;
    shadow_replay_writes_formal_results: false;
  };
  role_scope: {
    denied_operations: CourseRuntimeV3DeniedOperationEvidence[];
    student_private_markers_observed: string[];
    tenant_admin_visible_tenants: string[];
  };
  runtime_chain: typeof COURSE_RUNTIME_V3_REQUIRED_CHAIN;
  state_machine: {
    observed_actions: string[];
    synthetic_course_execution_complete: true;
  };
  student_feedback: {
    next_step_advisory_only: true;
    private_trace_included: false;
    protected_truth_included: false;
  };
}

class CourseRuntimeV3EvidenceError extends Error {
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "CourseRuntimeV3EvidenceError";
  }
}

function assertCondition(condition: boolean, code: string, message: string): void {
  if (!condition) {
    throw new CourseRuntimeV3EvidenceError(code, message);
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function assertIdempotency(evidence: CourseRuntimeV3IdempotencyEvidence): void {
  assertCondition(
    evidence.duplicate_decision_result_stable &&
      evidence.duplicate_round_lock_result_stable &&
      evidence.duplicate_settlement_result_stable &&
      evidence.duplicate_publish_result_stable &&
      !evidence.duplicate_audit_side_effects_detected,
    "COURSE_RUNTIME_V3_IDEMPOTENCY_BOUNDARY_FAILED",
    "Course Runtime V3 requires stable duplicate command results without duplicate audit side effects"
  );
}

function assertDeniedOperations(deniedOperations: CourseRuntimeV3DeniedOperationEvidence[]): void {
  assertCondition(
    deniedOperations.length >= 3,
    "COURSE_RUNTIME_V3_DENIED_OPERATION_EVIDENCE_INSUFFICIENT",
    "Course Runtime V3 requires student lock, cross-team and cross-tenant negative evidence"
  );
  assertCondition(
    deniedOperations.every(
      (operation) => operation.status >= 400 && operation.private_detail_leaked === false
    ),
    "COURSE_RUNTIME_V3_DENIED_OPERATION_LEAK",
    "denied operation evidence must fail closed without private detail leakage"
  );
}

function assertAuditIntegrity(input: CourseRuntimeV3EvidenceInput): string[] {
  assertCondition(
    !input.stateMachineEvidence.duplicate_side_effects_detected,
    "COURSE_RUNTIME_V3_AUDIT_DUPLICATE_SIDE_EFFECT",
    "state machine evidence must not report duplicate side effects"
  );

  const requestIds = input.stateMachineEvidence.transitions.map(
    (transition) => transition.request_id
  );
  assertCondition(
    requestIds.length > 0 && requestIds.every((requestId) => requestId.length > 0),
    "COURSE_RUNTIME_V3_AUDIT_REQUEST_ID_MISSING",
    "all state transition audit events must retain request ids"
  );

  return uniqueSorted(requestIds);
}

export function createCourseRuntimeV3Evidence(
  input: CourseRuntimeV3EvidenceInput
): CourseRuntimeV3Evidence {
  assertIdempotency(input.idempotencyEvidence);
  assertDeniedOperations(input.deniedOperations);
  const observedRequestIds = assertAuditIntegrity(input);

  assertCondition(
    input.runtimeV2Evidence.direct_store_delta === "NONE",
    "COURSE_RUNTIME_V3_DIRECT_STORE_DELTA_DETECTED",
    "Course Runtime V3 must remain direct-store neutral"
  );
  assertCondition(
    input.runtimeV2Evidence.student_negative_visibility.forbidden_markers_observed.length === 0,
    "COURSE_RUNTIME_V3_STUDENT_VISIBILITY_LEAK",
    "student runtime evidence must not expose protected truth markers"
  );
  assertCondition(
    input.replayEvidence.replay_status === "matched" &&
      input.replayEvidence.replay_writes_formal_results === false,
    "COURSE_RUNTIME_V3_REPLAY_BOUNDARY_FAILED",
    "replay evidence must remain matched and non-writing"
  );
  assertCondition(
    input.learningEvidence.excluded_from_truth_hash === true &&
      input.learningEvidence.formal_truth_write === false,
    "COURSE_RUNTIME_V3_LEARNING_EVIDENCE_TRUTH_WRITE",
    "learning evidence must remain outside formal truth"
  );
  assertCondition(
    input.studentFeedback.next_step_suggestion.advisory_only === true &&
      input.studentFeedback.why_it_happened.private_trace_included === false &&
      input.studentFeedback.why_it_happened.protected_truth_included === false,
    "COURSE_RUNTIME_V3_STUDENT_FEEDBACK_SCOPE_DRIFT",
    "student feedback must remain advisory and redacted"
  );

  return {
    audit_integrity: {
      audit_events_have_request_id: true,
      duplicate_audit_side_effects_detected: false,
      observed_request_ids: observedRequestIds
    },
    course_blueprint: {
      course_id: input.blueprint.course_id,
      engine_version: input.blueprint.engine_version,
      mutation_allowed: false,
      parameter_set_id: input.runtimeV2Evidence.parameter_set_id,
      plugin_package_id: input.blueprint.plugin_package_id,
      scenario_package_id: input.runtimeV2Evidence.scenario_package_id,
      seed: input.blueprint.seed
    },
    direct_store_delta: "NONE",
    evidence_kind: "course_runtime_v3_synthetic_execution_evidence",
    evidence_version: "course-runtime-v3.synthetic.v1",
    g0_pass: "NOT_GRANTED",
    g0_status: "EXCEPTION",
    idempotency: input.idempotencyEvidence,
    known_limits: COURSE_RUNTIME_V3_KNOWN_LIMITS,
    l1_status: "NOT_READY",
    replay_and_shadow: {
      learning_evidence_excluded_from_truth_hash: true,
      replay_status: input.replayEvidence.replay_status,
      replay_writes_formal_results: false,
      shadow_replay_writes_formal_results: false
    },
    role_scope: {
      denied_operations: input.deniedOperations,
      student_private_markers_observed:
        input.runtimeV2Evidence.student_negative_visibility.forbidden_markers_observed,
      tenant_admin_visible_tenants:
        input.runtimeV2Evidence.tenant_scope.tenant_admin_visible_tenants
    },
    runtime_chain: COURSE_RUNTIME_V3_REQUIRED_CHAIN,
    state_machine: {
      observed_actions: uniqueSorted(
        input.stateMachineEvidence.transitions.map((transition) => transition.action)
      ),
      synthetic_course_execution_complete: true
    },
    student_feedback: {
      next_step_advisory_only: true,
      private_trace_included: false,
      protected_truth_included: false
    }
  };
}
