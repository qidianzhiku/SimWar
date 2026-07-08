import {
  COURSE_RUNTIME_V3_REQUIRED_CHAIN,
  type CourseRuntimeV3Evidence
} from "./course-runtime-v3.js";
import type { L1SyntheticInternalApplicationReadinessReport } from "./l1-synthetic-internal-application-readiness.js";

const REQUIRED_DENIED_OPERATIONS = [
  "round.lock",
  "decision.submit.cross_team",
  "result.read.cross_tenant"
] as const;

const REQUIRED_RUNTIME_ACTIONS = [
  "course.publish",
  "decision.submit",
  "round.lock",
  "round.settle_requested",
  "round.publish"
] as const;

export const L1_GOLDEN_M1_COURSE_RUNTIME_CHAIN = [
  "teacher.course_draft",
  "scenario_asset.approved_frozen",
  "parameter_set_plugin_seed.bound",
  ...COURSE_RUNTIME_V3_REQUIRED_CHAIN,
  "learning_evidence.ledger",
  "r8_g1.internal_only_draft_pack",
  "r4_discovery.read_only_update"
] as const;

export const L1_GOLDEN_M1_COURSE_RUNTIME_NON_PROOFS = [
  "G0_PASS",
  "L1_READY",
  "PILOT_READY",
  "PRODUCTION_READY",
  "POSTGRESQL_RUNTIME_READY",
  "DURABLE_SETTLEMENT_PROVEN"
] as const;

export type L1GoldenM1EvidenceLabel =
  | "POSTMERGE_MASTER_EVIDENCE"
  | "GRAPHIFY_PREFLIGHT_EVIDENCE"
  | "CODEGRAPH_EVIDENCE"
  | "INTEGRATION_TEST_EVIDENCE"
  | "R8_G1_DRAFT_EVIDENCE"
  | "R4_DISCOVERY_EVIDENCE";

export type L1GoldenM1Gate = "G0" | "G1" | "G2" | "G3" | "G4" | "G5" | "G6" | "G7";

export interface L1GoldenM1CourseRuntimeConsolidationInput {
  courseRuntimeV3Evidence: CourseRuntimeV3Evidence;
  r4DiscoveryReference: string;
  r8G1DraftPackReferences: string[];
  readinessReport: L1SyntheticInternalApplicationReadinessReport;
  sourceEvidence: {
    codegraph_query: "CODEGRAPH_EVIDENCE";
    graphify_preflight: "GRAPHIFY_PREFLIGHT_EVIDENCE";
    post_merge_baseline: "POSTMERGE_MASTER_EVIDENCE";
    pr_208_merge_commit: string;
  };
}

export interface L1GoldenM1CourseRuntimeConsolidationReport {
  direct_store_delta: "NONE";
  evidence_kind: "l1_golden_m1_course_runtime_consolidation";
  evidence_version: "l1-golden-m1-course-runtime-consolidation.v1";
  g0_g7_evidence: Array<{
    capability: string;
    evidence_label: L1GoldenM1EvidenceLabel;
    gate: L1GoldenM1Gate;
    status: "CURRENT_EVIDENCE_PRESENT" | "BOUNDARY_HELD";
  }>;
  g0_pass: "NOT_GRANTED";
  g0_status: "EXCEPTION";
  independent_evidence_review_required: true;
  l1_status: "NOT_READY";
  non_proofs: typeof L1_GOLDEN_M1_COURSE_RUNTIME_NON_PROOFS;
  r4_discovery: {
    reference: string;
    r4_macro_authorized: false;
    status: "READ_ONLY_ONLY";
  };
  r8_g1_draft_pack: {
    release_authorized: false;
    references: string[];
    status: "INTERNAL_ONLY_DRAFT_NOT_RELEASED";
  };
  replay_and_shadow: {
    learning_evidence_excluded_from_truth_hash: true;
    repeated_settlement_overwrites_official_result: false;
    replay_status: "matched";
    replay_writes_formal_results: false;
    shadow_replay_writes_formal_results: false;
  };
  runtime_chain: typeof L1_GOLDEN_M1_COURSE_RUNTIME_CHAIN;
  source_evidence: L1GoldenM1CourseRuntimeConsolidationInput["sourceEvidence"];
  student_decision_and_feedback: {
    decision_submit_observed: true;
    redacted_result_observed: true;
    three_part_feedback_observed: true;
  };
  teacher_course_operations: {
    audit_request_ids_present: true;
    course_publish_observed: true;
    teacher_lock_settle_publish_observed: true;
  };
  tenant_admin_scope: {
    cross_tenant_denial_observed: true;
    platform_admin_explicit_authority_required: true;
    visible_tenants: string[];
  };
}

class L1GoldenM1CourseRuntimeConsolidationError extends Error {
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "L1GoldenM1CourseRuntimeConsolidationError";
  }
}

function assertCondition(condition: boolean, code: string, message: string): void {
  if (!condition) {
    throw new L1GoldenM1CourseRuntimeConsolidationError(code, message);
  }
}

function includesAll(values: readonly string[], required: readonly string[]): boolean {
  return required.every((item) => values.includes(item));
}

function assertRuntimeEvidence(evidence: CourseRuntimeV3Evidence): void {
  assertCondition(
    evidence.evidence_kind === "course_runtime_v3_synthetic_execution_evidence" &&
      evidence.direct_store_delta === "NONE" &&
      evidence.g0_status === "EXCEPTION" &&
      evidence.g0_pass === "NOT_GRANTED" &&
      evidence.l1_status === "NOT_READY",
    "L1_GOLDEN_M1_RUNTIME_STATUS_BOUNDARY_DRIFT",
    "consolidation must preserve Runtime V3 synthetic-only status boundaries"
  );
  assertCondition(
    JSON.stringify(evidence.runtime_chain) === JSON.stringify(COURSE_RUNTIME_V3_REQUIRED_CHAIN),
    "L1_GOLDEN_M1_RUNTIME_CHAIN_MISMATCH",
    "consolidation must consume the complete Course Runtime V3 chain"
  );
  assertCondition(
    evidence.course_blueprint.mutation_allowed === false,
    "L1_GOLDEN_M1_BLUEPRINT_MUTABLE",
    "course blueprint and scenario binding must remain immutable"
  );
  assertCondition(
    evidence.role_scope.student_private_markers_observed.length === 0,
    "L1_GOLDEN_M1_STUDENT_VISIBILITY_LEAK",
    "student-facing evidence must not expose protected truth, replay or private markers"
  );
  assertCondition(
    evidence.role_scope.tenant_admin_visible_tenants.length === 1,
    "L1_GOLDEN_M1_TENANT_ADMIN_SCOPE_LEAK",
    "tenant admin evidence must remain scoped to a single tenant"
  );

  const deniedOperations = evidence.role_scope.denied_operations.map(
    (operation) => operation.operation
  );
  assertCondition(
    includesAll(deniedOperations, REQUIRED_DENIED_OPERATIONS),
    "L1_GOLDEN_M1_DENIED_OPERATION_MISSING",
    "consolidation requires student lock, cross-team and cross-tenant denial evidence"
  );
  assertCondition(
    evidence.role_scope.denied_operations.every(
      (operation) => operation.status >= 400 && operation.private_detail_leaked === false
    ),
    "L1_GOLDEN_M1_DENIED_OPERATION_LEAK",
    "denied operations must fail closed without private detail leakage"
  );

  assertCondition(
    includesAll(evidence.state_machine.observed_actions, REQUIRED_RUNTIME_ACTIONS) &&
      evidence.state_machine.synthetic_course_execution_complete,
    "L1_GOLDEN_M1_STATE_MACHINE_INCOMPLETE",
    "course publish, decision, lock, settle and publish actions must be present"
  );
  assertCondition(
    evidence.idempotency.duplicate_decision_result_stable &&
      evidence.idempotency.duplicate_round_lock_result_stable &&
      evidence.idempotency.duplicate_settlement_result_stable &&
      evidence.idempotency.duplicate_publish_result_stable &&
      !evidence.idempotency.duplicate_audit_side_effects_detected,
    "L1_GOLDEN_M1_IDEMPOTENCY_FAILED",
    "duplicate command evidence must remain stable without duplicate audit side effects"
  );
  assertCondition(
    evidence.audit_integrity.audit_events_have_request_id &&
      !evidence.audit_integrity.duplicate_audit_side_effects_detected &&
      evidence.audit_integrity.observed_request_ids.length > 0,
    "L1_GOLDEN_M1_AUDIT_INTEGRITY_FAILED",
    "audit events must retain request ids and avoid duplicate side effects"
  );
  assertCondition(
    evidence.replay_and_shadow.replay_status === "matched" &&
      evidence.replay_and_shadow.replay_writes_formal_results === false &&
      evidence.replay_and_shadow.shadow_replay_writes_formal_results === false &&
      evidence.replay_and_shadow.learning_evidence_excluded_from_truth_hash,
    "L1_GOLDEN_M1_REPLAY_BOUNDARY_FAILED",
    "replay, shadow replay and learning evidence must remain non-writing"
  );
  assertCondition(
    evidence.student_feedback.next_step_advisory_only &&
      !evidence.student_feedback.private_trace_included &&
      !evidence.student_feedback.protected_truth_included,
    "L1_GOLDEN_M1_FEEDBACK_SCOPE_DRIFT",
    "student feedback must stay advisory and redacted"
  );
}

function assertReadinessReport(
  readinessReport: L1SyntheticInternalApplicationReadinessReport,
  runtimeEvidence: CourseRuntimeV3Evidence
): void {
  assertCondition(
    readinessReport.evidence_kind === "l1_synthetic_internal_application_readiness" &&
      readinessReport.direct_store_delta === "NONE" &&
      readinessReport.g0_status === "EXCEPTION" &&
      readinessReport.g0_pass === "NOT_GRANTED" &&
      readinessReport.l1_status === "NOT_READY" &&
      readinessReport.independent_evidence_review_required,
    "L1_GOLDEN_M1_READINESS_BOUNDARY_DRIFT",
    "readiness report must preserve synthetic-only G0 and L1 boundaries"
  );
  assertCondition(
    readinessReport.runtime_summary.replay_status ===
      runtimeEvidence.replay_and_shadow.replay_status &&
      readinessReport.runtime_summary.student_private_markers_observed.length === 0 &&
      readinessReport.runtime_summary.tenant_admin_visible_tenants.length === 1,
    "L1_GOLDEN_M1_READINESS_RUNTIME_MISMATCH",
    "readiness summary must match Runtime V3 replay, student and tenant boundaries"
  );
}

function assertReferences(input: L1GoldenM1CourseRuntimeConsolidationInput): void {
  assertCondition(
    input.r4DiscoveryReference === "docs/architecture/r4-discovery-parity-gap-directory.md",
    "L1_GOLDEN_M1_R4_DISCOVERY_REFERENCE_INVALID",
    "consolidation must reference the existing R4 Discovery document"
  );
  assertCondition(
    input.r8G1DraftPackReferences.length >= 4 &&
      input.r8G1DraftPackReferences.every((reference) => reference.startsWith("docs/operations/")),
    "L1_GOLDEN_M1_R8_G1_DRAFT_PACK_INCOMPLETE",
    "consolidation requires the internal-only R8-G1 operations draft pack"
  );
  assertCondition(
    /^[a-f0-9]{40}$/.test(input.sourceEvidence.pr_208_merge_commit),
    "L1_GOLDEN_M1_PR208_MERGE_COMMIT_INVALID",
    "source evidence must include the PR #208 merge commit"
  );
}

function buildG0G7Evidence(): L1GoldenM1CourseRuntimeConsolidationReport["g0_g7_evidence"] {
  return [
    {
      capability: "post-merge quality baseline and ordinary merge discipline",
      evidence_label: "POSTMERGE_MASTER_EVIDENCE",
      gate: "G0",
      status: "BOUNDARY_HELD"
    },
    {
      capability: "runtime configuration remains JSON-only and internal synthetic",
      evidence_label: "INTEGRATION_TEST_EVIDENCE",
      gate: "G1",
      status: "CURRENT_EVIDENCE_PRESENT"
    },
    {
      capability: "teacher, student and tenant-admin scope boundaries",
      evidence_label: "INTEGRATION_TEST_EVIDENCE",
      gate: "G2",
      status: "CURRENT_EVIDENCE_PRESENT"
    },
    {
      capability: "student projection remains redacted with negative visibility guard",
      evidence_label: "INTEGRATION_TEST_EVIDENCE",
      gate: "G3",
      status: "CURRENT_EVIDENCE_PRESENT"
    },
    {
      capability: "Golden M1 course runtime chain is synthetic and scenario-driven",
      evidence_label: "INTEGRATION_TEST_EVIDENCE",
      gate: "G4",
      status: "CURRENT_EVIDENCE_PRESENT"
    },
    {
      capability: "replay and shadow replay evidence are non-writing",
      evidence_label: "INTEGRATION_TEST_EVIDENCE",
      gate: "G5",
      status: "CURRENT_EVIDENCE_PRESENT"
    },
    {
      capability: "duplicate commands remain stable without overwriting official results",
      evidence_label: "INTEGRATION_TEST_EVIDENCE",
      gate: "G6",
      status: "CURRENT_EVIDENCE_PRESENT"
    },
    {
      capability: "teacher kit and operator materials remain internal-only drafts",
      evidence_label: "R8_G1_DRAFT_EVIDENCE",
      gate: "G7",
      status: "BOUNDARY_HELD"
    }
  ];
}

export function createL1GoldenM1CourseRuntimeConsolidationReport(
  input: L1GoldenM1CourseRuntimeConsolidationInput
): L1GoldenM1CourseRuntimeConsolidationReport {
  assertRuntimeEvidence(input.courseRuntimeV3Evidence);
  assertReadinessReport(input.readinessReport, input.courseRuntimeV3Evidence);
  assertReferences(input);

  return {
    direct_store_delta: "NONE",
    evidence_kind: "l1_golden_m1_course_runtime_consolidation",
    evidence_version: "l1-golden-m1-course-runtime-consolidation.v1",
    g0_g7_evidence: buildG0G7Evidence(),
    g0_pass: "NOT_GRANTED",
    g0_status: "EXCEPTION",
    independent_evidence_review_required: true,
    l1_status: "NOT_READY",
    non_proofs: L1_GOLDEN_M1_COURSE_RUNTIME_NON_PROOFS,
    r4_discovery: {
      r4_macro_authorized: false,
      reference: input.r4DiscoveryReference,
      status: "READ_ONLY_ONLY"
    },
    r8_g1_draft_pack: {
      references: input.r8G1DraftPackReferences,
      release_authorized: false,
      status: "INTERNAL_ONLY_DRAFT_NOT_RELEASED"
    },
    replay_and_shadow: {
      learning_evidence_excluded_from_truth_hash: true,
      repeated_settlement_overwrites_official_result: false,
      replay_status: "matched",
      replay_writes_formal_results: false,
      shadow_replay_writes_formal_results: false
    },
    runtime_chain: L1_GOLDEN_M1_COURSE_RUNTIME_CHAIN,
    source_evidence: input.sourceEvidence,
    student_decision_and_feedback: {
      decision_submit_observed: true,
      redacted_result_observed: true,
      three_part_feedback_observed: true
    },
    teacher_course_operations: {
      audit_request_ids_present: true,
      course_publish_observed: true,
      teacher_lock_settle_publish_observed: true
    },
    tenant_admin_scope: {
      cross_tenant_denial_observed: true,
      platform_admin_explicit_authority_required: true,
      visible_tenants: input.courseRuntimeV3Evidence.role_scope.tenant_admin_visible_tenants
    }
  };
}
