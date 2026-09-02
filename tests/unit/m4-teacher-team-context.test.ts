import { describe, expect, it } from "vitest";
import {
  buildTeacherW3Context,
  resolveActiveTeacherTeamId
} from "../../apps/teacher/src/teacher-team-context";

describe("M4 teacher team context", () => {
  it("keeps the active selection bound to the selected team instead of the first course team", () => {
    const teams = [{ team_id: "team_alpha" }, { team_id: "team_beta" }];

    expect(resolveActiveTeacherTeamId(teams, "team_beta")).toBe("team_beta");
    expect(resolveActiveTeacherTeamId(teams, undefined, "team_beta")).toBe("team_beta");
    expect(resolveActiveTeacherTeamId(teams, "team_missing", "team_missing")).toBe("team_alpha");
  });

  it("binds W3 context to the active team instead of the first team or query team", () => {
    expect(
      buildTeacherW3Context(
        {
          course_id: "course-001",
          role_key: "CFO",
          round_id: "round-002",
          round_no: 2,
          run_id: "run-001",
          team_id: "team_beta",
          tenant_id: "tenant-001"
        },
        {
          activity_id: "activity_consequence",
          course_id: "course-001",
          role_key: "CEO",
          round_id: "round-001",
          round_no: 1,
          run_id: "run-001",
          team_id: "team_alpha",
          tenant_id: "tenant-001"
        }
      )
    ).toEqual({
      activity_id: "activity_consequence",
      course_id: "course-001",
      role_key: "CFO",
      round_id: "round-002",
      round_no: 2,
      run_id: "run-001",
      team_id: "team_beta",
      tenant_id: "tenant-001"
    });
  });

  it("preserves a validated query context until the app has a selected state", () => {
    const queryContext = {
      activity_id: "activity_consequence",
      course_id: "course-001",
      role_key: "CEO",
      round_id: "round-001",
      round_no: 1,
      run_id: "run-001",
      team_id: "team_alpha",
      tenant_id: "tenant-001"
    };

    expect(buildTeacherW3Context(undefined, queryContext)).toEqual(queryContext);
  });
});
