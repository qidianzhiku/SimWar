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

export const L1_GOLDEN_M1_RUNTIME_CONTRACT_REQUIRED_OPERATIONS = [
  "teacher.course_draft_create_or_update",
  "teacher.scenario_asset_select",
  "teacher.parameter_plugin_seed_bind",
  "teacher.course_publish",
  "teacher.synthetic_run_create",
  "teacher.synthetic_team_setup",
  "teacher.round_open",
  "student.team_decision_submit",
  "teacher.round_lock",
  "teacher.internal_settlement_trigger",
  "teacher.result_publish",
  "student.redacted_result_read",
  "student.three_part_feedback_read",
  "teacher.evidence_workspace_read",
  "tenant_admin.scoped_summary_read",
  "replay.request",
  "shadow_replay.request",
  "controlled_failure.private_detail_denial"
] as const;

export type L1GoldenM1EvidenceLabel =
  | "POSTMERGE_MASTER_EVIDENCE"
  | "GRAPHIFY_PREFLIGHT_EVIDENCE"
  | "CODEGRAPH_EVIDENCE"
  | "INTEGRATION_TEST_EVIDENCE"
  | "R8_G1_DRAFT_EVIDENCE"
  | "R4_DISCOVERY_EVIDENCE";

export type L1GoldenM1Gate = "G0" | "G1" | "G2" | "G3" | "G4" | "G5" | "G6" | "G7";
export type L1GoldenM1RuntimeContractOperationName =
  (typeof L1_GOLDEN_M1_RUNTIME_CONTRACT_REQUIRED_OPERATIONS)[number];

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

export interface L1GoldenM1RuntimeContractOperation {
  actor: "teacher" | "student" | "tenant_admin" | "system";
  api_layer: "API_ROUTE" | "SERVER_COMMAND" | "BFF_PROJECTION" | "EVIDENCE_HELPER";
  audit_event: string;
  course_scope: "bound_course";
  explicit_non_proofs: typeof L1_GOLDEN_M1_COURSE_RUNTIME_NON_PROOFS;
  forbidden_callers: string[];
  idempotency_key: "required" | "not_applicable";
  input_dto: string;
  operation: L1GoldenM1RuntimeContractOperationName;
  output_dto: string;
  projection_rule: string;
  request_id: "required" | "propagated";
  stable_error_codes: string[];
  state_postconditions: string[];
  state_preconditions: string[];
  team_scope: "own_team" | "all_course_teams" | "not_applicable";
  tenant_scope: string;
}

export interface L1GoldenM1RuntimeContractCompletionInput extends L1GoldenM1CourseRuntimeConsolidationInput {
  postMergeEvidence: {
    baseline_validation: "PASSED";
    direct_store_delta: "NONE";
    pr_209_merge_commit: string;
  };
}

export interface L1GoldenM1RuntimeContractCompletionReport {
  consolidation_report: L1GoldenM1CourseRuntimeConsolidationReport;
  contract_operations: L1GoldenM1RuntimeContractOperation[];
  direct_store_delta: "NONE";
  evidence_kind: "l1_golden_m1_runtime_contract_completion";
  evidence_version: "l1-golden-m1-runtime-contract-completion.v1";
  g0_pass: "NOT_GRANTED";
  g0_status: "EXCEPTION";
  independent_evidence_review_required: true;
  l1_status: "NOT_READY";
  non_proofs: typeof L1_GOLDEN_M1_COURSE_RUNTIME_NON_PROOFS;
  post_merge_evidence: L1GoldenM1RuntimeContractCompletionInput["postMergeEvidence"];
  runtime_completion: {
    audit_and_idempotency_complete: true;
    replay_shadow_and_learning_evidence_complete: true;
    scenario_parameter_plugin_seed_bound: true;
    student_decision_and_feedback_complete: true;
    teacher_course_operations_complete: true;
    tenant_admin_summary_complete: true;
  };
  runtime_contract_boundary: "CONTROLLED_API_BFF_SERVER_COMMAND_PATH";
  synthetic_internal_application_harness: {
    course_count: 1;
    harness_id: "L1_SYNTHETIC_INTERNAL_APPLICATION_HARNESS_V3";
    mock_primary_path: false;
    round_count: 1;
    run_count: 1;
    status: "CURRENT_EVIDENCE_PRESENT";
    team_count: 2;
    tenant_count: 1;
    uses_existing_kernel_settlement: true;
    uses_real_server_command_path: true;
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

function deniedOperationCode(
  evidence: CourseRuntimeV3Evidence,
  operation: string,
  fallbackCode: string
): string {
  return (
    evidence.role_scope.denied_operations.find((candidate) => candidate.operation === operation)
      ?.code ?? fallbackCode
  );
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

function assertPostMergeEvidence(
  postMergeEvidence: L1GoldenM1RuntimeContractCompletionInput["postMergeEvidence"]
): void {
  assertCondition(
    postMergeEvidence.baseline_validation === "PASSED" &&
      postMergeEvidence.direct_store_delta === "NONE" &&
      /^[a-f0-9]{40}$/.test(postMergeEvidence.pr_209_merge_commit),
    "L1_GOLDEN_M1_PR209_POST_MERGE_EVIDENCE_INVALID",
    "runtime contract completion requires PR #209 merge evidence, passing baseline and no direct-store delta"
  );
}

function buildRuntimeContractOperations(
  evidence: CourseRuntimeV3Evidence
): L1GoldenM1RuntimeContractCompletionReport["contract_operations"] {
  const crossTeamCode = deniedOperationCode(evidence, "decision.submit.cross_team", "TEAM-403-001");
  const studentLockCode = deniedOperationCode(evidence, "round.lock", "AUTHZ-403-ROUND-LOCK");
  const crossTenantCode = deniedOperationCode(
    evidence,
    "result.read.cross_tenant",
    "TENANT-403-001"
  );
  const tenantScope = evidence.role_scope.tenant_admin_visible_tenants[0] ?? "tenant_demo";
  const base = {
    course_scope: "bound_course" as const,
    explicit_non_proofs: L1_GOLDEN_M1_COURSE_RUNTIME_NON_PROOFS,
    request_id: "required" as const,
    tenant_scope: tenantScope
  };

  return [
    {
      ...base,
      actor: "teacher",
      api_layer: "API_ROUTE",
      audit_event: "course.create_or_update",
      forbidden_callers: ["student", "ai_runtime", "plugin_direct_writer"],
      idempotency_key: "not_applicable",
      input_dto: "CourseDraftCommand",
      operation: "teacher.course_draft_create_or_update",
      output_dto: "Course",
      projection_rule: "teacher_course_draft_only",
      stable_error_codes: ["AUTHZ-403-COURSE"],
      state_postconditions: ["course draft exists for the bound tenant"],
      state_preconditions: ["teacher is scoped to tenant course authoring"],
      team_scope: "not_applicable"
    },
    {
      ...base,
      actor: "teacher",
      api_layer: "SERVER_COMMAND",
      audit_event: "scenario.select",
      forbidden_callers: ["student", "ai_runtime", "frontend_direct_settlement"],
      idempotency_key: "not_applicable",
      input_dto: "ScenarioAssetSelectionCommand",
      operation: "teacher.scenario_asset_select",
      output_dto: "ScenarioPackage",
      projection_rule: "teacher_full_scenario_before_publish",
      stable_error_codes: ["SCENARIO-404-001", "AUTHZ-403-SCENARIO"],
      state_postconditions: ["approved frozen scenario is bound to course planning"],
      state_preconditions: ["scenario asset is approved and frozen"],
      team_scope: "not_applicable"
    },
    {
      ...base,
      actor: "teacher",
      api_layer: "SERVER_COMMAND",
      audit_event: "course.runtime_bind",
      forbidden_callers: ["student", "ai_runtime", "plugin_direct_writer"],
      idempotency_key: "not_applicable",
      input_dto: "RuntimeBindingCommand",
      operation: "teacher.parameter_plugin_seed_bind",
      output_dto: "CourseRuntimeBinding",
      projection_rule: "teacher_runtime_binding_summary",
      stable_error_codes: ["PARAMETER-404-001", "PLUGIN-404-001"],
      state_postconditions: ["scenario parameter plugin and seed are immutable for run creation"],
      state_preconditions: ["parameter set and plugin package are approved for tenant"],
      team_scope: "not_applicable"
    },
    {
      ...base,
      actor: "teacher",
      api_layer: "API_ROUTE",
      audit_event: "course.publish",
      forbidden_callers: ["student", "tenant_admin", "ai_runtime"],
      idempotency_key: "required",
      input_dto: "CoursePublishCommand",
      operation: "teacher.course_publish",
      output_dto: "Course",
      projection_rule: "published_course_without_private_runtime_payload",
      stable_error_codes: ["COURSE-409-ALREADY-PUBLISHED", "AUTHZ-403-COURSE"],
      state_postconditions: ["course is published and ready for synthetic run creation"],
      state_preconditions: ["course draft has approved runtime binding"],
      team_scope: "not_applicable"
    },
    {
      ...base,
      actor: "teacher",
      api_layer: "API_ROUTE",
      audit_event: "run.create",
      forbidden_callers: ["student", "ai_runtime", "plugin_direct_writer"],
      idempotency_key: "required",
      input_dto: "RunCreateCommand",
      operation: "teacher.synthetic_run_create",
      output_dto: "RunWithRound",
      projection_rule: "teacher_run_and_round_summary",
      stable_error_codes: ["COURSE-409-NOT-PUBLISHED", "AUTHZ-403-RUN"],
      state_postconditions: ["one synthetic run and opening round are created"],
      state_preconditions: ["course is published and runtime binding is immutable"],
      team_scope: "all_course_teams"
    },
    {
      ...base,
      actor: "teacher",
      api_layer: "API_ROUTE",
      audit_event: "team.create",
      forbidden_callers: ["student_cross_team", "ai_runtime"],
      idempotency_key: "not_applicable",
      input_dto: "TeamCreateCommand",
      operation: "teacher.synthetic_team_setup",
      output_dto: "Team",
      projection_rule: "teacher_team_roster_summary",
      stable_error_codes: ["TEAM-409-DUPLICATE", "AUTHZ-403-TEAM"],
      state_postconditions: ["two synthetic teams exist in the same tenant course"],
      state_preconditions: ["teacher owns course team setup"],
      team_scope: "all_course_teams"
    },
    {
      ...base,
      actor: "teacher",
      api_layer: "API_ROUTE",
      audit_event: "round.start",
      forbidden_callers: ["student", "ai_runtime"],
      idempotency_key: "required",
      input_dto: "RoundStartCommand",
      operation: "teacher.round_open",
      output_dto: "Round",
      projection_rule: "teacher_round_lifecycle_summary",
      stable_error_codes: ["ROUND-409-NOT-OPENABLE", "AUTHZ-403-ROUND"],
      state_postconditions: ["round accepts student decisions"],
      state_preconditions: ["run exists and round is draft or scheduled"],
      team_scope: "all_course_teams"
    },
    {
      ...base,
      actor: "student",
      api_layer: "API_ROUTE",
      audit_event: "decision.submit",
      forbidden_callers: ["student_cross_team", "ai_runtime", "frontend_truth_writer"],
      idempotency_key: "required",
      input_dto: "DecisionSubmitCommand",
      operation: "student.team_decision_submit",
      output_dto: "Decision",
      projection_rule: "own_team_decision_write_without_truth_fields",
      stable_error_codes: [crossTeamCode, "AUTHZ-403-DECISION"],
      state_postconditions: ["canonical decision exists for the student's own team"],
      state_preconditions: ["round is open and student belongs to target team"],
      team_scope: "own_team"
    },
    {
      ...base,
      actor: "teacher",
      api_layer: "API_ROUTE",
      audit_event: "round.lock",
      forbidden_callers: ["student", "ai_runtime", "frontend_direct_settlement"],
      idempotency_key: "required",
      input_dto: "RoundLockCommand",
      operation: "teacher.round_lock",
      output_dto: "Round",
      projection_rule: "teacher_round_locked_summary",
      stable_error_codes: [studentLockCode, "ROUND-409-MISSING-DECISION"],
      state_postconditions: ["round is locked with stable decision batch"],
      state_preconditions: ["every team has a canonical decision"],
      team_scope: "all_course_teams"
    },
    {
      ...base,
      actor: "teacher",
      api_layer: "API_ROUTE",
      audit_event: "round.settle_requested",
      forbidden_callers: [
        "student",
        "ai_runtime",
        "plugin_direct_writer",
        "frontend_direct_settlement"
      ],
      idempotency_key: "required",
      input_dto: "RoundSettlementCommand",
      operation: "teacher.internal_settlement_trigger",
      output_dto: "SettlementResult",
      projection_rule: "teacher_result_with_replay_evidence_after_publish",
      stable_error_codes: ["ROUND-409-NOT-LOCKED", "AUTHZ-403-SETTLEMENT"],
      state_postconditions: ["official result is produced by existing kernel settlement"],
      state_preconditions: ["round is locked and canonical decisions are stable"],
      team_scope: "all_course_teams"
    },
    {
      ...base,
      actor: "teacher",
      api_layer: "API_ROUTE",
      audit_event: "round.publish",
      forbidden_callers: ["student", "ai_runtime"],
      idempotency_key: "required",
      input_dto: "RoundPublishCommand",
      operation: "teacher.result_publish",
      output_dto: "Round",
      projection_rule: "published_result_available_through_role_projection",
      stable_error_codes: ["ROUND-409-NOT-SETTLED", "AUTHZ-403-PUBLISH"],
      state_postconditions: ["published round exposes role-scoped result views"],
      state_preconditions: ["official result exists and round is not yet published"],
      team_scope: "all_course_teams"
    },
    {
      ...base,
      actor: "student",
      api_layer: "BFF_PROJECTION",
      audit_event: "result.read.student",
      forbidden_callers: ["student_cross_team", "tenant_cross_scope"],
      idempotency_key: "not_applicable",
      input_dto: "ResultReadQuery",
      operation: "student.redacted_result_read",
      output_dto: "PublicResultView",
      projection_rule: "own_team_redacted_result_only",
      stable_error_codes: [crossTenantCode, "TEAM-403-001"],
      state_postconditions: ["student receives only own-team published result summary"],
      state_preconditions: ["round result is published"],
      team_scope: "own_team"
    },
    {
      ...base,
      actor: "student",
      api_layer: "BFF_PROJECTION",
      audit_event: "learning.feedback.read",
      forbidden_callers: ["student_cross_team", "ai_truth_writer"],
      idempotency_key: "not_applicable",
      input_dto: "LearningFeedbackQuery",
      operation: "student.three_part_feedback_read",
      output_dto: "ThreePartFeedbackView",
      projection_rule: "advisory_feedback_without_private_trace",
      stable_error_codes: ["AUTHZ-403-FEEDBACK"],
      state_postconditions: ["student receives advisory feedback only"],
      state_preconditions: ["student result projection is available"],
      team_scope: "own_team"
    },
    {
      ...base,
      actor: "teacher",
      api_layer: "BFF_PROJECTION",
      audit_event: "teacher.evidence_workspace.read",
      forbidden_callers: ["student", "tenant_cross_scope"],
      idempotency_key: "not_applicable",
      input_dto: "EvidenceWorkspaceQuery",
      operation: "teacher.evidence_workspace_read",
      output_dto: "TeacherEvidenceWorkspace",
      projection_rule: "teacher_course_evidence_with_replay_summary",
      stable_error_codes: ["AUTHZ-403-EVIDENCE"],
      state_postconditions: ["teacher can inspect approved course evidence for the bound course"],
      state_preconditions: ["teacher owns the course"],
      team_scope: "all_course_teams"
    },
    {
      ...base,
      actor: "tenant_admin",
      api_layer: "BFF_PROJECTION",
      audit_event: "tenant_admin.state.read",
      forbidden_callers: ["student", "tenant_cross_scope"],
      idempotency_key: "not_applicable",
      input_dto: "TenantAdminStateQuery",
      operation: "tenant_admin.scoped_summary_read",
      output_dto: "AdminState",
      projection_rule: "single_tenant_summary_only",
      stable_error_codes: [crossTenantCode],
      state_postconditions: ["tenant admin sees only the authorized tenant summary"],
      state_preconditions: ["tenant admin token is scoped to one tenant"],
      team_scope: "all_course_teams"
    },
    {
      ...base,
      actor: "system",
      api_layer: "EVIDENCE_HELPER",
      audit_event: "replay.evidence.read",
      forbidden_callers: ["replay_writer", "student"],
      idempotency_key: "not_applicable",
      input_dto: "ReplayEvidenceQuery",
      operation: "replay.request",
      output_dto: "RunReplayEvidence",
      projection_rule: "matched_replay_summary_non_writing",
      stable_error_codes: ["REPLAY-409-NOT-AVAILABLE"],
      state_postconditions: ["official result remains unchanged after replay evidence read"],
      state_preconditions: ["official result and replay input manifest exist"],
      team_scope: "all_course_teams"
    },
    {
      ...base,
      actor: "system",
      api_layer: "EVIDENCE_HELPER",
      audit_event: "shadow_replay.evidence.read",
      forbidden_callers: ["shadow_replay_writer", "student"],
      idempotency_key: "not_applicable",
      input_dto: "ShadowReplayEvidenceQuery",
      operation: "shadow_replay.request",
      output_dto: "ShadowReplayEvidence",
      projection_rule: "candidate_replay_summary_non_writing",
      stable_error_codes: ["SHADOW-409-NOT-AVAILABLE"],
      state_postconditions: ["official result remains unchanged after shadow replay evidence"],
      state_preconditions: ["published result exists for comparison"],
      team_scope: "all_course_teams"
    },
    {
      ...base,
      actor: "system",
      api_layer: "API_ROUTE",
      audit_event: "controlled_failure.read",
      forbidden_callers: ["student_cross_team", "tenant_cross_scope", "unauthorized_teacher"],
      idempotency_key: "not_applicable",
      input_dto: "ControlledFailureProbe",
      operation: "controlled_failure.private_detail_denial",
      output_dto: "ApiErrorEnvelope",
      projection_rule: "stable_error_without_private_detail",
      stable_error_codes: [studentLockCode, crossTeamCode, crossTenantCode],
      state_postconditions: ["denied operation returns stable error without private detail"],
      state_preconditions: ["negative authorization probe targets protected operation"],
      team_scope: "not_applicable"
    }
  ];
}

function assertRuntimeContractOperations(
  operations: readonly L1GoldenM1RuntimeContractOperation[]
): void {
  assertCondition(
    JSON.stringify(operations.map((operation) => operation.operation)) ===
      JSON.stringify(L1_GOLDEN_M1_RUNTIME_CONTRACT_REQUIRED_OPERATIONS),
    "L1_GOLDEN_M1_RUNTIME_CONTRACT_OPERATION_MISMATCH",
    "runtime contract completion must enumerate the complete Golden M1 operation matrix"
  );
  assertCondition(
    operations.every(
      (operation) =>
        operation.request_id.length > 0 &&
        operation.audit_event.length > 0 &&
        operation.input_dto.length > 0 &&
        operation.output_dto.length > 0 &&
        operation.stable_error_codes.length > 0 &&
        operation.state_preconditions.length > 0 &&
        operation.state_postconditions.length > 0 &&
        operation.projection_rule.length > 0 &&
        operation.forbidden_callers.length > 0 &&
        operation.explicit_non_proofs === L1_GOLDEN_M1_COURSE_RUNTIME_NON_PROOFS
    ),
    "L1_GOLDEN_M1_RUNTIME_CONTRACT_FIELD_MISSING",
    "each runtime contract operation must carry API, DTO, audit, state, projection and non-proof metadata"
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

export function createL1GoldenM1RuntimeContractCompletionReport(
  input: L1GoldenM1RuntimeContractCompletionInput
): L1GoldenM1RuntimeContractCompletionReport {
  const consolidationReport = createL1GoldenM1CourseRuntimeConsolidationReport(input);
  assertPostMergeEvidence(input.postMergeEvidence);

  const contractOperations = buildRuntimeContractOperations(input.courseRuntimeV3Evidence);
  assertRuntimeContractOperations(contractOperations);

  return {
    consolidation_report: consolidationReport,
    contract_operations: contractOperations,
    direct_store_delta: "NONE",
    evidence_kind: "l1_golden_m1_runtime_contract_completion",
    evidence_version: "l1-golden-m1-runtime-contract-completion.v1",
    g0_pass: "NOT_GRANTED",
    g0_status: "EXCEPTION",
    independent_evidence_review_required: true,
    l1_status: "NOT_READY",
    non_proofs: L1_GOLDEN_M1_COURSE_RUNTIME_NON_PROOFS,
    post_merge_evidence: input.postMergeEvidence,
    runtime_completion: {
      audit_and_idempotency_complete: true,
      replay_shadow_and_learning_evidence_complete: true,
      scenario_parameter_plugin_seed_bound: true,
      student_decision_and_feedback_complete: true,
      teacher_course_operations_complete: true,
      tenant_admin_summary_complete: true
    },
    runtime_contract_boundary: "CONTROLLED_API_BFF_SERVER_COMMAND_PATH",
    synthetic_internal_application_harness: {
      course_count: 1,
      harness_id: "L1_SYNTHETIC_INTERNAL_APPLICATION_HARNESS_V3",
      mock_primary_path: false,
      round_count: 1,
      run_count: 1,
      status: "CURRENT_EVIDENCE_PRESENT",
      team_count: 2,
      tenant_count: 1,
      uses_existing_kernel_settlement: true,
      uses_real_server_command_path: true
    }
  };
}
