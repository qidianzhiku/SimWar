import { describe, expect, it } from "vitest";
import {
  W027_FORMAL_ROLE_KEYS,
  W027_ROLE_COMPATIBILITY_MAP,
  normalizeW027RoleKey,
  type W027DecisionRightPolicyInput,
  type StudentRoleAssignment
} from "@simwar/shared-contracts";
import { createJsonRepositoryPorts } from "../../services/api/src/json-repository-adapter";
import { createP1Store } from "../../services/api/src/store";
import {
  W027DecisionExperienceService,
  type W027DecisionExperienceActor
} from "../../services/api/src/w027-decision-experience";

const scope = {
  course_id: "course_w027",
  round_id: "round_w027_1",
  run_id: "run_w027",
  team_id: "team_w027",
  tenant_id: "tenant_w027"
};

const teacher: W027DecisionExperienceActor = {
  actor_id: "teacher_w027",
  actor_role: "teacher",
  tenant_id: scope.tenant_id
};

function makeAssignment(
  roleKey: "CEO" | "CFO" | "CMO" | "COO" | "CHRO",
  userId: string
): StudentRoleAssignment {
  return {
    assignment_id: `assignment_${roleKey}`,
    assigned_at: "2026-08-17T00:00:00.000Z",
    assigned_by: teacher.actor_id,
    course_id: scope.course_id,
    role_key: roleKey,
    role_template_id: `role_template_${roleKey.toLowerCase()}_v1`,
    run_id: scope.run_id,
    source: "teacher_assigned",
    status: "active",
    team_id: scope.team_id,
    tenant_id: scope.tenant_id,
    user_id: userId
  };
}

function createFixture() {
  const store = createP1Store();
  store.courses = [
    {
      course_id: scope.course_id,
      tenant_id: scope.tenant_id,
      title: "W027",
      status: "active",
      scenario_package_id: "scenario_demo",
      parameter_set_id: "parameters_demo",
      created_by: teacher.actor_id
    }
  ];
  store.runs = [
    {
      run_id: scope.run_id,
      tenant_id: scope.tenant_id,
      course_id: scope.course_id,
      scenario_package_id: "scenario_demo",
      parameter_set_id: "parameters_demo",
      seed: 27,
      status: "active"
    }
  ];
  store.rounds = [
    {
      round_id: scope.round_id,
      tenant_id: scope.tenant_id,
      run_id: scope.run_id,
      round_no: 1,
      status: "open"
    }
  ];
  const members = (["CEO", "CFO", "CMO", "COO", "CHRO"] as const).map((roleKey) => ({
    display_name: roleKey,
    role_slot: roleKey,
    user_id: `user_${roleKey.toLowerCase()}`
  }));
  store.teams = [
    {
      captain_user_id: "user_ceo",
      course_id: scope.course_id,
      members,
      name: "W027 Team",
      team_id: scope.team_id,
      tenant_id: scope.tenant_id
    }
  ];
  store.studentRoleAssignments = members.map((member) =>
    makeAssignment(member.role_slot, member.user_id)
  );
  store.roleDecisionSections = members.map((member) => ({
    assignment_id: `assignment_${member.role_slot}`,
    payload: { strategy_statement: `${member.role_slot} contribution` },
    role_key: member.role_slot,
    round_id: scope.round_id,
    run_id: scope.run_id,
    section_id: `section_${member.role_slot}`,
    status: "ready" as const,
    submitted_at: "2026-08-17T00:00:00.000Z",
    submitted_by: member.user_id,
    team_id: scope.team_id,
    tenant_id: scope.tenant_id,
    updated_at: "2026-08-17T00:00:00.000Z",
    version: 1
  }));
  const service = new W027DecisionExperienceService({
    createId: (() => {
      let index = 0;
      return (kind) => `${kind}_${++index}`;
    })(),
    now: () => "2026-08-17T00:00:00.000Z",
    repository: createJsonRepositoryPorts(store).decisionExperience!,
    roleWorkflow: createJsonRepositoryPorts(store).roleWorkflow
  });
  return { service, store };
}

describe("W027 decision experience", () => {
  it("uses five formal roles and merges legacy Quality & Risk inputs into COO", async () => {
    expect(W027_FORMAL_ROLE_KEYS).toEqual(["CEO", "CFO", "CMO", "COO", "CHRO"]);
    expect(normalizeW027RoleKey("risk")).toBe("COO");
    expect(normalizeW027RoleKey("Quality & Risk")).toBe("COO");
    expect(W027_ROLE_COMPATIBILITY_MAP).toEqual({ risk: "COO", "Quality & Risk": "COO" });

    const { service } = createFixture();
    const roster = await service.configureRoster(teacher, scope, [
      "CEO",
      "CFO",
      "CMO",
      "COO",
      "CHRO",
      "Quality & Risk"
    ]);
    expect(roster.role_keys).toEqual(["CEO", "CFO", "CMO", "COO", "CHRO"]);
    expect(roster.role_keys).not.toContain("Quality & Risk");
    const configurableCooPolicy: W027DecisionRightPolicyInput = {
      can_acknowledge_resolution: true,
      can_confirm_team_decision: false,
      can_merge_team_decision: false,
      can_propose_resolution: true,
      can_publish_role_position: true,
      can_read_role_workspace: true,
      can_write_private_judgment: true,
      operational_capabilities: ["operations", "quality_control", "risk_register"],
      private_judgment_kinds: ["value", "assumption", "evidence", "risk", "tradeoff"],
      role_key: "COO"
    };
    const configured = await service.configureRoster(
      teacher,
      scope,
      ["CEO", "CFO", "CMO", "COO", "CHRO"],
      [configurableCooPolicy]
    );
    expect(
      configured.decision_right_policies.find((policy) => policy.role_key === "COO")
    ).toMatchObject({ can_propose_resolution: true, role_key: "COO" });
    const cooWorkspace = await service.getStudentWorkspace(
      { actor_id: "user_coo", actor_role: "student", tenant_id: scope.tenant_id },
      scope
    );
    expect(cooWorkspace.context.permissions.can_propose_resolution).toBe(true);
    await service.configureRoster(
      teacher,
      scope,
      ["CEO", "CFO", "CMO", "COO", "CHRO"],
      [
        {
          ...configurableCooPolicy,
          can_read_role_workspace: false,
          can_propose_resolution: false
        }
      ]
    );
    await expect(
      service.getStudentWorkspace(
        { actor_id: "user_coo", actor_role: "student", tenant_id: scope.tenant_id },
        scope
      )
    ).rejects.toMatchObject({ code: "W027_WORKSPACE_READ_DENIED" });
  });

  it("keeps private judgments role-scoped while exposing only team-safe positions", async () => {
    const { service } = createFixture();
    const coo: W027DecisionExperienceActor = {
      actor_id: "user_coo",
      actor_role: "student",
      tenant_id: scope.tenant_id
    };
    const chro: W027DecisionExperienceActor = {
      actor_id: "user_chro",
      actor_role: "student",
      tenant_id: scope.tenant_id
    };
    await service.savePrivateJudgment(coo, scope, {
      kind: "risk",
      statement: "Private quality and risk judgment owned by COO.",
      problem_frame: "Quality drift could undermine the run.",
      assumptions: ["The quality signal is observable."],
      options_considered: ["Add a quality gate", "Accept the drift"],
      trade_offs: ["Control effort versus speed"],
      prediction: "A quality gate reduces drift.",
      confidence: 0.8,
      rationale: "The signal is actionable.",
      status: "ready"
    });
    await service.savePrivateJudgment(chro, scope, {
      kind: "assumption",
      statement: "Private people assumption.",
      status: "ready"
    });
    const cooPosition = await service.saveRolePosition(coo, scope, {
      summary: "COO position",
      risk_flags: ["quality drift"],
      status: "ready"
    });
    const chroPosition = await service.saveRolePosition(chro, scope, {
      summary: "CHRO position",
      assumptions: ["capability grows"],
      status: "ready"
    });
    const workspace = await service.getStudentWorkspace(coo, scope);
    expect(workspace.private_judgments).toHaveLength(1);
    expect(workspace.private_judgments[0]?.statement).toContain("quality and risk");
    expect(workspace.private_judgments[0]).toMatchObject({
      confidence: 0.8,
      problem_frame: "Quality drift could undermine the run.",
      rationale: "The signal is actionable."
    });
    expect(workspace.context.role_key).toBe("COO");
    expect(workspace.context.permissions.operational_capabilities).toEqual(
      expect.arrayContaining(["quality_control", "risk_register"])
    );
    expect(workspace.context.permissions.can_write_private_judgment).toBe(true);
    expect(workspace.context.permissions.can_publish_role_position).toBe(true);
    expect(workspace.context.permissions.can_propose_resolution).toBe(false);
    expect(workspace.team_safe_positions.map((position) => position.position_id)).toEqual([
      cooPosition.position_id,
      chroPosition.position_id
    ]);
    expect(workspace.team_safe_positions.every((position) => !("created_by" in position))).toBe(
      true
    );
    expect(workspace.known_limits).toContain("QUALITY_RISK_MERGED_INTO_COO");
    const teacherWorkspace = await service.getTeacherWorkspace(teacher, scope);
    expect(teacherWorkspace.private_judgment_summary).toHaveLength(2);
    expect(JSON.stringify(teacherWorkspace)).not.toContain("Private quality and risk judgment");
  });

  it("builds divergence v2 across value, assumption, evidence, risk and tradeoff and preserves dissent", async () => {
    const { service } = createFixture();
    const ceo: W027DecisionExperienceActor = {
      actor_id: "user_ceo",
      actor_role: "student",
      tenant_id: scope.tenant_id
    };
    const cfo: W027DecisionExperienceActor = {
      actor_id: "user_cfo",
      actor_role: "student",
      tenant_id: scope.tenant_id
    };
    const chro: W027DecisionExperienceActor = {
      actor_id: "user_chro",
      actor_role: "student",
      tenant_id: scope.tenant_id
    };
    for (const actor of [ceo, cfo]) {
      for (const kind of ["value", "assumption", "evidence", "risk", "tradeoff"] as const) {
        await service.savePrivateJudgment(actor, scope, {
          kind,
          statement: `${actor.actor_id} ${kind}`,
          status: "ready"
        });
      }
    }
    const positions = await Promise.all([
      service.saveRolePosition(ceo, scope, {
        summary: "CEO value",
        assumptions: ["A"],
        evidence_refs: ["E1"],
        risk_flags: ["R1"],
        tradeoffs: ["T1"],
        status: "ready"
      }),
      service.saveRolePosition(cfo, scope, {
        summary: "CFO value",
        assumptions: ["B"],
        evidence_refs: ["E2"],
        risk_flags: ["R2"],
        tradeoffs: ["T2"],
        status: "ready"
      })
    ]);
    const workspace = await service.getStudentWorkspace(ceo, scope);
    expect(workspace.divergence?.schema_version).toBe("w027-team-divergence.v2");
    expect(workspace.divergence?.divergences.map((row) => row.dimension)).toEqual([
      "value",
      "assumption",
      "evidence",
      "risk",
      "tradeoff"
    ]);
    await service.configureRoster(
      teacher,
      scope,
      ["CEO", "CFO", "CMO", "COO", "CHRO"],
      [
        {
          can_acknowledge_resolution: true,
          can_confirm_team_decision: false,
          can_merge_team_decision: false,
          can_propose_resolution: true,
          can_publish_role_position: true,
          can_read_role_workspace: true,
          can_write_private_judgment: true,
          operational_capabilities: [],
          private_judgment_kinds: ["value", "assumption", "evidence", "risk", "tradeoff"],
          role_key: "CEO"
        }
      ]
    );
    await expect(
      service.proposeResolution(ceo, scope, {
        affected_divergence_ids: workspace.divergence!.divergences.map(
          (divergence) => divergence.divergence_id
        ),
        rationale: "A compromise without explicit authority must be rejected.",
        resolution_mode: "EXPLICIT_TEAM_COMPROMISE",
        risk: "Unreviewed compromise could conceal a material divergence.",
        selected_option: "Split the capacity budget.",
        selected_position_ids: [positions[0]!.position_id],
        source_digest: workspace.divergence!.source_digest,
        supporting_evidence_refs: ["evidence:capacity"],
        trade_off: "Speed versus control."
      })
    ).rejects.toMatchObject({ code: "W027_COMPROMISE_NOT_AUTHORIZED" });
    await service.configureRoster(
      teacher,
      scope,
      ["CEO", "CFO", "CMO", "COO", "CHRO"],
      [
        {
          can_acknowledge_resolution: true,
          can_confirm_team_decision: false,
          can_merge_team_decision: false,
          can_propose_resolution: true,
          can_publish_role_position: true,
          can_read_role_workspace: true,
          can_write_private_judgment: true,
          operational_capabilities: ["explicit_team_compromise"],
          private_judgment_kinds: ["value", "assumption", "evidence", "risk", "tradeoff"],
          role_key: "CEO"
        }
      ]
    );
    const resolution = await service.proposeResolution(ceo, scope, {
      affected_divergence_ids: workspace.divergence!.divergences.map(
        (divergence) => divergence.divergence_id
      ),
      rationale: "Balance the selected evidence while preserving dissent.",
      resolution_mode: "EXPLICIT_TEAM_COMPROMISE",
      risk: "The compromise may reduce short-term speed.",
      selected_option: "Balance control and speed.",
      selected_position_ids: [positions[0]!.position_id],
      source_digest: workspace.divergence!.source_digest,
      supporting_evidence_refs: ["evidence:capacity"],
      trade_off: "Control effort versus delivery speed.",
      preserved_dissent_role_keys: ["CHRO"]
    });
    expect(resolution).toMatchObject({
      authority_role_key: "CEO",
      resolution_mode: "EXPLICIT_TEAM_COMPROMISE",
      selected_option: "Balance control and speed."
    });
    await service.acknowledgeResolution(chro, scope, {
      resolution_id: resolution.resolution_id,
      status: "DISSENT_PRESERVED",
      dissent_note: "CHRO records a different people-risk view."
    });
    const finalWorkspace = await service.getStudentWorkspace(chro, scope);
    expect(finalWorkspace.resolution?.preserved_dissent_role_keys).toContain("CHRO");
    expect(finalWorkspace.trace.schema_version).toBe("w027-decision-trace.v2");
    expect(finalWorkspace.trace.stages.map((stage) => stage.stage_key)).toContain(
      "DISSENT_PRESERVED_V2"
    );
  });
});
