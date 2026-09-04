import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const openapi = yaml.load(readFileSync("contracts/openapi/p0-api.openapi.yaml", "utf8")) as {
  paths: Record<string, { get?: unknown; post?: { responses?: Record<string, unknown> } }>;
};

describe("O7 governed rollback request canonical contract", () => {
  it("publishes one Teacher/Admin request endpoint and no Student mutation endpoint", () => {
    for (const role of ["teacher", "admin"]) {
      const operation =
        openapi.paths[
          `/api/v1/bff/${role}/model-qualification/evidence-adoptions/rollback-requests`
        ]?.post;
      expect(operation).toBeDefined();
      expect(operation?.responses?.["200"]).toBeDefined();
      expect(operation?.responses?.["409"]).toBeDefined();
      expect(operation?.responses?.["422"]).toBeDefined();
    }
    expect(
      openapi.paths["/api/v1/bff/student/model-qualification/evidence-adoptions/rollback-requests"]
    ).toBeUndefined();
  });

  it("validates exact dry-run linkage and hard non-effect flags", () => {
    const schema = JSON.parse(
      readFileSync("contracts/schemas/model-qualification-governed-rollback.v1.json", "utf8")
    );
    expect(schema.$id).toContain("model-qualification-governed-rollback.v1.json");
    expect(schema.$defs.governedRollbackRequest.properties.current_selection_changed.const).toBe(
      false
    );
    expect(schema.$defs.governedRollbackRequest.properties.rollback_applied.const).toBe(false);
    expect(schema.$defs.governedRollbackRequest.properties.official_truth_write.const).toBe(false);
    expect(schema.$defs.governedRollbackRequest.properties.history_deleted.const).toBe(false);
    expect(schema.$defs.governedRollbackRequest.properties.historical_receipt_rewritten.const).toBe(
      false
    );
    expect(() => new Ajv2020({ allErrors: true, strict: false }).compile(schema)).not.toThrow();
  });

  it("documents request-not-apply, historical bypass rejection and existing O5 review/disposition", () => {
    const document = readFileSync(
      "docs/contracts/model-qualification-evidence-adoption.md",
      "utf8"
    );
    expect(document).toContain("ROLLBACK_REQUEST_REQUIRED");
    expect(document).toContain("ROLLBACK_DRY_RUN != ROLLBACK_REQUEST");
    expect(document).toContain("ROLLBACK_REQUEST != ADOPTION_PROPOSAL");
    expect(document).toContain("REQUEST_CREATION_WRITES_CURRENT_SELECTION=false");
    expect(document).toContain("npm run test:e2e:ui:o7");
  });
});
