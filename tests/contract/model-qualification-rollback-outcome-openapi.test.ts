import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const openapi = yaml.load(readFileSync("contracts/openapi/p0-api.openapi.yaml", "utf8")) as {
  paths: Record<string, { get?: { responses?: Record<string, unknown> } }>;
};

describe("O8 rollback request outcome canonical contract", () => {
  it("publishes read-only Teacher/Admin outcome routes and an aggregate-safe Student route", () => {
    for (const role of ["teacher", "admin"]) {
      const path = `/api/v1/bff/${role}/model-qualification/evidence-adoptions/rollback-requests/{rollbackRequestId}/outcome`;
      const operation = openapi.paths[path]?.get;
      expect(operation).toBeDefined();
      expect(operation?.responses?.["200"]).toBeDefined();
      expect(operation?.responses?.["404"]).toBeDefined();
      expect(operation?.responses?.["409"]).toBeDefined();
    }
    const student =
      openapi.paths["/api/v1/bff/student/model-qualification/evidence-adoptions/rollback-outcomes"]
        ?.get;
    expect(student).toBeDefined();
    expect(student?.responses?.["200"]).toBeDefined();
    expect(student?.responses?.["403"]).toBeDefined();
  });

  it("compiles the versioned resolution schema and keeps privileged identities out of Student data", () => {
    const schema = JSON.parse(
      readFileSync("contracts/schemas/model-qualification-rollback-outcome.v1.json", "utf8")
    );
    expect(schema.$id).toContain("model-qualification-rollback-outcome.v1.json");
    expect(() => new Ajv2020({ allErrors: true, strict: false }).compile(schema)).not.toThrow();
    const studentProperties = schema.$defs.studentSummary.properties;
    expect(studentProperties).not.toHaveProperty("rollback_request_id");
    expect(studentProperties).not.toHaveProperty("proposal_id");
    expect(studentProperties).not.toHaveProperty("adoption_id");
    expect(studentProperties.visibility.const).toBe("ROLE_SAFE_STUDENT");
    expect(studentProperties.rollback_applied.const).toBe(false);
    expect(studentProperties.official_truth_write.const).toBe(false);
  });

  it("documents immutable outcome, current effect, and historical consistency as separate concepts", () => {
    const document = readFileSync(
      "docs/contracts/model-qualification-evidence-adoption.md",
      "utf8"
    );
    expect(document).toContain("RollbackRequestOutcomeResolution");
    expect(document).toContain("OUTCOME != CURRENT_EFFECT != CONSISTENCY");
    expect(document).toContain("MODEL_QUALIFICATION_ROLLBACK_OUTCOME_STUDENT_GET_V1");
    expect(document).toContain("historical_receipt_rewritten=false");
  });
});
