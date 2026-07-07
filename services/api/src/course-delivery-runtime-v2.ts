import type {
  AdminState,
  Course,
  Decision,
  PublicResultView,
  Run,
  RunReplayEvidence,
  Round,
  SettlementResult,
  Team
} from "@simwar/shared-contracts";
import type { R7CProjection, R7CShadowArenaBatch } from "@simwar/simulation-core";
import type {
  CourseDeliveryLearningEvidenceLedgerV1,
  CourseDeliveryRunBindingEvidenceV1,
  CourseDeliveryStateTransitionEvidenceV1
} from "./course-delivery-productization.js";

export const COURSE_DELIVERY_RUNTIME_V2_FORBIDDEN_STUDENT_MARKERS = [
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

export const COURSE_DELIVERY_RUNTIME_V2_KNOWN_LIMITS = [
  "does_not_claim_g0_pass",
  "does_not_claim_l1_ready",
  "does_not_activate_postgresql_runtime",
  "does_not_prove_durable_settlement"
] as const;

export const COURSE_DELIVERY_RUNTIME_V2_CHAIN = [
  "course.publish",
  "run.create",
  "round.start",
  "decision.submit",
  "round.lock",
  "round.settle_requested",
  "round.publish",
  "result.read",
  "replay.evidence",
  "shadow_arena.non_overwrite",
  "learning_evidence.excluded_from_truth_hash"
] as const;

export interface CourseDeliveryRuntimeV2EvidenceInput {
  course: Course;
  decisions: Decision[];
  learningEvidence: CourseDeliveryLearningEvidenceLedgerV1;
  platformState: AdminState;
  projections: {
    platform: R7CProjection;
    student: R7CProjection;
    teacher: R7CProjection;
    tenantAdmin: R7CProjection;
  };
  replayEvidence: RunReplayEvidence;
  repeatedSettlement: SettlementResult;
  round: Round;
  run: Run;
  runBindingEvidence: CourseDeliveryRunBindingEvidenceV1;
  settlement: SettlementResult;
  shadowArena: R7CShadowArenaBatch;
  stateMachineEvidence: {
    duplicate_side_effects_detected: boolean;
    transitions: CourseDeliveryStateTransitionEvidenceV1[];
  };
  studentResult: PublicResultView;
  teacherResult: PublicResultView;
  teams: Team[];
  tenantAdminState: AdminState;
}

export interface CourseDeliveryRuntimeV2Evidence {
  evidence_kind: "course_delivery_runtime_v2_synthetic_execution_evidence";
  evidence_version: "course-delivery-runtime-v2.synthetic.v1";
  course_id: string;
  run_id: string;
  round_no: number;
  scenario_package_id: string;
  parameter_set_id: string;
  direct_store_delta: "NONE";
  g0_status: "EXCEPTION";
  g0_pass: "NOT_GRANTED";
  l1_status: "NOT_READY";
  runtime_chain: typeof COURSE_DELIVERY_RUNTIME_V2_CHAIN;
  student_negative_visibility: {
    forbidden_markers_observed: string[];
    other_team_visible: boolean;
    private_truth_visible: boolean;
    replay_evidence_visible: boolean;
    visible_team_count: number;
  };
  teacher_evidence: {
    replay_status: RunReplayEvidence["replay_status"];
    team_result_count: number;
  };
  tenant_scope: {
    platform_admin_explicit_authority: boolean;
    platform_visible_tenants: string[];
    tenant_admin_visible_tenants: string[];
  };
  replay_evidence: {
    canonical_evidence_digest_present: boolean;
    replay_result_hash: string;
    replay_status: RunReplayEvidence["replay_status"];
    replay_writes_formal_results: false;
  };
  shadow_replay: {
    case_count: number;
    official_result_non_overwrite: true;
    replay_writes_formal_results: false;
  };
  repeated_settlement: {
    official_result_non_overwrite: boolean;
    replay_hash_stable: boolean;
    settlement_result_stable: boolean;
  };
  learning_evidence: {
    excluded_from_truth_hash: true;
    formal_truth_write: false;
  };
  projections: {
    platform: R7CProjection["visibility"];
    student: R7CProjection["visibility"];
    teacher: R7CProjection["visibility"];
    tenant_admin: R7CProjection["visibility"];
  };
  state_machine: {
    duplicate_side_effects_detected: boolean;
    observed_actions: string[];
  };
  known_limits: typeof COURSE_DELIVERY_RUNTIME_V2_KNOWN_LIMITS;
}

class CourseDeliveryRuntimeV2EvidenceError extends Error {
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "CourseDeliveryRuntimeV2EvidenceError";
  }
}

function assertCondition(condition: boolean, code: string, message: string): void {
  if (!condition) {
    throw new CourseDeliveryRuntimeV2EvidenceError(code, message);
  }
}

function serializedContains(value: unknown, marker: string): boolean {
  return JSON.stringify(value).includes(marker);
}

function getVisibility(projection: R7CProjection): R7CProjection["visibility"] {
  return projection.visibility;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function assertCourseRunRoundBinding(input: CourseDeliveryRuntimeV2EvidenceInput): void {
  assertCondition(
    input.course.status === "published",
    "COURSE_DELIVERY_RUNTIME_V2_COURSE_NOT_PUBLISHED",
    "course must be published before runtime evidence is created"
  );
  assertCondition(
    input.round.status === "published",
    "COURSE_DELIVERY_RUNTIME_V2_ROUND_NOT_PUBLISHED",
    "round must be published before runtime evidence is created"
  );
  assertCondition(
    input.run.course_id === input.course.course_id &&
      input.round.run_id === input.run.run_id &&
      input.settlement.run_id === input.run.run_id,
    "COURSE_DELIVERY_RUNTIME_V2_RUN_CHAIN_MISMATCH",
    "course, run, round and settlement must reference the same execution chain"
  );
  assertCondition(
    input.run.scenario_package_id === input.runBindingEvidence.scenario_package_id &&
      input.run.parameter_set_id === input.runBindingEvidence.parameter_set_id,
    "COURSE_DELIVERY_RUNTIME_V2_RUN_BINDING_MISMATCH",
    "run binding evidence must match the runtime run"
  );
}

function assertTeamAndDecisionCoverage(input: CourseDeliveryRuntimeV2EvidenceInput): void {
  assertCondition(
    input.teams.length === 2,
    "COURSE_DELIVERY_RUNTIME_V2_TEAM_COUNT_UNSUPPORTED",
    "Course Delivery Runtime V2 evidence currently requires the two-team synthetic minimum"
  );

  const teamIds = uniqueSorted(input.teams.map((team) => team.team_id));
  const decisionTeamIds = uniqueSorted(input.decisions.map((decision) => decision.team_id));
  assertCondition(
    teamIds.length === 2 && teamIds.every((teamId) => decisionTeamIds.includes(teamId)),
    "COURSE_DELIVERY_RUNTIME_V2_DECISION_COVERAGE_MISSING",
    "every synthetic team must have a validated decision"
  );
  assertCondition(
    input.settlement.team_results.length === input.teams.length,
    "COURSE_DELIVERY_RUNTIME_V2_SETTLEMENT_COVERAGE_MISSING",
    "settlement must include one result per synthetic team"
  );
}

function createStudentNegativeVisibility(input: CourseDeliveryRuntimeV2EvidenceInput) {
  const forbiddenMarkersObserved = COURSE_DELIVERY_RUNTIME_V2_FORBIDDEN_STUDENT_MARKERS.filter(
    (marker) => serializedContains(input.studentResult, marker)
  );
  const visibleTeamIds = input.studentResult.results.map((result) => result.team_id);
  const otherTeamVisible = input.teams.some(
    (team) =>
      !visibleTeamIds.includes(team.team_id) &&
      serializedContains(input.studentResult, team.team_id)
  );
  const privateTruthVisible = forbiddenMarkersObserved.includes("state_true");
  const replayEvidenceVisible =
    Boolean(input.studentResult.replay_evidence) ||
    forbiddenMarkersObserved.includes("replay_evidence");

  assertCondition(
    forbiddenMarkersObserved.length === 0,
    "COURSE_DELIVERY_RUNTIME_V2_STUDENT_VISIBILITY_LEAK",
    "student result must not expose protected truth or replay markers"
  );
  assertCondition(
    !otherTeamVisible,
    "COURSE_DELIVERY_RUNTIME_V2_STUDENT_OTHER_TEAM_LEAK",
    "student result must not expose another team's private identifiers"
  );

  return {
    forbidden_markers_observed: forbiddenMarkersObserved,
    other_team_visible: otherTeamVisible,
    private_truth_visible: privateTruthVisible,
    replay_evidence_visible: replayEvidenceVisible,
    visible_team_count: visibleTeamIds.length
  };
}

function assertReplayAndLearningEvidence(input: CourseDeliveryRuntimeV2EvidenceInput): void {
  assertCondition(
    input.replayEvidence.replay_status === "matched" &&
      input.replayEvidence.replay_writes_formal_results === false,
    "COURSE_DELIVERY_RUNTIME_V2_REPLAY_NOT_MATCHED",
    "runtime evidence requires non-writing matched replay evidence"
  );
  assertCondition(
    input.shadowArena.official_result_non_overwrite === true &&
      input.shadowArena.replay_writes_formal_results === false,
    "COURSE_DELIVERY_RUNTIME_V2_SHADOW_REPLAY_WRITES_FORMAL_RESULT",
    "shadow arena must remain candidate evidence only"
  );
  assertCondition(
    input.learningEvidence.excluded_from_truth_hash === true &&
      input.learningEvidence.formal_truth_write === false,
    "COURSE_DELIVERY_RUNTIME_V2_LEARNING_EVIDENCE_TRUTH_WRITE",
    "learning evidence must remain excluded from truth hash and formal truth writes"
  );
}

function createRepeatedSettlementEvidence(input: CourseDeliveryRuntimeV2EvidenceInput) {
  const replayHashStable = input.repeatedSettlement.replay_hash === input.settlement.replay_hash;
  const settlementResultStable =
    input.repeatedSettlement.settlement_result_id === input.settlement.settlement_result_id &&
    JSON.stringify(input.repeatedSettlement.team_results) ===
      JSON.stringify(input.settlement.team_results);

  assertCondition(
    replayHashStable && settlementResultStable,
    "COURSE_DELIVERY_RUNTIME_V2_REPEATED_SETTLEMENT_MUTATED_RESULT",
    "repeated settlement must reuse the existing formal result"
  );

  return {
    official_result_non_overwrite: replayHashStable && settlementResultStable,
    replay_hash_stable: replayHashStable,
    settlement_result_stable: settlementResultStable
  };
}

export function createCourseDeliveryRuntimeV2Evidence(
  input: CourseDeliveryRuntimeV2EvidenceInput
): CourseDeliveryRuntimeV2Evidence {
  assertCourseRunRoundBinding(input);
  assertTeamAndDecisionCoverage(input);
  assertReplayAndLearningEvidence(input);

  const studentNegativeVisibility = createStudentNegativeVisibility(input);
  const repeatedSettlement = createRepeatedSettlementEvidence(input);
  const tenantAdminVisibleTenants = input.tenantAdminState.tenants.map(
    (tenant) => tenant.tenant_id
  );
  const platformVisibleTenants = uniqueSorted(
    input.platformState.tenants.map((tenant) => tenant.tenant_id)
  );

  assertCondition(
    tenantAdminVisibleTenants.length === 1 &&
      tenantAdminVisibleTenants[0] === input.course.tenant_id,
    "COURSE_DELIVERY_RUNTIME_V2_TENANT_ADMIN_SCOPE_LEAK",
    "tenant admin evidence must remain limited to the course tenant"
  );
  assertCondition(
    getVisibility(input.projections.student) === "student_redacted_scenario_observation" &&
      getVisibility(input.projections.teacher) === "teacher_authorized_scenario_factory" &&
      getVisibility(input.projections.tenantAdmin) === "tenant_admin_scenario_status" &&
      getVisibility(input.projections.platform) === "platform_admin_explicit_authority",
    "COURSE_DELIVERY_RUNTIME_V2_PROJECTION_BOUNDARY_MISMATCH",
    "role projections must match the expected Course Delivery Runtime V2 boundary"
  );

  return {
    course_id: input.course.course_id,
    direct_store_delta: "NONE",
    evidence_kind: "course_delivery_runtime_v2_synthetic_execution_evidence",
    evidence_version: "course-delivery-runtime-v2.synthetic.v1",
    g0_pass: "NOT_GRANTED",
    g0_status: "EXCEPTION",
    known_limits: COURSE_DELIVERY_RUNTIME_V2_KNOWN_LIMITS,
    l1_status: "NOT_READY",
    learning_evidence: {
      excluded_from_truth_hash: true,
      formal_truth_write: false
    },
    parameter_set_id: input.run.parameter_set_id,
    projections: {
      platform: getVisibility(input.projections.platform),
      student: getVisibility(input.projections.student),
      teacher: getVisibility(input.projections.teacher),
      tenant_admin: getVisibility(input.projections.tenantAdmin)
    },
    replay_evidence: {
      canonical_evidence_digest_present: input.replayEvidence.canonical_evidence_digest.length > 0,
      replay_result_hash: input.replayEvidence.replay_result_hash,
      replay_status: input.replayEvidence.replay_status,
      replay_writes_formal_results: false
    },
    repeated_settlement: repeatedSettlement,
    round_no: input.round.round_no,
    run_id: input.run.run_id,
    runtime_chain: COURSE_DELIVERY_RUNTIME_V2_CHAIN,
    scenario_package_id: input.run.scenario_package_id,
    shadow_replay: {
      case_count: input.shadowArena.cases.length,
      official_result_non_overwrite: true,
      replay_writes_formal_results: false
    },
    state_machine: {
      duplicate_side_effects_detected: input.stateMachineEvidence.duplicate_side_effects_detected,
      observed_actions: uniqueSorted(
        input.stateMachineEvidence.transitions.map((transition) => transition.action)
      )
    },
    student_negative_visibility: studentNegativeVisibility,
    teacher_evidence: {
      replay_status: input.replayEvidence.replay_status,
      team_result_count: input.teacherResult.results.length
    },
    tenant_scope: {
      platform_admin_explicit_authority: platformVisibleTenants.includes("tenant_platform"),
      platform_visible_tenants: platformVisibleTenants,
      tenant_admin_visible_tenants: tenantAdminVisibleTenants
    }
  };
}
