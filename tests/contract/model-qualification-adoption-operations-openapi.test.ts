import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const openapi = yaml.load(readFileSync("contracts/openapi/p0-api.openapi.yaml", "utf8")) as {
  paths: Record<string, { get?: unknown; post?: unknown }>;
};

describe("O6 adoption operations canonical contract", () => {
  it("publishes governed Teacher/Admin operations and a read-only Student projection", () => {
    for (const role of ["teacher", "admin"]) {
      expect(
        openapi.paths[`/api/v1/bff/${role}/model-qualification/adoption-operations`]?.get
      ).toBeDefined();
      expect(
        openapi.paths[
          `/api/v1/bff/${role}/model-qualification/adoption-operations/drift-assessments`
        ]?.post
      ).toBeDefined();
      expect(
        openapi.paths[
          `/api/v1/bff/${role}/model-qualification/adoption-operations/rollback-dry-runs`
        ]?.post
      ).toBeDefined();
    }
    expect(
      openapi.paths["/api/v1/bff/student/model-qualification/adoption-operations"]?.get
    ).toBeDefined();
  });

  it("validates versioned operations projections and hard non-effect flags", () => {
    const schema = JSON.parse(
      readFileSync("contracts/schemas/model-qualification-adoption-operations.v1.json", "utf8")
    );
    expect(schema.$id).toContain("model-qualification-adoption-operations.v1.json");
    expect(schema.$defs.driftAssessment.properties.adoption_mutation.const).toBe(false);
    expect(schema.$defs.driftAssessment.properties.official_truth_write.const).toBe(false);
    expect(schema.$defs.rollbackDryRun.properties.rollback_applied.const).toBe(false);
    expect(schema.$defs.rollbackDryRun.properties.history_deleted.const).toBe(false);
    expect(schema.$defs.rollbackDryRun.properties.historical_receipt_rewritten.const).toBe(false);
    expect(schema.$defs.studentProjection).not.toHaveProperty("properties.adoption_state_digest");
    expect(() => new Ajv2020({ allErrors: true, strict: false }).compile(schema)).not.toThrow();

    const validateEpoch = new Ajv2020({ allErrors: true, strict: false }).compile({
      $schema: schema.$schema,
      $defs: schema.$defs,
      $ref: "#/$defs/epoch"
    });
    expect(
      validateEpoch({
        tenant_id: "tenant-a",
        course_id: "course-a",
        source_package_id: "source-a",
        source_content_digest: "a".repeat(64),
        calibration_dataset_id: "dataset-a",
        calibration_dataset_content_digest: "b".repeat(64),
        qualification_id: "qualification-a",
        qualification_content_digest: "c".repeat(64),
        model_version_reference: {
          model_version_id: "model-a",
          version: "1.0.0",
          content_digest: "d".repeat(64)
        },
        model_artifact_reference: {
          artifact_id: "artifact-a",
          content_digest: "e".repeat(64),
          format: "typescript-boundary",
          source_ref: "artifact://model-a"
        },
        source_expires_at: null,
        epoch_digest: "f".repeat(64)
      })
    ).toBe(true);
  });

  it("documents digest movement as a successful REBASE_REQUIRED receipt, not an HTTP 409", () => {
    for (const role of ["teacher", "admin"]) {
      const post = openapi.paths[
        `/api/v1/bff/${role}/model-qualification/adoption-operations/drift-assessments`
      ]?.post as { responses?: Record<string, unknown> };
      expect(post.responses?.["200"]).toBeDefined();
      expect(post.responses?.["409"]).toBeUndefined();
    }
  });
});
