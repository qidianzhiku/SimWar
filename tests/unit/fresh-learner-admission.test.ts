import { describe, expect, it } from "vitest";
import type { RoleId } from "../../packages/shared-contracts/src";
import { buildFreshLearnerAdmissionReadiness } from "../../services/api/src/fresh-learner-admission";

const roles: RoleId[] = ["CEO", "CFO", "CMO", "COO"];

function teamInput(
  teamId: string,
  offset: number,
  overrides: Partial<Record<RoleId, string>> = {}
) {
  const members = roles.map((role, index) => ({
    role_slot: role,
    user_id: overrides[role] ?? `${teamId}_user_${offset + index}`,
    display_name: `${teamId} ${role}`
  }));
  return {
    team: {
      captain_user_id: members[0]!.user_id,
      course_id: "course_shanghai",
      members,
      name: teamId,
      team_id: teamId,
      tenant_id: "tenant_w022"
    },
    users: members.map((member) => ({ user_id: member.user_id, status: "active" as const })),
    assignments: roles.map((role, index) => ({
      role_key: role,
      status: "active" as const,
      user_id: members[index]!.user_id
    }))
  };
}

describe("fresh learner admission readiness", () => {
  it("admits two complete fresh teams without exposing private fields", () => {
    const result = buildFreshLearnerAdmissionReadiness({
      course_id: "course_shanghai",
      run_id: "run_shanghai",
      teacher_ready: true,
      tenant_id: "tenant_w022",
      teams: [teamInput("team_a", 0), teamInput("team_b", 4)]
    });

    expect(result.admission_status).toBe("READY_FOR_MACHINE_E4");
    expect(result.team_count).toBe(2);
    expect(result.required_roster_count).toBe(8);
    expect(result.assigned_roster_count).toBe(8);
    expect(result.auth_ready).toBe(true);
    expect(result.teams.every((team) => team.missing_roles.length === 0)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("password");
    expect(JSON.stringify(result)).not.toContain("password_hash");
  });

  it("blocks missing, duplicate, inactive, and unassigned roster members", () => {
    const incomplete = teamInput("team_a", 0);
    incomplete.team.members = incomplete.team.members.filter(
      (member) => member.role_slot !== "CMO"
    );
    incomplete.users[1]!.status = "inactive";
    incomplete.assignments = incomplete.assignments.filter(
      (assignment) => assignment.role_key !== "COO"
    );
    incomplete.team.members.push({
      display_name: "duplicate CFO",
      role_slot: "CFO",
      user_id: "team_a_duplicate_cfo"
    });
    incomplete.users.push({ user_id: "team_a_duplicate_cfo", status: "active" });

    const result = buildFreshLearnerAdmissionReadiness({
      course_id: "course_shanghai",
      run_id: "run_shanghai",
      teacher_ready: true,
      tenant_id: "tenant_w022",
      teams: [incomplete]
    });

    expect(result.admission_status).toBe("BLOCKED");
    expect(result.teams[0]!.missing_roles).toContain("CMO");
    expect(result.teams[0]!.duplicate_roles).toContain("CFO");
    expect(result.teams[0]!.auth_ready).toBe(false);
    expect(result.teams[0]!.assigned_role_count).toBe(3);
    expect(result.known_limits).toContain("JSON_INTERNAL_ONLY");
  });
});
