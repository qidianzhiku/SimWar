import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const openapi = yaml.load(readFileSync("contracts/openapi/p0-api.openapi.yaml", "utf8")) as {
  paths: Record<string, Record<string, unknown>>;
};

describe("O10 portfolio changeset request contract", () => {
  it("publishes one tenant-admin query-only endpoint and no Student counterpart", () => {
    const operation = openapi.paths[
      "/api/v1/bff/admin/model-qualification/course-portfolio/changeset-request"
    ]?.post as Record<string, unknown> | undefined;

    expect(operation?.operationId).toBe(
      "MODEL_QUALIFICATION_COURSE_PORTFOLIO_CHANGESET_REQUEST_ADMIN_POST_V1"
    );
    expect(
      openapi.paths["/api/v1/bff/student/model-qualification/course-portfolio/changeset-request"]
    ).toBeUndefined();
    expect(JSON.stringify(operation)).toContain("model-qualification-portfolio-changeset.v1.json");
    expect(JSON.stringify(operation)).toContain("query-only");
  });

  it("freezes non-mutating request, readback, and per-course handoff semantics", () => {
    const schema = JSON.parse(
      readFileSync("contracts/schemas/model-qualification-portfolio-changeset.v1.json", "utf8")
    ) as {
      $defs: Record<string, Record<string, unknown>>;
    };
    const validateInput = new Ajv2020({ allErrors: true, strict: false }).compile({
      $defs: schema.$defs,
      $ref: "#/$defs/requestInput"
    });

    expect(
      validateInput({ course_ids: ["course-1"], expected_portfolio_state_digest: "a".repeat(64) })
    ).toBe(true);
    expect(validateInput({ course_ids: [], expected_portfolio_state_digest: "a".repeat(64) })).toBe(
      false
    );
    expect(schema.$defs.request.properties?.query_only).toEqual({ const: true });
    expect(schema.$defs.request.properties?.request_persisted).toEqual({ const: false });
    expect(schema.$defs.request.properties?.bulk_apply).toEqual({ const: false });
    expect(schema.$defs.request.properties?.cross_course_transaction).toEqual({ const: false });
    expect(schema.$defs.request.properties?.selected_courses).toMatchObject({ type: "array" });
    expect(schema.$defs.response.properties?.handoffs).toMatchObject({ type: "array" });
    expect(schema.$defs.handoff.properties?.handoff_executed).toEqual({ const: false });
    expect(schema.$defs.handoff.properties?.official_truth_write).toEqual({ const: false });
  });

  it("documents Course Authority membership, digest rebase, and no-bulk boundaries", () => {
    const document = readFileSync(
      "docs/contracts/model-qualification-portfolio-changeset.md",
      "utf8"
    );
    expect(document).toContain("Course Authority");
    expect(document).toContain("REBASE_REQUIRED");
    expect(document).toContain("bulk");
    expect(document).toContain("Student");
  });
});
