import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PROJECT_PROFILE_READINESS,
  PROJECT_PROFILE_STUDENT_FORBIDDEN_FIELDS
} from "../../packages/shared-contracts/src";

describe("Project Library contract", () => {
  it("freezes exact profile and assignment schema versions", () => {
    const profile = JSON.parse(
      readFileSync("contracts/fixtures/project-profile.valid.json", "utf8")
    ) as Record<string, unknown>;
    const assignment = JSON.parse(
      readFileSync("contracts/fixtures/project-assignment.valid.json", "utf8")
    ) as Record<string, unknown>;

    expect(profile.schema_version).toBe("project-profile.v1");
    expect(assignment.schema_version).toBe("project-assignment.v1");
    expect(profile).toHaveProperty("content_digest");
    expect(profile).toHaveProperty("provenance");
    expect(assignment).toHaveProperty("project_profile_reference");
    expect(JSON.stringify(profile)).not.toMatch(
      /raw_source|private_coefficient|state_true|score|rank|settlement_result|other_team_data/i
    );
  });

  it("keeps readiness and Student forbidden-field boundaries explicit", () => {
    expect(PROJECT_PROFILE_READINESS).toEqual(
      expect.arrayContaining(["READY", "SUCCESSOR_AVAILABLE", "DEPENDENCY_MISSING", "ORPHAN"])
    );
    expect(PROJECT_PROFILE_STUDENT_FORBIDDEN_FIELDS).toEqual(
      expect.arrayContaining(["raw_source_path", "state_true", "other_team_data"])
    );
  });
});
