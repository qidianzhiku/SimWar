import type {
  ActorRole,
  AuditLog,
  BffDtoAdvisorySlot,
  BffDtoAuditReference,
  BffDtoScenarioReference,
  Course,
  CourseWorkspaceDTO,
  CurrentUser,
  Decision,
  DecisionFormDTO,
  DecisionPayloadFieldPath,
  ParameterSet,
  PermissionKey,
  PlatformAdminAuthorityDTO,
  PublicResultView,
  Round,
  RoundControlDTO,
  Run,
  ScenarioPackage,
  StudentBffCockpitDTO,
  StudentBffDtoBase,
  StudentCockpitDTO,
  StudentSafeTeamSettlement,
  TeacherBffWorkspaceDTO,
  TeacherDashboardDTO,
  TeacherReplaySummaryDTO,
  TeamSettlement,
  Team,
  TeamMonitorDTO,
  Tenant,
  TenantAdminSummaryDTO,
  ThreePartFeedbackDTO,
  PublishedResultDTO,
  LearningReportDTO
} from "@simwar/shared-contracts";

export const STUDENT_BFF_FORBIDDEN_FIELDS = [
  "state_true",
  "full_manifest",
  "private_parameter_set",
  "private_scenario_assumption",
  "private_scenario_diff",
  "private_plugin_trace",
  "private_shock_internal_detail",
  "private_replay_artifact",
  "canonical_evidence_digest",
  "decision_batch_hash",
  "json_runtime_source_digest",
  "other_team_data",
  "other_tenant_data",
  "teacher_private_evidence",
  "admin_private_metadata"
] as const;

const EXPLICIT_NON_PROOFS = [
  "BFF DTO productization is not L1 READY",
  "BFF DTO productization is not real teacher rehearsal",
  "BFF DTO productization is not Pilot readiness",
  "BFF DTO productization is not Production readiness",
  "BFF DTO productization does not authorize PostgreSQL runtime",
  "BFF DTO productization does not prove durable settlement"
] as const;

const TEACHER_RUNTIME_PATHS = [
  "GET /api/v1/demo-state",
  "GET /api/v1/runs/:runId/rounds/:roundNo/results",
  "POST /api/v1/runs/:runId/rounds/:roundNo/lock",
  "POST /internal/v1/runs/:runId/rounds/:roundNo/settle",
  "POST /api/v1/runs/:runId/rounds/:roundNo/publish"
] as const;

const STUDENT_RUNTIME_PATHS = [
  "GET /api/v1/demo-state",
  "POST /api/v1/runs/:runId/rounds/:roundNo/decisions",
  "GET /api/v1/runs/:runId/rounds/:roundNo/results"
] as const;

const ADMIN_RUNTIME_PATHS = ["GET /api/v1/admin/state", "GET /api/v1/audit/logs"] as const;

const DECISION_FORM_FIELDS: DecisionPayloadFieldPath[] = [
  "pricing.base_price",
  "marketing_budget",
  "service_quality_budget",
  "capacity_plan",
  "cash_buffer_target",
  "strategy_statement"
];

function firstRole(actor: CurrentUser): ActorRole {
  return actor.roles[0] ?? "learner";
}

function allowedActions(actor: CurrentUser, fallback: PermissionKey[]): PermissionKey[] {
  return actor.permissions && actor.permissions.length > 0 ? actor.permissions : fallback;
}

function auditReference(logs: AuditLog[], actions: string[]): BffDtoAuditReference[] {
  return actions.map((action) => {
    const matching = logs.filter((log) => log.action === action);
    return {
      action,
      audit_ids: matching.map((log) => log.audit_id),
      request_ids: matching.map((log) => log.request_id)
    };
  });
}

function createScenarioReference(input: {
  course: Course;
  parameterSet?: ParameterSet;
  run: Run;
  scenario?: ScenarioPackage;
}): BffDtoScenarioReference {
  return {
    parameter_set_id: input.course.parameter_set_id,
    ...(input.parameterSet ? { parameter_set_version: input.parameterSet.version } : {}),
    plugin_package_id: input.scenario?.plugin_package_ids[0] ?? "plugin_package_not_bound",
    run_seed: input.run.seed,
    scenario_package_id: input.course.scenario_package_id,
    ...(input.scenario ? { scenario_version: input.scenario.version } : {})
  };
}

function createAdvisorySlots(): BffDtoAdvisorySlot[] {
  return ["strategy_advisor", "risk_review", "debrief_coach", "learning_recommender"].map(
    (slot_id) => ({
      advisory_only: true,
      coach_output_reference: null,
      model_call_log_reference: null,
      slot_id
    })
  ) as BffDtoAdvisorySlot[];
}

function latestDecisionByTeam(decisions: Decision[]): Map<string, Decision> {
  const latest = new Map<string, Decision>();
  for (const decision of decisions) {
    const existing = latest.get(decision.team_id);
    if (!existing || existing.version < decision.version) {
      latest.set(decision.team_id, decision);
    }
  }
  return latest;
}

function findStudentResult(
  resultView: PublicResultView,
  teamId: string
): StudentSafeTeamSettlement | undefined {
  return resultView.results.find(
    (result): result is StudentSafeTeamSettlement =>
      result.team_id === teamId && !("state_true" in result)
  );
}

export interface TeacherBffProjectionInput {
  actor: CurrentUser;
  auditLogs: AuditLog[];
  course: Course;
  decisions: Decision[];
  parameterSet?: ParameterSet;
  resultView: PublicResultView;
  round: Round;
  run: Run;
  scenario?: ScenarioPackage;
  teams: Team[];
}

export function createTeacherBffWorkspaceDto(
  input: TeacherBffProjectionInput
): TeacherBffWorkspaceDTO {
  const role = firstRole(input.actor);
  const allowed = allowedActions(input.actor, [
    "course:read",
    "round:lock",
    "settlement:settle",
    "round:publish",
    "result:read",
    "audit:read"
  ]);
  const source_runtime_path = [...TEACHER_RUNTIME_PATHS];
  const audit_reference = auditReference(input.auditLogs, [
    "course.publish",
    "round.lock",
    "round.settle",
    "round.publish"
  ]);
  const latestDecisions = latestDecisionByTeam(input.decisions);
  const scenarioReference = createScenarioReference(input);

  const teacher_dashboard: TeacherDashboardDTO = {
    actor_role: role,
    allowed_actions: allowed,
    audit_reference,
    course_id: input.course.course_id,
    evidence_label: "BFF_DTO_PRODUCTIZATION",
    explicit_non_proof: [...EXPLICIT_NON_PROOFS],
    redacted_fields: ["formal_truth_write_authority", "direct_store_mutation"],
    run_id: input.run.run_id,
    source_runtime_path,
    tenant_id: input.course.tenant_id,
    visible_state: {
      course_status: input.course.status,
      round_status: input.round.status,
      team_count: input.teams.length
    }
  };

  const course_workspace: CourseWorkspaceDTO = {
    actor_role: role,
    allowed_actions: allowed,
    audit_reference,
    course_id: input.course.course_id,
    evidence_label: "TEACHER_PROJECTION_EVIDENCE",
    explicit_non_proof: [...EXPLICIT_NON_PROOFS],
    redacted_fields: ["formal_truth_write_authority", "direct_store_mutation"],
    run_id: input.run.run_id,
    scenario_reference: scenarioReference,
    source_runtime_path,
    tenant_id: input.course.tenant_id,
    visible_state: {
      course_title: input.course.title,
      run_status: input.run.status
    }
  };

  const round_control: RoundControlDTO = {
    actor_role: role,
    allowed_actions: allowed,
    audit_reference,
    course_id: input.course.course_id,
    evidence_label: "RUNTIME_ENTRYPOINT_EVIDENCE",
    explicit_non_proof: [...EXPLICIT_NON_PROOFS],
    redacted_fields: ["formal_truth_write_authority", "direct_store_mutation"],
    round_id: input.round.round_id,
    round_no: input.round.round_no,
    run_id: input.run.run_id,
    source_runtime_path,
    status: input.round.status,
    tenant_id: input.course.tenant_id,
    visible_state: {
      decision_count: input.decisions.length,
      settlement_available: input.resultView.results.length > 0,
      team_count: input.teams.length
    }
  };

  const team_monitor: TeamMonitorDTO = {
    actor_role: role,
    allowed_actions: allowed,
    audit_reference,
    course_id: input.course.course_id,
    evidence_label: "TENANT_BOUNDARY_EVIDENCE",
    explicit_non_proof: [...EXPLICIT_NON_PROOFS],
    redacted_fields: ["formal_truth_write_authority", "direct_store_mutation"],
    run_id: input.run.run_id,
    source_runtime_path,
    teams: input.teams.map((team) => ({
      decision_submitted: latestDecisions.has(team.team_id),
      members: team.members.length,
      team_id: team.team_id,
      team_name: team.name
    })),
    tenant_id: input.course.tenant_id,
    visible_state: {
      decision_count: input.decisions.length,
      team_count: input.teams.length
    }
  };

  const teacher_replay_summary: TeacherReplaySummaryDTO = {
    actor_role: role,
    allowed_actions: allowed,
    audit_reference,
    authorized_result_snapshot: input.resultView.results.filter(
      (result): result is TeamSettlement => "state_true" in result
    ),
    course_id: input.course.course_id,
    evidence_label: "RUNTIME_ENTRYPOINT_EVIDENCE",
    explicit_non_proof: [...EXPLICIT_NON_PROOFS],
    formal_truth_write_allowed: false,
    redacted_fields: ["direct_store_mutation", "replay_result_overwrite"],
    ...(input.resultView.replay_hash ? { replay_hash: input.resultView.replay_hash } : {}),
    ...(input.resultView.replay_evidence?.replay_status
      ? { replay_status: input.resultView.replay_evidence.replay_status }
      : {}),
    ...(input.resultView.replay_evidence?.replay_writes_formal_results === false
      ? { replay_writes_formal_results: false }
      : {}),
    round_id: input.round.round_id,
    round_no: input.round.round_no,
    run_id: input.run.run_id,
    source_runtime_path,
    tenant_id: input.course.tenant_id,
    visible_state: {
      result_count: input.resultView.results.length,
      runtime_boundary: input.resultView.runtime_boundary
    }
  };

  return {
    course_workspace,
    round_control,
    teacher_dashboard,
    teacher_replay_summary,
    team_monitor
  };
}

export interface StudentBffProjectionInput {
  actor: CurrentUser;
  course: Course;
  resultView: PublicResultView;
  round: Round;
  run: Run;
  team: Team;
}

function createStudentBase(input: StudentBffProjectionInput): StudentBffDtoBase {
  const result = findStudentResult(input.resultView, input.team.team_id);
  return {
    actor_role: firstRole(input.actor),
    advisory_slots: createAdvisorySlots(),
    allowed_actions: allowedActions(input.actor, ["course:read", "decision:submit", "result:read"]),
    course_id: input.course.course_id,
    explicit_non_proof: [...EXPLICIT_NON_PROOFS],
    forbidden_fields: [...STUDENT_BFF_FORBIDDEN_FIELDS],
    ...(result
      ? { redacted_result: result, state_est: result.state_est, state_obs: result.state_obs }
      : {}),
    round_id: input.round.round_id,
    round_no: input.round.round_no,
    run_id: input.run.run_id,
    source_runtime_path: [...STUDENT_RUNTIME_PATHS],
    team_id: input.team.team_id,
    tenant_id: input.course.tenant_id
  };
}

export function createStudentBffCockpitDto(input: StudentBffProjectionInput): StudentBffCockpitDTO {
  const base = createStudentBase(input);
  const student_cockpit: StudentCockpitDTO = {
    ...base,
    evidence_label: "STUDENT_PROJECTION_EVIDENCE",
    visible_state: {
      course_status: input.course.status,
      round_status: input.round.status,
      team_name: input.team.name
    }
  };
  const decision_form: DecisionFormDTO = {
    ...base,
    decision_schema_version: "m1-decision-form.v1",
    editable_fields: [...DECISION_FORM_FIELDS],
    evidence_label: "RUNTIME_ENTRYPOINT_EVIDENCE"
  };
  const published_result: PublishedResultDTO = {
    ...base,
    evidence_label: "STUDENT_PROJECTION_EVIDENCE",
    result_label: input.resultView.result_label
  };
  const three_part_feedback: ThreePartFeedbackDTO = {
    ...base,
    evidence_label: "STUDENT_PROJECTION_EVIDENCE",
    feedback: {
      ...(base.state_est?.next_round_risk
        ? { next_step_risk: base.state_est.next_round_risk }
        : {}),
      ...(base.state_obs ? { what_happened: base.state_obs } : {}),
      ...(base.state_est?.explanation ? { why_it_happened: base.state_est.explanation } : {})
    }
  };
  const learning_report: LearningReportDTO = {
    ...base,
    evidence_label: "AI_ADVISORY_PLACEHOLDER_EVIDENCE",
    learning_evidence: {
      advisory_only: true,
      formal_grade: false,
      prompts: input.resultView.classroom_debrief_prompts
    }
  };

  return {
    decision_form,
    learning_report,
    published_result,
    student_cockpit,
    three_part_feedback
  };
}

export interface TenantAdminSummaryInput {
  actor: CurrentUser;
  auditLogs: AuditLog[];
  courses: Course[];
  runs: Run[];
  teams: Team[];
  tenant: Tenant;
}

export function createTenantAdminSummaryDto(input: TenantAdminSummaryInput): TenantAdminSummaryDTO {
  return {
    actor_role: firstRole(input.actor),
    allowed_actions: allowedActions(input.actor, [
      "tenant:read",
      "user:read",
      "course:read",
      "audit:read"
    ]),
    explicit_non_proof: [...EXPLICIT_NON_PROOFS],
    redacted_fields: ["other_tenant_data", "platform_authority", "student_private_replay"],
    source_runtime_path: [...ADMIN_RUNTIME_PATHS],
    tenant_id: input.tenant.tenant_id,
    visible_state: {
      audit_event_count: input.auditLogs.length,
      course_count: input.courses.length,
      run_count: input.runs.length,
      team_count: input.teams.length
    },
    visible_tenant_ids: [input.tenant.tenant_id]
  };
}

export interface PlatformAdminAuthorityInput {
  actor: CurrentUser;
  tenants: Tenant[];
}

export function createPlatformAdminAuthorityDto(
  input: PlatformAdminAuthorityInput
): PlatformAdminAuthorityDTO {
  return {
    actor_role: "platform_admin",
    allowed_actions: allowedActions(input.actor, [
      "tenant:create",
      "tenant:read",
      "user:read",
      "audit:read"
    ]),
    explicit_authority_source: "platform_admin role",
    explicit_non_proof: [...EXPLICIT_NON_PROOFS],
    platform_authority: true,
    redacted_fields: ["tenant_private_payload", "student_private_replay", "secrets"],
    required_scope: "platform",
    source_runtime_path: [...ADMIN_RUNTIME_PATHS],
    visible_state: {
      tenant_count: input.tenants.length,
      tenant_ids: input.tenants.map((tenant) => tenant.tenant_id)
    }
  };
}
