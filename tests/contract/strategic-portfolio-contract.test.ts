import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

describe("W4 strategic portfolio contract", () => {
  it("accepts the derived exact-scope fixture and rejects authority violations", () => {
    const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(
      readJson("contracts/schemas/strategic-portfolio.v1.json")
    );
    const valid = readJson<Record<string, unknown>>(
      "contracts/fixtures/strategic-portfolio.valid.json"
    );
    expect(validate(valid)).toBe(true);
    const invalid = structuredClone(valid);
    (invalid.persistence as Record<string, unknown>).historical_decision_reentry = true;
    expect(validate(invalid)).toBe(false);
  });

  it("accepts the parent-linked state references emitted by W4 closing and opening paths", () => {
    const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(
      readJson("contracts/schemas/strategic-portfolio.v1.json")
    );
    const valid = readJson<Record<string, unknown> & { persistence: Record<string, unknown> }>(
      "contracts/fixtures/strategic-portfolio.valid.json"
    );
    const parentRef = {
      tenant_id: "tenant_demo",
      course_id: "course_demo",
      run_id: "run_demo",
      team_id: "team_alpha",
      round_id: "round_1",
      enterprise_state_id: "state_1",
      version: 1,
      state_digest: "b".repeat(64),
      parent_state_ref: null
    };
    valid.persistence.opening_state_ref = {
      ...parentRef,
      enterprise_state_id: "state_2",
      round_id: "round_2",
      state_digest: "c".repeat(64),
      parent_state_ref: parentRef
    };
    expect(validate(valid)).toBe(true);
  });

  it("rejects a project profile reference with a non-canonical digest", () => {
    const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(
      readJson("contracts/schemas/strategic-portfolio.v1.json")
    );
    const valid = readJson<Record<string, unknown> & { members: Array<Record<string, unknown>> }>(
      "contracts/fixtures/strategic-portfolio.valid.json"
    );
    const invalid = structuredClone(valid);
    invalid.members = [
      {
        project_entry_id: "entry-1",
        initiative_id: "initiative-1",
        source_assignment_id: "assignment-1",
        project_profile_reference: {
          content_digest: "a".repeat(64),
          project_profile_id: "profile-1",
          tenant_id: "tenant_demo",
          version: "2026-08-21.1"
        },
        project_name: "Project One",
        lifecycle_status: "Opportunity",
        ownership_status: "owned",
        ramp: 0.5,
        activation_round_no: 1,
        dependency_project_entry_ids: []
      }
    ];
    const reference = invalid.members[0]?.project_profile_reference as Record<string, unknown>;
    reference.content_digest = "dead-beef";
    expect(validate(invalid)).toBe(false);
  });

  it("binds the portfolio projection and dependency input to the existing W4 OpenAPI surface", () => {
    const openApi = readFileSync("contracts/openapi/p0-api.openapi.yaml", "utf8");
    expect(openApi).toContain(
      'schema: { $ref: "#/components/schemas/W4ProjectPortfolioEntryCreateRequest" }'
    );
    expect(openApi).toContain(
      'W4StrategicPortfolioProjection:\n      $ref: "../schemas/strategic-portfolio.v1.json"'
    );
    expect(openApi).toContain(
      'W4PortfolioProjectionEnvelope:\n      type: object'
    );
    expect(openApi).toContain(
      'required: [strategic_portfolio]\n          properties:\n            strategic_portfolio: { $ref: "#/components/schemas/W4StrategicPortfolioProjection" }'
    );
    expect(openApi).toContain(
      "dependency_project_entry_ids:\n          type: array\n          items: { type: string, minLength: 1 }"
    );
  });
});
