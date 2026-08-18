import { describe, expect, it } from "vitest";
import {
  W027_FORMAL_ROLE_KEYS,
  W027_ROLE_COMPATIBILITY_MAP,
  normalizeW027RoleKey,
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
      "Quality & Risk"
    ]);
    expect(roster.role_keys).toEqual(["CEO", "CFO", "CMO", "COO"]);
    expect(roster.role_keys).not.toContain("Quality & Risk");
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
    const resolution = await service.proposeResolution(ceo, scope, {
      selected_position_ids: [positions[0]!.position_id],
      source_digest: workspace.divergence!.source_digest,
      preserved_dissent_role_keys: ["CHRO"]
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
