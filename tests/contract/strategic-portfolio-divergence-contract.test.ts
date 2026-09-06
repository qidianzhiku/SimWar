import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface SchemaNode {
  $defs?: Record<string, SchemaNode>;
  properties?: Record<string, SchemaNode>;
  required?: string[];
  additionalProperties?: boolean;
  minItems?: number;
  maxItems?: number;
  const?: unknown;
}

const schema = JSON.parse(
  readFileSync("contracts/schemas/strategic-portfolio-divergence.v1.json", "utf8")
) as SchemaNode;

describe("SP-O3 strategic portfolio divergence contract", () => {
  it("requires the complete exact M4 selector instead of accepting a partial counterfactual", () => {
    const counterfactual = schema.$defs?.request?.properties?.counterfactual;
    expect(counterfactual?.required).toEqual(
      expect.arrayContaining([
        "source_state_ref",
        "source_outcome_id",
        "paths",
        "horizon_rounds",
        "scenario_package_id",
        "parameter_set_id",
        "engine_id",
        "plugin_ids",
        "seed"
      ])
    );
    expect(counterfactual?.properties?.paths?.minItems).toBe(2);
    expect(counterfactual?.properties?.paths?.maxItems).toBe(3);
    expect(counterfactual?.additionalProperties).toBe(false);
  });

  it("freezes no-winner/no-write policy and keeps Student output allowlisted", () => {
    const teacher = schema.$defs?.teacherEnvelope;
    const policy = teacher?.properties?.envelope?.properties?.policy;
    expect(policy?.properties?.no_winner_selection?.const).toBe(true);
    expect(policy?.properties?.no_official_write?.const).toBe(true);
    expect(teacher?.properties?.authority?.properties?.provider?.const).toBe("OFF");
    expect(teacher?.properties?.authority?.properties?.official_truth_write?.const).toBe(false);

    const student = schema.$defs?.studentEnvelope;
    expect(student?.properties?.exact_context?.required).toEqual(
      expect.arrayContaining(["course_id", "run_id", "team_id", "round_no"])
    );
    expect(student?.properties?.reflection?.required).toEqual(
      expect.arrayContaining(["status", "path_count", "proven_dimensions"])
    );
    expect(student?.properties?.transfer?.properties?.advisory_only?.const).toBe(true);
    expect(student?.properties?.transfer?.properties?.applies_to_next_round?.const).toBe(false);
  });

  it("publishes all four role-specific divergence routes and documents the evidence limits", () => {
    const openapi = readFileSync("contracts/openapi/p0-api.openapi.yaml", "utf8");
    for (const path of [
      "/api/v1/bff/teacher/sp-o3/strategic-portfolio/divergence",
      "/api/v1/bff/teacher/sp-o3/strategic-portfolio/divergence/{candidateId}",
      "/api/v1/bff/admin/sp-o3/strategic-portfolio/divergence/{candidateId}",
      "/api/v1/bff/student/sp-o3/strategic-portfolio/divergence/{candidateId}"
    ]) {
      expect(openapi).toContain(path);
    }
    const docs = readFileSync("docs/contracts/strategic-portfolio-divergence.md", "utf8");
    expect(docs).toContain("NOT_PROVEN");
    expect(docs).toContain("query-only");
    expect(docs).toContain("Student");
  });

  it("exposes an Admin read-only inspection surface without adding a mutation control", () => {
    expect(existsSync("apps/admin/src/StrategicPortfolioDivergencePanel.tsx")).toBe(true);
    const app = readFileSync("apps/admin/src/App.tsx", "utf8");
    expect(app).toContain("StrategicPortfolioDivergencePanel");
    const panel = readFileSync("apps/admin/src/StrategicPortfolioDivergencePanel.tsx", "utf8");
    expect(panel).toContain("/api/v1/bff/admin/sp-o3/strategic-portfolio/divergence/");
    expect(panel).toContain("query-only");
    expect(panel).not.toMatch(
      /(?:button|onClick)[^\n]*(?:apply|winner|best path|official truth)/iu
    );
  });
});
