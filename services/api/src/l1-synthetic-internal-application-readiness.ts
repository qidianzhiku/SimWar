import {
  COURSE_RUNTIME_V3_REQUIRED_CHAIN,
  type CourseRuntimeV3Evidence
} from "./course-runtime-v3.js";

export const L1_SYNTHETIC_INTERNAL_APPLICATION_REQUIRED_CAPABILITIES = [
  "teacher_course_operations_runtime",
  "student_decision_and_feedback_runtime",
  "tenant_admin_scoped_course_summary",
  "course_blueprint_runtime_binding",
  "scenario_parameter_plugin_seed_provenance",
  "team_role_scope_enforcement",
  "round_lifecycle_and_idempotency",
  "scenario_driven_golden_m1_runtime",
  "teacher_lock_settlement_publish_runtime",
  "student_redacted_three_part_feedback",
  "teacher_replay_evidence_workspace",
  "learning_evidence_ledger_runtime",
  "synthetic_internal_application_harness",
  "course_delivery_audit_and_state_machine_evidence",
  "r8_g1_internal_only_draft_pack"
] as const;

const REQUIRED_DENIED_OPERATIONS = [
  "round.lock",
  "decision.submit.cross_team",
  "result.read.cross_tenant"
] as const;

export type L1SyntheticInternalApplicationCapability =
  (typeof L1_SYNTHETIC_INTERNAL_APPLICATION_REQUIRED_CAPABILITIES)[number];

export interface L1SyntheticInternalApplicationReadinessInput {
  courseRuntimeV3Evidence: CourseRuntimeV3Evidence;
  internalDraftReference: string;
  postMergeEvidence: {
    baseline_validation: "PASSED";
    direct_store_delta: "NONE";
    pr_207_merge_commit: string;
  };
}

export interface L1SyntheticInternalApplicationReadinessReport {
  capability_matrix: Array<{
    capability: L1SyntheticInternalApplicationCapability;
    evidence_label:
      | "COURSE_RUNTIME_V3_SYNTHETIC_EXECUTION"
      | "POST_MERGE_BASELINE"
      | "R8_G1_INTERNAL_DRAFT";
    evidence_present: true;
  }>;
  direct_store_delta: "NONE";
  evidence_kind: "l1_synthetic_internal_application_readiness";
  evidence_version: "l1-synthetic-internal-application-readiness.v1";
  g0_pass: "NOT_GRANTED";
  g0_status: "EXCEPTION";
  independent_evidence_review_required: true;
  internal_draft_reference: string;
  l1_status: "NOT_READY";
  non_proofs: [
    "G0_PASS",
    "L1_READY",
    "PILOT_READY",
    "PRODUCTION_READY",
    "POSTGRESQL_RUNTIME_READY",
    "DURABLE_SETTLEMENT_PROVEN"
  ];
  post_merge_evidence: L1SyntheticInternalApplicationReadinessInput["postMergeEvidence"];
  readiness_boundary: "SYNTHETIC_INTERNAL_ONLY";
  runtime_summary: {
    audit_request_ids_present: true;
    denied_operation_count: number;
    duplicate_command_results_stable: true;
    learning_evidence_excluded_from_truth_hash: true;
    replay_status: "matched";
    student_feedback_redacted: true;
    student_private_markers_observed: [];
    tenant_admin_visible_tenants: string[];
  };
}

class L1SyntheticInternalApplicationReadinessError extends Error {
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "L1SyntheticInternalApplicationReadinessError";
  }
}

function assertCondition(condition: boolean, code: string, message: string): void {
  if (!condition) {
    throw new L1SyntheticInternalApplicationReadinessError(code, message);
  }
}

function assertRuntimeV3Evidence(evidence: CourseRuntimeV3Evidence): void {
  assertCondition(
    evidence.evidence_kind === "course_runtime_v3_synthetic_execution_evidence",
    "L1_INTERNAL_READINESS_WRONG_EVIDENCE_KIND",
    "readiness report must be derived from Course Runtime V3 evidence"
  );
  assertCondition(
    evidence.g0_status === "EXCEPTION" &&
      evidence.g0_pass === "NOT_GRANTED" &&
      evidence.l1_status === "NOT_READY" &&
      evidence.direct_store_delta === "NONE",
    "L1_INTERNAL_READINESS_STATUS_BOUNDARY_DRIFT",
    "readiness report must preserve G0 exception, L1 not-ready and direct-store neutrality"
  );
  assertCondition(
    JSON.stringify(evidence.runtime_chain) === JSON.stringify(COURSE_RUNTIME_V3_REQUIRED_CHAIN),
    "L1_INTERNAL_READINESS_RUNTIME_CHAIN_MISMATCH",
    "Course Runtime V3 runtime chain must remain intact"
  );
  assertCondition(
    evidence.course_blueprint.mutation_allowed === false,
    "L1_INTERNAL_READINESS_BLUEPRINT_MUTABLE",
    "course blueprint binding must remain immutable for the synthetic readiness artifact"
  );

  const deniedOperations = new Set(
    evidence.role_scope.denied_operations.map((operation) => operation.operation)
  );
  for (const operation of REQUIRED_DENIED_OPERATIONS) {
    assertCondition(
      deniedOperations.has(operation),
      "L1_INTERNAL_READINESS_DENIED_OPERATION_MISSING",
      `missing denied operation evidence for ${operation}`
    );
  }
  assertCondition(
    evidence.role_scope.denied_operations.every(
      (operation) => operation.status >= 400 && operation.private_detail_leaked === false
    ),
    "L1_INTERNAL_READINESS_DENIED_OPERATION_LEAK",
    "denied operations must fail closed without private detail leakage"
  );

  assertCondition(
    evidence.role_scope.student_private_markers_observed.length === 0,
    "L1_INTERNAL_READINESS_STUDENT_MARKER_LEAK",
    "student readiness evidence must not expose protected markers"
  );
  assertCondition(
    evidence.role_scope.tenant_admin_visible_tenants.length === 1,
    "L1_INTERNAL_READINESS_TENANT_ADMIN_SCOPE_LEAK",
    "tenant admin readiness evidence must remain scoped to one tenant"
  );
  assertCondition(
    evidence.replay_and_shadow.replay_status === "matched" &&
      evidence.replay_and_shadow.replay_writes_formal_results === false &&
      evidence.replay_and_shadow.shadow_replay_writes_formal_results === false &&
      evidence.replay_and_shadow.learning_evidence_excluded_from_truth_hash === true,
    "L1_INTERNAL_READINESS_REPLAY_BOUNDARY_FAILED",
    "replay, shadow replay and learning evidence must remain non-writing"
  );
  assertCondition(
    evidence.idempotency.duplicate_decision_result_stable &&
      evidence.idempotency.duplicate_round_lock_result_stable &&
      evidence.idempotency.duplicate_settlement_result_stable &&
      evidence.idempotency.duplicate_publish_result_stable &&
      !evidence.idempotency.duplicate_audit_side_effects_detected,
    "L1_INTERNAL_READINESS_IDEMPOTENCY_FAILED",
    "duplicate command evidence must remain stable without duplicate audit side effects"
  );
  assertCondition(
    evidence.audit_integrity.audit_events_have_request_id &&
      !evidence.audit_integrity.duplicate_audit_side_effects_detected &&
      evidence.audit_integrity.observed_request_ids.length > 0,
    "L1_INTERNAL_READINESS_AUDIT_INTEGRITY_FAILED",
    "audit evidence must retain request ids without duplicate side effects"
  );
  assertCondition(
    evidence.student_feedback.next_step_advisory_only &&
      !evidence.student_feedback.private_trace_included &&
      !evidence.student_feedback.protected_truth_included,
    "L1_INTERNAL_READINESS_STUDENT_FEEDBACK_SCOPE_DRIFT",
    "student feedback must remain advisory and redacted"
  );
}

function assertPostMergeEvidence(
  postMergeEvidence: L1SyntheticInternalApplicationReadinessInput["postMergeEvidence"]
): void {
  assertCondition(
    postMergeEvidence.baseline_validation === "PASSED" &&
      postMergeEvidence.direct_store_delta === "NONE" &&
      /^[a-f0-9]{40}$/.test(postMergeEvidence.pr_207_merge_commit),
    "L1_INTERNAL_READINESS_POST_MERGE_EVIDENCE_INVALID",
    "post-merge evidence must include a passing baseline, no direct-store delta and a merge SHA"
  );
}

function buildCapabilityMatrix(): L1SyntheticInternalApplicationReadinessReport["capability_matrix"] {
  return L1_SYNTHETIC_INTERNAL_APPLICATION_REQUIRED_CAPABILITIES.map((capability) => ({
    capability,
    evidence_label:
      capability === "r8_g1_internal_only_draft_pack"
        ? "R8_G1_INTERNAL_DRAFT"
        : capability === "synthetic_internal_application_harness"
          ? "POST_MERGE_BASELINE"
          : "COURSE_RUNTIME_V3_SYNTHETIC_EXECUTION",
    evidence_present: true
  }));
}

export function createL1SyntheticInternalApplicationReadinessReport(
  input: L1SyntheticInternalApplicationReadinessInput
): L1SyntheticInternalApplicationReadinessReport {
  assertRuntimeV3Evidence(input.courseRuntimeV3Evidence);
  assertPostMergeEvidence(input.postMergeEvidence);
  assertCondition(
    input.internalDraftReference.startsWith("docs/operations/") &&
      input.internalDraftReference.includes("l1-synthetic-internal-application-readiness"),
    "L1_INTERNAL_READINESS_DRAFT_REFERENCE_INVALID",
    "readiness report must reference its R8-G1 internal-only draft document"
  );

  return {
    capability_matrix: buildCapabilityMatrix(),
    direct_store_delta: "NONE",
    evidence_kind: "l1_synthetic_internal_application_readiness",
    evidence_version: "l1-synthetic-internal-application-readiness.v1",
    g0_pass: "NOT_GRANTED",
    g0_status: "EXCEPTION",
    independent_evidence_review_required: true,
    internal_draft_reference: input.internalDraftReference,
    l1_status: "NOT_READY",
    non_proofs: [
      "G0_PASS",
      "L1_READY",
      "PILOT_READY",
      "PRODUCTION_READY",
      "POSTGRESQL_RUNTIME_READY",
      "DURABLE_SETTLEMENT_PROVEN"
    ],
    post_merge_evidence: input.postMergeEvidence,
    readiness_boundary: "SYNTHETIC_INTERNAL_ONLY",
    runtime_summary: {
      audit_request_ids_present: true,
      denied_operation_count: input.courseRuntimeV3Evidence.role_scope.denied_operations.length,
      duplicate_command_results_stable: true,
      learning_evidence_excluded_from_truth_hash: true,
      replay_status: "matched",
      student_feedback_redacted: true,
      student_private_markers_observed: [],
      tenant_admin_visible_tenants:
        input.courseRuntimeV3Evidence.role_scope.tenant_admin_visible_tenants
    }
  };
}
