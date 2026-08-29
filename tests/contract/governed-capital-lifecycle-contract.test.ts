import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type CapitalLifecycleSchema = {
  $defs: {
    capitalLifecycle: {
      required: string[];
      properties: { status: { enum: string[] } };
    };
  };
};

function readJson(path: string): CapitalLifecycleSchema {
  return JSON.parse(readFileSync(path, "utf8")) as CapitalLifecycleSchema;
}

function readText(path: string): string {
  return readFileSync(path, "utf8");
}

describe("R1 governed capital lifecycle contract", () => {
  it("requires an exact scoped capital lifecycle contract and preserves the existing writer authority", () => {
    const schema = readJson("contracts/schemas/w4-enterprise-state.v1.json");
    expect(schema.$defs.capitalLifecycle.required).toEqual([
      "lifecycle_id",
      "tenant_id",
      "course_id",
      "run_id",
      "team_id",
      "round_id",
      "round_no",
      "instrument",
      "status",
      "principal",
      "cost_bps",
      "fee",
      "term_rounds",
      "covenant_min_cash",
      "decision_id",
      "source_digest",
      "official_outcome_id",
      "failure_reason",
      "transition_history",
      "writer_authority"
    ]);
    expect(schema.$defs.capitalLifecycle.properties.status.enum).toEqual([
      "ELIGIBLE",
      "PROPOSED",
      "APPROVED",
      "EXECUTING",
      "CLOSED",
      "WITHDRAWN",
      "DEFAULTED"
    ]);
    const openapi = readText("contracts/openapi/p0-api.openapi.yaml");
    expect(openapi).toContain("W4_CAPITAL_LIFECYCLE_PROPOSE_V1");
    expect(openapi).toContain("W4_CAPITAL_LIFECYCLE_ROLE_PROJECTION_GET_V1");
    expect(openapi).toContain("SOLE_W4_ENTERPRISE_STATE_SERVICE");
  });
});
