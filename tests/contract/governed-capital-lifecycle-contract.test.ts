import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

type CapitalLifecycleSchema = {
  $defs: {
    capitalLifecycle: {
      required: string[];
      properties: { status: { enum: string[] } };
    };
  };
};

type OpenApiDocument = {
  paths?: Record<
    string,
    {
      post?: {
        operationId?: string;
        requestBody?: {
          content?: Record<string, { schema?: { $ref?: string } }>;
        };
      };
    }
  >;
  components?: {
    schemas?: Record<string, { required?: string[] }>;
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

  it("declares close, withdraw, and default actions with action-specific payloads", () => {
    const openapi = yaml.load(readText("contracts/openapi/p0-api.openapi.yaml")) as OpenApiDocument;
    const paths = openapi.paths ?? {};
    const schemas = openapi.components?.schemas ?? {};
    const close =
      paths["/api/v1/w4/runs/{runId}/rounds/{roundNo}/capital-lifecycles/{lifecycleId}/close"]
        ?.post;
    const withdraw =
      paths["/api/v1/w4/runs/{runId}/rounds/{roundNo}/capital-lifecycles/{lifecycleId}/withdraw"]
        ?.post;
    const defaultAction =
      paths["/api/v1/w4/runs/{runId}/rounds/{roundNo}/capital-lifecycles/{lifecycleId}/default"]
        ?.post;

    expect(close?.operationId).toBe("W4_CAPITAL_LIFECYCLE_CLOSE_V1");
    expect(withdraw?.operationId).toBe("W4_CAPITAL_LIFECYCLE_WITHDRAW_V1");
    expect(defaultAction?.operationId).toBe("W4_CAPITAL_LIFECYCLE_DEFAULT_V1");
    expect(close?.requestBody?.content?.["application/json"]?.schema?.$ref).toBe(
      "#/components/schemas/W4CapitalLifecycleCloseCommand"
    );
    expect(withdraw?.requestBody?.content?.["application/json"]?.schema?.$ref).toBe(
      "#/components/schemas/W4CapitalLifecycleReasonCommand"
    );
    expect(defaultAction?.requestBody?.content?.["application/json"]?.schema?.$ref).toBe(
      "#/components/schemas/W4CapitalLifecycleReasonCommand"
    );
    expect(schemas.W4CapitalLifecycleCloseCommand?.required).toEqual([
      "command_id",
      "course_id",
      "official_outcome_id",
      "round_id",
      "team_id"
    ]);
    expect(schemas.W4CapitalLifecycleReasonCommand?.required).toEqual([
      "command_id",
      "course_id",
      "reason",
      "round_id",
      "team_id"
    ]);
  });
});
