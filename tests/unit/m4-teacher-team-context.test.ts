import { describe, expect, it } from "vitest";
import { resolveActiveTeacherTeamId } from "../../apps/teacher/src/teacher-team-context";

describe("M4 teacher team context", () => {
  it("keeps the active selection bound to the selected team instead of the first course team", () => {
    const teams = [{ team_id: "team_alpha" }, { team_id: "team_beta" }];

    expect(resolveActiveTeacherTeamId(teams, "team_beta")).toBe("team_beta");
    expect(resolveActiveTeacherTeamId(teams, undefined, "team_beta")).toBe("team_beta");
    expect(resolveActiveTeacherTeamId(teams, "team_missing", "team_missing")).toBe("team_alpha");
  });
});
