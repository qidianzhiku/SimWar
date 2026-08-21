import type {
  AuditLog,
  Course,
  DecisionAdmissionPolicy,
  Decision,
  ProjectAwareCourseReadiness,
  ProjectProfileStudentBrief,
  Round,
  Run,
  SettlementResult,
  Team,
  M2P4DecisionReadiness,
  M2P4ExactRoundScope,
  M2P4ProjectReadiness,
  M2P4RoleReadiness,
  M2P4StudentProjectContext,
  M2P4TeacherLiveRoundOps,
  M2P4TeamOperationsReadiness,
  PermissionKey
} from "@simwar/shared-contracts";
import type { RoleWorkflowRepositorySnapshot } from "./repository-ports.js";

export interface M2P4TeacherLiveRoundOpsInput {
  actorAllowedActions: PermissionKey[];
  auditLogs: AuditLog[];
  course: Course;
  decisionAdmissionPolicy?: DecisionAdmissionPolicy | null;
  decisions: Decision[];
  projectReadiness?: ProjectAwareCourseReadiness;
  projectReadinessRequired?: boolean;
  roleSnapshots: Map<string, RoleWorkflowRepositorySnapshot>;
  round: Round;
  run: Run;
  settlement: SettlementResult | null;
  teams: Team[];
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  const a = unique(left);
  const b = unique(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function latestSection(
  snapshot: RoleWorkflowRepositorySnapshot,
  assignment: RoleWorkflowRepositorySnapshot["assignments"][number]
) {
  return snapshot.sections
    .filter(
      (section) =>
        section.round_id === snapshot.round?.round_id &&
        section.role_key === assignment.role_key &&
        section.submitted_by === assignment.user_id &&
        (!section.assignment_id || section.assignment_id === assignment.assignment_id)
    )
    .sort(
      (left, right) =>
        left.version - right.version || left.section_id.localeCompare(right.section_id)
    )
    .at(-1);
}

function projectReadiness(
  teamId: string,
  readiness: ProjectAwareCourseReadiness | undefined
): M2P4ProjectReadiness {
  if (!readiness) {
    return { state: "UNKNOWN", blockers: ["project_readiness_unavailable"] };
  }
  const team = readiness.teams.find((candidate) => candidate.team_id === teamId);
  if (!team) {
    return { state: "BLOCKED", blockers: [`${teamId}:project_assignment_missing`] };
  }
  const blockers = team.blockers.map((blocker) => blocker.code);
  return {
    state: team.state === "READY" ? "READY" : team.state === "STALE" ? "STALE" : "BLOCKED",
    ...(team.project_profile_reference
      ? { project_profile_reference: structuredClone(team.project_profile_reference) }
      : {}),
    blockers
  };
}

function roleReadiness(
  team: Team,
  snapshot: RoleWorkflowRepositorySnapshot | undefined,
  admissionPolicy: DecisionAdmissionPolicy | null
): M2P4RoleReadiness {
  const required = team.members.some((member) => member.role_slot === "CHRO")
    ? ["CEO", "CFO", "CMO", "COO", "CHRO"]
    : ["CEO", "CFO", "CMO", "COO"];
  if (admissionPolicy === "LEGACY_DIRECT_EXPLICIT") {
    return {
      state: "READY",
      required_role_keys: [],
      assigned_role_keys: [],
      missing_role_keys: [],
      blockers: []
    };
  }
  if (!snapshot) {
    return {
      state: "UNKNOWN",
      required_role_keys: required,
      assigned_role_keys: [],
      missing_role_keys: required,
      blockers: [`${team.team_id}:role_workflow_unavailable`]
    };
  }
  const active = snapshot.assignments.filter((assignment) => assignment.status === "active");
  const assigned = unique(active.map((assignment) => assignment.role_key));
  const roleCounts = new Map<string, number>();
  for (const assignment of active) {
    roleCounts.set(assignment.role_key, (roleCounts.get(assignment.role_key) ?? 0) + 1);
  }
  const rosterValid =
    active.length === required.length && required.every((roleKey) => roleCounts.get(roleKey) === 1);
  const missing = required.filter((roleKey) => !assigned.includes(roleKey));
  const sectionsReady = active.every(
    (assignment) => latestSection(snapshot, assignment)?.status === "ready"
  );
  const blockers = [
    ...(rosterValid ? [] : [`${team.team_id}:role_roster_invalid`]),
    ...missing.map((roleKey) => `${team.team_id}:role_missing:${roleKey}`),
    ...(sectionsReady ? [] : [`${team.team_id}:role_section_not_ready`])
  ];
  return {
    state: rosterValid && missing.length === 0 && sectionsReady ? "READY" : "BLOCKED",
    required_role_keys: required,
    assigned_role_keys: assigned,
    missing_role_keys: missing,
    blockers
  };
}

function decisionReadiness(
  team: Team,
  run: Run,
  round: Round,
  snapshot: RoleWorkflowRepositorySnapshot | undefined,
  decisions: readonly Decision[],
  admissionPolicy: DecisionAdmissionPolicy | null
): M2P4DecisionReadiness {
  if (admissionPolicy === "LEGACY_DIRECT_EXPLICIT") {
    const directDecisions = decisions.filter(
      (decision) =>
        decision.tenant_id === run.tenant_id &&
        decision.run_id === run.run_id &&
        decision.round_id === round.round_id &&
        decision.round_no === round.round_no &&
        decision.team_id === team.team_id &&
        decision.status === "validated" &&
        decision.canonical_source === undefined &&
        decision.merge_commit_id === undefined &&
        decision.team_confirmation_id === undefined
    );
    if (directDecisions.length > 1) {
      return { state: "CONFLICTING", blockers: [`${team.team_id}:direct_decision_conflicting`] };
    }
    if (directDecisions.length === 0) {
      return { state: "BLOCKED", blockers: [`${team.team_id}:direct_decision_missing`] };
    }
    return {
      state: "READY",
      canonical_decision_id: directDecisions[0]!.decision_id,
      blockers: []
    };
  }
  if (admissionPolicy === null) {
    return {
      state: "UNKNOWN",
      blockers: [`${team.team_id}:decision_admission_policy_unavailable`]
    };
  }
  if (!snapshot)
    return { state: "UNKNOWN", blockers: [`${team.team_id}:role_workflow_unavailable`] };
  const active = snapshot.assignments.filter((assignment) => assignment.status === "active");
  const sections = active
    .map((assignment) => latestSection(snapshot, assignment))
    .filter((section): section is NonNullable<typeof section> => Boolean(section));
  const sourceIds = sections.map((section) => section.section_id);
  const merges = snapshot.merge_commits.filter(
    (merge) =>
      merge.status === "validated" &&
      merge.team_id === team.team_id &&
      sameSet(merge.source_section_ids, sourceIds)
  );
  if (merges.length > 1) {
    return { state: "CONFLICTING", blockers: [`${team.team_id}:merge_commit_conflicting`] };
  }
  const merge = merges[0];
  if (!merge) return { state: "BLOCKED", blockers: [`${team.team_id}:merge_commit_missing`] };
  const confirmations = snapshot.confirmations.filter(
    (confirmation) =>
      confirmation.status === "confirmed" &&
      confirmation.team_id === team.team_id &&
      confirmation.merge_commit_id === merge.merge_commit_id
  );
  if (confirmations.length !== 1) {
    return {
      state: confirmations.length > 1 ? "CONFLICTING" : "BLOCKED",
      merge_commit_id: merge.merge_commit_id,
      ...(confirmations[0] ? { team_confirmation_id: confirmations[0].team_confirmation_id } : {}),
      blockers: [
        `${team.team_id}:team_confirmation_${confirmations.length === 0 ? "missing" : "conflicting"}`
      ]
    };
  }
  const confirmation = confirmations[0]!;
  const canonical = decisions.filter(
    (decision) =>
      decision.team_id === team.team_id &&
      decision.round_id === snapshot.round?.round_id &&
      decision.status === "submitted" &&
      decision.canonical_source === "role_merge_commit" &&
      decision.merge_commit_id === merge.merge_commit_id &&
      decision.team_confirmation_id === confirmation.team_confirmation_id
  );
  if (canonical.length !== 1) {
    return {
      state: canonical.length > 1 ? "CONFLICTING" : "BLOCKED",
      merge_commit_id: merge.merge_commit_id,
      team_confirmation_id: confirmation.team_confirmation_id,
      ...(canonical[0] ? { canonical_decision_id: canonical[0].decision_id } : {}),
      blockers: [
        `${team.team_id}:canonical_decision_${canonical.length > 1 ? "conflicting" : "missing"}`
      ]
    };
  }
  return {
    state: "READY",
    canonical_decision_id: canonical[0]!.decision_id,
    team_confirmation_id: confirmation.team_confirmation_id,
    merge_commit_id: merge.merge_commit_id,
    blockers: []
  };
}

function actionForStatus(status: Round["status"]): string | null {
  if (status === "draft") return "round:start";
  if (status === "open") return "round:lock";
  if (status === "locked") return "settlement:settle";
  if (status === "settled") return "round:publish";
  if (status === "published") return "round:continue";
  return null;
}

function lockAudit(auditLogs: readonly AuditLog[], round: Round): AuditLog | undefined {
  return auditLogs
    .filter(
      (audit) =>
        audit.action === "round.lock" &&
        audit.resource_id === round.round_id &&
        audit.after?.decision_batch_id === round.decision_batch_id
    )
    .at(-1);
}

function scope(input: M2P4TeacherLiveRoundOpsInput): M2P4ExactRoundScope {
  return {
    tenant_id: input.run.tenant_id,
    course_id: input.course.course_id,
    run_id: input.run.run_id,
    round_id: input.round.round_id,
    round_no: input.round.round_no
  };
}

export function buildM2P4TeacherLiveRoundOps(
  input: M2P4TeacherLiveRoundOpsInput
): M2P4TeacherLiveRoundOps {
  const admissionPolicy =
    input.decisionAdmissionPolicy === undefined
      ? ("ROLE_WORKFLOW_REQUIRED" as const)
      : input.decisionAdmissionPolicy;
  const projectReadinessRequired =
    input.projectReadinessRequired ?? input.projectReadiness !== undefined;
  const teams = input.teams.map((team): M2P4TeamOperationsReadiness => {
    const project = projectReadiness(team.team_id, input.projectReadiness);
    const role = roleReadiness(team, input.roleSnapshots.get(team.team_id), admissionPolicy);
    const decision = decisionReadiness(
      team,
      input.run,
      input.round,
      input.roleSnapshots.get(team.team_id),
      input.decisions,
      admissionPolicy
    );
    return {
      exact_scope: { ...scope(input), team_id: team.team_id },
      team_id: team.team_id,
      team_name: team.name,
      project,
      role,
      decision,
      blockers: [...project.blockers, ...role.blockers, ...decision.blockers]
    };
  });
  const lockReady = teams.every(
    (team) =>
      admissionPolicy !== null &&
      (admissionPolicy === "LEGACY_DIRECT_EXPLICIT"
        ? team.decision.state === "READY"
        : team.role.state === "READY" && team.decision.state === "READY") &&
      (!projectReadinessRequired || team.project.state === "READY")
  );
  const allowedActions = input.actorAllowedActions.filter(
    (action): action is M2P4TeacherLiveRoundOps["session_command"]["allowed_actions"][number] =>
      [
        "round:start",
        "round:lock",
        "settlement:settle",
        "round:publish",
        "round:continue",
        "result:read"
      ].includes(action)
  );
  const primaryAction = actionForStatus(
    input.round.status
  ) as M2P4TeacherLiveRoundOps["session_command"]["primary_action"];
  const actionEnabled =
    primaryAction === "round:lock"
      ? lockReady
      : primaryAction === null
        ? false
        : allowedActions.includes(primaryAction);
  const roundBlockers = teams.flatMap((team) => team.blockers);
  const lockLog = lockAudit(input.auditLogs, input.round);
  const canonicalDecisionRefs = teams
    .map((team) => team.decision.canonical_decision_id)
    .filter((value): value is string => Boolean(value));
  const resultId = input.settlement?.settlement_result_id;
  const exact = scope(input);
  return {
    schema_version: "m2p4-live-round-ops.v1",
    exact_scope: exact,
    session_command: {
      authority: "server",
      primary_action: primaryAction,
      allowed_actions: allowedActions,
      enabled: actionEnabled,
      ...(actionEnabled
        ? {}
        : {
            reason:
              primaryAction !== "round:lock"
                ? "server_action_not_allowed"
                : admissionPolicy === null
                  ? "decision_admission_policy_unavailable"
                  : projectReadinessRequired && !input.projectReadiness
                    ? "project_readiness_unavailable"
                    : "canonical_project_role_readiness_required"
          })
    },
    round: {
      status: input.round.status,
      lock_ready: lockReady,
      ...(input.round.decision_batch_id
        ? { decision_batch_id: input.round.decision_batch_id }
        : {}),
      blockers: roundBlockers
    },
    settlement: {
      status:
        input.round.status === "settled" || input.round.status === "published"
          ? "SETTLED"
          : input.round.status === "locked"
            ? "READY"
            : "NOT_STARTED",
      ...(resultId ? { settlement_result_id: resultId } : {})
    },
    publication: {
      status:
        input.round.status === "published"
          ? "PUBLISHED"
          : input.round.status === "settled"
            ? "READY"
            : "NOT_READY",
      visibility_only: true
    },
    teams,
    receipts: {
      ...(input.round.decision_batch_id
        ? {
            lock: {
              status: "LOCKED",
              ...exact,
              decision_batch_id: input.round.decision_batch_id,
              ...(lockLog ? { audit_id: lockLog.audit_id } : {})
            }
          }
        : {}),
      ...(input.settlement
        ? {
            settlement: {
              status: "SETTLED",
              ...exact,
              settlement_result_id: input.settlement.settlement_result_id
            }
          }
        : {}),
      ...(input.round.status === "published"
        ? { publication: { status: "PUBLISHED", ...exact, visibility_only: true } }
        : {})
    },
    debrief_handoff: {
      status:
        input.round.status === "published" && Boolean(input.settlement) ? "READY" : "NOT_READY",
      exact_round_ref: `${exact.tenant_id}/${exact.course_id}/${exact.run_id}/${exact.round_id}`,
      ...(input.settlement
        ? { exact_settlement_ref: `${exact.tenant_id}/${input.settlement.settlement_result_id}` }
        : {}),
      canonical_decision_refs: canonicalDecisionRefs,
      existing_w3_p2b_authority: true
    }
  };
}

export function buildM2P4StudentProjectContext(input: {
  brief: ProjectProfileStudentBrief;
  tenant_id: string;
  course_id: string;
  run_id: string;
  round_id: string;
  round_no: number;
  team_id: string;
}): M2P4StudentProjectContext {
  return {
    schema_version: "m2p4-live-round-ops.v1",
    exact_scope: {
      tenant_id: input.tenant_id,
      course_id: input.course_id,
      run_id: input.run_id,
      round_id: input.round_id,
      round_no: input.round_no,
      team_id: input.team_id
    },
    brief_kind: input.brief.brief_kind,
    title: input.brief.title,
    description: input.brief.description,
    customer_segment: input.brief.customer_segment,
    geography: input.brief.geography,
    industry: input.brief.industry,
    positioning: input.brief.positioning,
    service_bundle: input.brief.service_bundle,
    market_world_reference: structuredClone(input.brief.market_world_reference),
    project_profile_reference: structuredClone(input.brief.project_profile_reference),
    known_limits: [...input.brief.known_limits]
  };
}
