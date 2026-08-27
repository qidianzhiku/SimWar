import type {
  AuditLog,
  Decision,
  D2EvidenceArtifactVersion,
  D2ProvenanceEdge,
  ProjectAssignment,
  ProjectProfile,
  RoleWorkflowEvent,
  Round,
  Run,
  SettlementResult,
  StudentRoleAssignment,
  TeacherConfirmationVersion,
  W4CanonicalStrategicDecision,
  W4EnterpriseState,
  W4ReplayInputManifest,
  W4ScopeContext,
  W4StateRef
} from "../../packages/shared-contracts/src";
import {
  createEnterpriseStateStrategicEvolutionService,
  createJsonW4Repository,
  createW4DecisionPayloadDigest
} from "../../services/api/src/w4-enterprise-state";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

export const M2P5_RUN_ID = "run_m2_p5_decision_learning_browser";
export const M2P5_ROUND_1_ID = "round_m2_p5_decision_learning_browser_1";
export const M2P5_ROUND_2_ID = "round_m2_p5_decision_learning_browser_2";
export const M2P5_PROFILE_ID = "shanghai-project-m2-p5-browser";
export const M2P5_PROFILE_VERSION = "2026-08-23.1";
export const M2P5_PROFILE_DIGEST = "e".repeat(64);
export const M2P5_EVIDENCE_ID = "m2p5-evidence-consequence";
export const M2P5_ROUND_2_EVIDENCE_ID = "m2p5-evidence-consequence-round-2";
export const M2P5_CONFIRMATION_ID = "m2p5-confirmation-consequence";
export const M2P5_ROUND_2_CONFIRMATION_ID = "m2p5-confirmation-consequence-round-2";
export const M2P5_TENANT_ID = "tenant_demo";
export const M2P5_COURSE_ID = "course_demo";
export const M2P5_TEAM_ID = "team_alpha";

const createdAt = "2026-08-23T10:00:00.000Z";
const digest = "d".repeat(64);

function ref(resource_type: string, resource_id: string, content_digest = digest) {
  return {
    content_digest,
    discriminator: "exact_ref" as const,
    resource_id,
    resource_type,
    tenant_id: M2P5_TENANT_ID,
    version: "1.0.0"
  };
}

function addCoreScenario(store: SimWarStore): void {
  const course = store.courses.find((item) => item.course_id === M2P5_COURSE_ID);
  const team = store.teams.find((item) => item.team_id === M2P5_TEAM_ID);
  if (!course || !team) throw new Error("M2-P5 fixture requires the seeded course and team.");

  const profile: ProjectProfile = {
    course_id: M2P5_COURSE_ID,
    content_digest: M2P5_PROFILE_DIGEST,
    created_at: createdAt,
    created_by: "usr_teacher",
    customer_segment: "Shanghai eldercare families",
    description: "M2-P5 exact project context for a two-round learning journey.",
    geography: "Shanghai",
    industry: "eldercare",
    positioning: "trusted care continuity",
    project_profile_id: M2P5_PROFILE_ID,
    provenance: { kind: "APPROVED_SAFE_TEMPLATE" },
    schema_version: "project-profile.v1",
    service_bundle: "community and home support",
    starting_capacity: 100,
    starting_cash: 100000,
    status: "VALIDATED",
    tenant_id: M2P5_TENANT_ID,
    template_id: "shanghai-eldercare-safe-v1",
    title: "M2-P5 Decision Learning Project",
    version: M2P5_PROFILE_VERSION
  };
  store.projectProfiles.push(profile);
  const projectReference = {
    content_digest: profile.content_digest,
    project_profile_id: profile.project_profile_id,
    tenant_id: profile.tenant_id,
    version: profile.version
  };
  const assignment: ProjectAssignment = {
    assigned_at: createdAt,
    assigned_by: "usr_teacher",
    assignment_id: "m2p5-project-assignment-team-alpha",
    course_id: M2P5_COURSE_ID,
    project_profile_reference: projectReference,
    run_id: M2P5_RUN_ID,
    schema_version: "project-assignment.v1",
    team_id: M2P5_TEAM_ID,
    tenant_id: M2P5_TENANT_ID
  };
  store.projectAssignments.push(assignment);

  const run: Run = {
    course_id: M2P5_COURSE_ID,
    parameter_set_id: course.parameter_set_id,
    run_id: M2P5_RUN_ID,
    scenario_package_id: course.scenario_package_id,
    seed: 20260823,
    status: "active",
    tenant_id: M2P5_TENANT_ID
  };
  const rounds: Round[] = [
    {
      round_id: M2P5_ROUND_1_ID,
      round_no: 1,
      run_id: M2P5_RUN_ID,
      status: "published",
      tenant_id: M2P5_TENANT_ID
    },
    {
      round_id: M2P5_ROUND_2_ID,
      round_no: 2,
      run_id: M2P5_RUN_ID,
      status: "open",
      tenant_id: M2P5_TENANT_ID
    }
  ];
  store.runs.push(run);
  store.rounds.push(...rounds);

  const decision: Decision = {
    canonical_source: "role_merge_commit",
    decision_id: "m2p5-decision-round-1",
    merge_commit_id: "m2p5-merge-round-1",
    payload: {
      capacity_plan: "expand",
      cash_buffer_target: 0.18,
      marketing_budget: 140000,
      pricing: { base_price: 12500 },
      service_quality_budget: 130000,
      strategy_statement: "M2-P5 exact published decision"
    },
    round_id: M2P5_ROUND_1_ID,
    round_no: 1,
    run_id: M2P5_RUN_ID,
    status: "submitted",
    submitted_by: team.captain_user_id,
    team_confirmation_id: "m2p5-team-confirmation-round-1",
    team_id: M2P5_TEAM_ID,
    tenant_id: M2P5_TENANT_ID,
    validation_report: [],
    version: 1
  };
  store.decisions.push(decision);
  const settlement: SettlementResult = {
    parameter_set_id: course.parameter_set_id,
    replay_hash: "f".repeat(64),
    round_id: M2P5_ROUND_1_ID,
    round_no: 1,
    run_id: M2P5_RUN_ID,
    scenario_package_id: course.scenario_package_id,
    settlement_result_id: "m2p5-settlement-round-1",
    team_results: [
      {
        state_est: {
          explanation: "Exact published consequence is available for bounded debrief.",
          next_round_risk: "balanced",
          recommended_focus: "Test one bounded decision change next round."
        },
        state_obs: {
          demand_band: "medium",
          profit_band: "healthy",
          rank: 1,
          revenue: 180000,
          score: 82,
          served_demand: 105
        },
        state_true: {
          cash_flow: 50000,
          cost: 130000,
          demand: 120,
          market_share: 0.44,
          profit: 50000,
          rank: 1,
          revenue: 180000,
          score: 82,
          served_demand: 105,
          settlement_status: "settled"
        },
        team_id: M2P5_TEAM_ID,
        team_name: team.name
      }
    ],
    tenant_id: M2P5_TENANT_ID
  };
  store.settlementResults.push(settlement);

  const publicationAudit: AuditLog = {
    action: "round.publish",
    actor_id: "usr_teacher",
    actor_role: "teacher",
    audit_id: "m2p5-round-1-publish",
    created_at: createdAt,
    request_id: "m2p5-round-1-publish-request",
    resource_id: M2P5_ROUND_1_ID,
    resource_type: "round",
    tenant_id: M2P5_TENANT_ID
  };
  store.auditLogs.push(publicationAudit);

  const assignmentRole: StudentRoleAssignment = {
    assigned_at: createdAt,
    assigned_by: "usr_teacher",
    assignment_id: "m2p5-role-ceo",
    course_id: M2P5_COURSE_ID,
    role_key: "CEO",
    role_template_id: "role_template_ceo_v1",
    run_id: M2P5_RUN_ID,
    source: "seeded_default",
    status: "active",
    team_id: M2P5_TEAM_ID,
    tenant_id: M2P5_TENANT_ID,
    user_id: "usr_student"
  };
  store.studentRoleAssignments.push(assignmentRole);
  const roleEvent: RoleWorkflowEvent = {
    actor_id: "usr_student",
    created_at: createdAt,
    event_id: "m2p5-role-event-ready",
    event_type: "section_ready",
    resource_id: "m2p5-role-section",
    run_id: M2P5_RUN_ID,
    team_id: M2P5_TEAM_ID,
    tenant_id: M2P5_TENANT_ID
  };
  store.roleWorkflowEvents.push(roleEvent);

  const evidenceRef = ref("evidence_artifact", M2P5_EVIDENCE_ID);
  const eventRef = ref("role_workflow_event", roleEvent.event_id);
  const packageRef = ref("course_package_version", "m2p5-course-package");
  const goalRef = ref("learning_goal_version", "m2p5-learning-goal");
  const rubricRef = ref("rubric_version", "m2p5-rubric");
  const ruleRef = ref("transformation_rule", "d2-role-workflow-event-to-evidence-v1");
  const artifactContext = {
    activity_id: "activity_consequence",
    course_id: M2P5_COURSE_ID,
    role_key: "CEO",
    round_id: M2P5_ROUND_1_ID,
    round_no: 1,
    run_id: M2P5_RUN_ID,
    team_id: M2P5_TEAM_ID
  };
  const artifact: D2EvidenceArtifactVersion = {
    artifact_digest: digest,
    artifact_kind: "observation",
    artifact_ref: evidenceRef,
    captured_at: createdAt,
    captured_by: "usr_teacher",
    context: artifactContext,
    course_package_ref: packageRef,
    discriminator: "d2_evidence_artifact_version",
    idempotency_key: "m2p5-evidence-idempotency",
    known_limits: ["Teacher-only evidence; no Human Validation."],
    learning_goal_ref: goalRef,
    rubric_ref: rubricRef,
    schema_version: "evidence-provenance.v1",
    source_event_ref: eventRef,
    transformation_rule_ref: ruleRef,
    visibility: "teacher_only"
  };
  store.evidenceArtifacts.push(artifact);
  const edge: D2ProvenanceEdge = {
    discriminator: "d2_provenance_edge",
    relation: "derived_from",
    source_ref: eventRef,
    target_ref: evidenceRef
  };
  store.evidenceProvenanceEdges.push(edge);
  const roundTwoCreatedAt = "2026-08-23T11:00:00.000Z";
  const roundTwoEvidenceDigest = "b".repeat(64);
  const roundTwoRoleEvent: RoleWorkflowEvent = {
    ...roleEvent,
    created_at: roundTwoCreatedAt,
    event_id: "m2p5-role-event-ready-round-2",
    resource_id: "m2p5-role-section-round-2"
  };
  const roundTwoEventRef = ref("role_workflow_event", roundTwoRoleEvent.event_id);
  const roundTwoEvidenceRef = ref(
    "evidence_artifact",
    M2P5_ROUND_2_EVIDENCE_ID,
    roundTwoEvidenceDigest
  );
  const roundTwoArtifact: D2EvidenceArtifactVersion = {
    ...artifact,
    artifact_digest: roundTwoEvidenceDigest,
    artifact_ref: roundTwoEvidenceRef,
    captured_at: roundTwoCreatedAt,
    context: {
      ...artifact.context,
      round_id: M2P5_ROUND_2_ID,
      round_no: 2
    },
    idempotency_key: "m2p5-evidence-round-2-idempotency",
    source_event_ref: roundTwoEventRef
  };
  store.roleWorkflowEvents.push(roundTwoRoleEvent);
  store.evidenceArtifacts.push(roundTwoArtifact);
  store.evidenceProvenanceEdges.push({
    discriminator: "d2_provenance_edge",
    relation: "derived_from",
    source_ref: roundTwoEventRef,
    target_ref: roundTwoEvidenceRef
  });
  const confirmationRef = ref("teacher_confirmation_version", M2P5_CONFIRMATION_ID);
  const confirmation: TeacherConfirmationVersion = {
    audit_receipt: {
      action: "teacher_confirmation.confirm",
      actor_id: "usr_teacher",
      audit_id: "m2p5-confirmation-audit",
      recorded_at: createdAt,
      request_id: "m2p5-confirmation-request"
    },
    confirmation_ref: confirmationRef,
    content_digest: digest,
    context: {
      course_id: M2P5_COURSE_ID,
      role_key: "CEO",
      round_id: M2P5_ROUND_1_ID,
      round_no: 1,
      run_id: M2P5_RUN_ID,
      team_id: M2P5_TEAM_ID
    },
    course_package_ref: packageRef,
    created_at: createdAt,
    created_by: "usr_teacher",
    criterion_decisions: [{ criterion_id: "m2p5-criterion", level_ordinal: 2 }],
    discriminator: "teacher_confirmation_version",
    evidence_refs: [evidenceRef],
    idempotency_key: "m2p5-confirmation-idempotency",
    known_limits: ["Teacher-only confirmation; Human Validation is not performed."],
    learning_goal_ref: goalRef,
    rubric_ref: rubricRef,
    schema_version: "teacher-confirmation.v1",
    status: "CONFIRMED",
    teacher_feedback: "Confirmed exact evidence for the published consequence."
  };
  store.teacherConfirmationVersions.push(confirmation);
  const roundTwoConfirmationDigest = "c".repeat(64);
  const roundTwoConfirmation: TeacherConfirmationVersion = {
    ...confirmation,
    audit_receipt: {
      action: "teacher_confirmation.confirm",
      actor_id: "usr_teacher",
      audit_id: "m2p5-confirmation-round-2-audit",
      recorded_at: roundTwoCreatedAt,
      request_id: "m2p5-confirmation-round-2-request"
    },
    confirmation_ref: ref(
      "teacher_confirmation_version",
      M2P5_ROUND_2_CONFIRMATION_ID,
      roundTwoConfirmationDigest
    ),
    content_digest: roundTwoConfirmationDigest,
    context: {
      ...confirmation.context,
      round_id: M2P5_ROUND_2_ID,
      round_no: 2
    },
    created_at: roundTwoCreatedAt,
    evidence_refs: [roundTwoEvidenceRef],
    idempotency_key: "m2p5-confirmation-round-2-idempotency",
    teacher_feedback: "Newer Round 2 confirmation must never satisfy the Round 1 learning loop."
  };
  store.teacherConfirmationVersions.unshift(roundTwoConfirmation);
}

function w4Scope(roundNo: number, roundId: string): W4ScopeContext {
  return {
    actor_id: "usr_teacher",
    activity_id: "activity_consequence",
    course_id: M2P5_COURSE_ID,
    role_key: "CEO",
    round_id: roundId,
    round_no: roundNo,
    run_id: M2P5_RUN_ID,
    team_id: M2P5_TEAM_ID,
    tenant_id: M2P5_TENANT_ID
  };
}

function w4InitialState(): W4EnterpriseState {
  const scope = w4Scope(1, M2P5_ROUND_1_ID);
  return {
    enterprise_state_id: "m2p5-enterprise-state-round-1",
    tenant_id: M2P5_TENANT_ID,
    course_id: M2P5_COURSE_ID,
    run_id: M2P5_RUN_ID,
    team_id: M2P5_TEAM_ID,
    round_id: scope.round_id,
    round_no: 1,
    version: 1,
    parent_state_ref: null,
    state_digest: "",
    state: {
      cash: 100000,
      capacity: 100,
      product_lines: ["core-care"],
      positioning: "trusted-care",
      organization: { team_size: 4 },
      operating_units: [],
      portfolio: { projects: [], facilities: [] }
    }
  };
}

function w4Decision(): W4CanonicalStrategicDecision {
  const payload = {
    project_name: "M2-P5 exact project",
    cost: 100,
    cycle_rounds: 3,
    area: 1000,
    beds: 10,
    bed_mix: { standard: 10 },
    ramp: 0.5,
    lead_time_rounds: 1
  };
  return {
    decision_id: "m2p5-w4-decision-round-1",
    tenant_id: M2P5_TENANT_ID,
    course_id: M2P5_COURSE_ID,
    run_id: M2P5_RUN_ID,
    round_id: M2P5_ROUND_1_ID,
    round_no: 1,
    team_id: M2P5_TEAM_ID,
    kind: "new_project",
    version: 1,
    status: "canonical",
    payload,
    admission: {
      policy: "LEGACY_DIRECT_EXPLICIT",
      authority: "synthetic_run_creation_marker",
      canonical_decision_id: null,
      merge_commit_id: null,
      team_confirmation_id: null,
      decision_payload_digest: createW4DecisionPayloadDigest("new_project", payload)
    }
  };
}

function w4Manifest(
  opening: W4StateRef,
  decision: W4CanonicalStrategicDecision
): W4ReplayInputManifest {
  return {
    manifest_id: "m2p5-w4-manifest-round-1",
    tenant_id: M2P5_TENANT_ID,
    course_id: M2P5_COURSE_ID,
    run_id: M2P5_RUN_ID,
    team_id: M2P5_TEAM_ID,
    round_id: M2P5_ROUND_1_ID,
    opening_state_ref: structuredClone(opening),
    decision_ids: [decision.decision_id],
    decision_payload_bindings: [
      {
        decision_id: decision.decision_id,
        decision_payload_digest: decision.admission.decision_payload_digest
      }
    ],
    scenario_package_id: "scenario_m2p5",
    parameter_set_id: "parameters_m2p5",
    engine_id: "toy_logit_wellness_v1",
    plugin_ids: ["plugin_wellness_stub"],
    seed: 20260823
  };
}

export async function seedM2P5DecisionLearningStore(store: SimWarStore): Promise<void> {
  addCoreScenario(store);
  const repository = createJsonW4Repository(store);
  const service = createEnterpriseStateStrategicEvolutionService(repository);
  const scope = w4Scope(1, M2P5_ROUND_1_ID);
  const opening = (await service.createInitialState(scope, w4InitialState())).state_ref;
  const decision = w4Decision();
  const compiled = await service.commitStrategicDecision(scope, decision);
  await service.addProjectToPortfolio(scope, {
    initiative_id: compiled.initiative.initiative_id,
    project_entry_id: "m2p5-w4-project-entry",
    project_name: "M2-P5 exact project",
    project_profile_reference: {
      content_digest: M2P5_PROFILE_DIGEST,
      project_profile_id: M2P5_PROFILE_ID,
      tenant_id: M2P5_TENANT_ID,
      version: M2P5_PROFILE_VERSION
    },
    source_assignment_id: "m2p5-project-assignment-team-alpha"
  });
  await service.settleRound(scope, {
    decision_id: decision.decision_id,
    opening_state_ref: opening,
    replay_input_manifest: w4Manifest(opening, decision)
  });
  store.persist();
}

export async function seedM2P5DecisionLearningFixture(storeFile: string): Promise<void> {
  const store = createP1Store({ persistenceFile: storeFile });
  if (!store.runs.some((run) => run.run_id === M2P5_RUN_ID)) {
    await seedM2P5DecisionLearningStore(store);
  }
}
