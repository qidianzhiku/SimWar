import { describe, expect, it } from "vitest";
import type {
  AuditLog,
  Decision,
  DecisionMergeCommit,
  RoleDecisionSection,
  RoleWorkflowEvent,
  Round,
  Run,
  StudentRoleAssignment,
  Team,
  TeamConfirmation
} from "../../packages/shared-contracts/src";
import {
  createCanonicalDecisionSetDigest,
  resolveDecisionAdmissionPolicy,
  resolveFormalCanonicalDecisionSet
} from "../../services/api/src/canonical-decision-admission";
import type {
  RoleWorkflowRepositoryPort,
  RoleWorkflowRepositorySnapshot
} from "../../services/api/src/repository-ports";

const tenantId = "tenant_ca01";
const run: Run = {
  course_id: "course_ca01",
  parameter_set_id: "parameters_ca01",
  run_id: "run_ca01",
  scenario_package_id: "scenario_ca01",
  seed: 7,
  status: "active",
  tenant_id: tenantId
};
const round: Round = {
  round_id: "round_ca01_1",
  round_no: 1,
  run_id: run.run_id,
  status: "locked",
  tenant_id: tenantId
};
const team: Team = {
  captain_user_id: "user_ceo",
  course_id: run.course_id,
  members: [
    { display_name: "CEO", role_slot: "CEO", user_id: "user_ceo" },
    { display_name: "CFO", role_slot: "CFO", user_id: "user_cfo" },
    { display_name: "CMO", role_slot: "CMO", user_id: "user_cmo" },
    { display_name: "COO", role_slot: "COO", user_id: "user_coo" }
  ],
  name: "CA01 Team",
  team_id: "team_ca01",
  tenant_id: tenantId
};

function createSnapshot(
  decisionOrder: Decision[] = [createDecision()]
): RoleWorkflowRepositorySnapshot {
  const roleKeys = ["CEO", "CFO", "CMO", "COO"] as const;
  const assignments: StudentRoleAssignment[] = roleKeys.map((roleKey, index) => ({
    assigned_at: "2026-08-16T05:00:00.000Z",
    assigned_by: "teacher_ca01",
    assignment_id: `assignment_${roleKey}`,
    course_id: run.course_id,
    role_key: roleKey,
    role_template_id: `role_template_${roleKey.toLowerCase()}_v1`,
    run_id: run.run_id,
    source: "teacher_assigned",
    status: "active",
    team_id: team.team_id,
    tenant_id: tenantId,
    user_id: team.members[index]!.user_id
  }));
  const sections: RoleDecisionSection[] = assignments.map((assignment) => ({
    assignment_id: assignment.assignment_id,
    payload: {},
    role_key: assignment.role_key,
    round_id: round.round_id,
    run_id: run.run_id,
    section_id: `section_${assignment.role_key}`,
    status: "ready",
    submitted_at: "2026-08-16T05:00:00.000Z",
    submitted_by: assignment.user_id,
    team_id: team.team_id,
    tenant_id: tenantId,
    updated_at: "2026-08-16T05:00:00.000Z",
    version: 1
  }));
  const merge: DecisionMergeCommit = {
    created_at: "2026-08-16T05:00:00.000Z",
    created_by: "user_ceo",
    merge_commit_id: "merge_ca01",
    merged_payload: {
      capacity_plan: "hold",
      cash_buffer_target: 0.2,
      marketing_budget: 100000,
      pricing: { base_price: 12000 },
      service_quality_budget: 100000,
      strategy_statement: "Canonical admission test plan."
    },
    round_id: round.round_id,
    run_id: run.run_id,
    source_section_ids: sections.map((section) => section.section_id),
    status: "validated",
    team_id: team.team_id,
    tenant_id: tenantId
  };
  const confirmation: TeamConfirmation = {
    confirmed_at: "2026-08-16T05:00:00.000Z",
    confirmed_by: "user_ceo",
    merge_commit_id: merge.merge_commit_id,
    round_id: round.round_id,
    run_id: run.run_id,
    status: "confirmed",
    team_confirmation_id: "confirmation_ca01",
    team_id: team.team_id,
    tenant_id: tenantId
  };
  const event: RoleWorkflowEvent = {
    actor_id: "user_ceo",
    created_at: "2026-08-16T05:00:00.000Z",
    event_id: "event_ca01",
    event_type: "team_confirmed",
    resource_id: confirmation.team_confirmation_id,
    round_id: round.round_id,
    run_id: run.run_id,
    team_id: team.team_id,
    tenant_id: tenantId
  };
  return {
    assignments,
    confirmations: [confirmation],
    course: {
      course_id: run.course_id,
      created_by: "teacher_ca01",
      name: "CA01 Course",
      parameter_set_id: run.parameter_set_id,
      scenario_package_id: run.scenario_package_id,
      status: "active",
      tenant_id: tenantId,
      title: "CA01 Course"
    },
    decisions: decisionOrder,
    events: [event],
    merge_commits: [merge],
    round,
    run,
    sections,
    team
  };
}

function createDecision(id = "decision_ca01"): Decision {
  return {
    canonical_source: "role_merge_commit",
    decision_id: id,
    merge_commit_id: "merge_ca01",
    payload: {
      capacity_plan: "hold",
      cash_buffer_target: 0.2,
      marketing_budget: 100000,
      pricing: { base_price: 12000 },
      service_quality_budget: 100000,
      strategy_statement: "Canonical admission test plan."
    },
    round_id: round.round_id,
    round_no: round.round_no,
    run_id: run.run_id,
    status: "submitted",
    submitted_by: "user_ceo",
    team_confirmation_id: "confirmation_ca01",
    team_id: team.team_id,
    tenant_id: tenantId,
    validation_report: [],
    version: 1
  };
}

function createRoleWorkflowRepository(
  snapshot: RoleWorkflowRepositorySnapshot
): RoleWorkflowRepositoryPort {
  return {
    readRoleWorkflow: async () => snapshot,
    commitRoleWorkflow: async () => undefined
  };
}

describe("PX1-CA-01 canonical admission safety", () => {
  it("separates formal authorization from legacy provenance and never infers missing policy", () => {
    const syntheticAudit: AuditLog = {
      action: "run.create",
      actor_id: "teacher_ca01",
      actor_role: "teacher",
      after: { synthetic_runtime_classification: "synthetic_json_internal.v1" },
      audit_id: "audit_ca01",
      created_at: "2026-08-16T05:00:00.000Z",
      request_id: "request_ca01",
      resource_id: run.run_id,
      resource_type: "run",
      tenant_id: tenantId
    };

    expect(
      resolveDecisionAdmissionPolicy({
        binding: { decision_admission_policy: "ROLE_WORKFLOW_REQUIRED" },
        runCreationAudits: [syntheticAudit]
      })
    ).toEqual({ authority: "formal_run_runtime_binding", policy: "ROLE_WORKFLOW_REQUIRED" });
    expect(
      resolveDecisionAdmissionPolicy({ binding: null, runCreationAudits: [syntheticAudit] })
    ).toEqual({ authority: "synthetic_run_creation_marker", policy: "LEGACY_DIRECT_EXPLICIT" });
    expect(resolveDecisionAdmissionPolicy({ binding: null, runCreationAudits: [] })).toEqual({
      authority: "missing",
      policy: null
    });
    expect(
      resolveDecisionAdmissionPolicy({ binding: {}, runCreationAudits: [syntheticAudit] })
    ).toEqual({ authority: "missing", policy: null });
  });

  it("resolves one exact canonical Decision and is independent of repository order", async () => {
    const first = createSnapshot();
    const second = createSnapshot([createDecision()]);
    second.assignments.reverse();
    second.sections.reverse();
    second.merge_commits.reverse();
    second.confirmations.reverse();
    second.decisions.reverse();

    const left = await resolveFormalCanonicalDecisionSet({
      roleWorkflow: createRoleWorkflowRepository(first),
      round,
      run,
      team,
      tenantId
    });
    const right = await resolveFormalCanonicalDecisionSet({
      roleWorkflow: createRoleWorkflowRepository(second),
      round,
      run,
      team,
      tenantId
    });

    expect(left.decisions).toHaveLength(1);
    expect(left.admission_digest).toBe(right.admission_digest);
    expect(createCanonicalDecisionSetDigest(left.decisions)).toBe(left.admission_digest);
  });

  it("rejects a second settlement-admissible canonical candidate", async () => {
    const first = createDecision("decision_ca01_a");
    const second = createDecision("decision_ca01_b");
    await expect(
      resolveFormalCanonicalDecisionSet({
        roleWorkflow: createRoleWorkflowRepository(createSnapshot([first, second])),
        round,
        run,
        team,
        tenantId
      })
    ).rejects.toMatchObject({ code: "DECISION_ADMISSION_CANONICAL_CONFLICT" });
  });
});
