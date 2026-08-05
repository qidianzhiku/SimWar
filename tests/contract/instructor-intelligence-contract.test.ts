import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;
}

interface OpenApiOperation {
  requestBody?: { content?: { "application/json"?: { schema?: { $ref?: string } } } };
  responses?: Record<string, { content?: { "application/json"?: { schema?: { $ref?: string } } } }>;
}

interface OpenApiDocument {
  paths: Record<string, Record<string, OpenApiOperation>>;
}

describe("Instructor Intelligence executable contract", () => {
  it("accepts the teacher-only kit and rejects private truth fields", () => {
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(
      readJson("contracts/schemas/instructor-intelligence-kit.v1.json")
    );

    expect(validate(readJson("contracts/fixtures/instructor-intelligence-kit.valid.json"))).toBe(
      true
    );
    expect(
      validate(readJson("contracts/fixtures/instructor-intelligence-kit-private.invalid.json"))
    ).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: "additionalProperties",
          params: { additionalProperty: "state_true" }
        })
      ])
    );
    const valid = readJson<Record<string, unknown>>(
      "contracts/fixtures/instructor-intelligence-kit.valid.json"
    );
    const exactRef = valid.source_course_blueprint_ref as Record<string, unknown>;
    for (const resource_id of ["LATEST", "fallback", "unresolved", "*"]) {
      expect(
        validate({ ...valid, source_course_blueprint_ref: { ...exactRef, resource_id } })
      ).toBe(false);
    }
    expect(
      validate({ ...valid, source_course_blueprint_ref: { ...exactRef, version: "1.2.X" } })
    ).toBe(false);
  });

  it("validates the official-source debrief artifact and rejects private truth fields", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    ajv.addSchema(readJson("contracts/schemas/instructor-intelligence-kit.v1.json"));
    const validate = ajv.compile(readJson("contracts/schemas/instructor-debrief-artifact.v1.json"));
    expect(validate(readJson("contracts/fixtures/instructor-debrief-artifact.valid.json"))).toBe(
      true
    );
    expect(validate(readJson("contracts/fixtures/instructor-debrief-artifact.invalid.json"))).toBe(
      false
    );
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: "additionalProperties",
          params: { additionalProperty: "state_true" }
        })
      ])
    );
  });

  it("binds all teacher asset and debrief routes to explicit request and response schemas", () => {
    const openApi = yaml.load(
      readFileSync(resolve("contracts/openapi/p0-api.openapi.yaml"), "utf8")
    ) as OpenApiDocument;
    const draft = openApi.paths["/api/v1/bff/teacher/instructor-assets/drafts"]?.post;
    expect(draft?.requestBody?.content?.["application/json"]?.schema?.$ref).toBe(
      "#/components/schemas/InstructorAssetDraftInput"
    );
    expect(draft?.responses?.["201"]?.content?.["application/json"]?.schema?.$ref).toBe(
      "#/components/schemas/InstructorAssetEnvelope"
    );
    expect(
      openApi.paths["/api/v1/bff/teacher/instructor-assets"]?.get?.responses?.["200"]?.content?.[
        "application/json"
      ]?.schema?.$ref
    ).toBe("#/components/schemas/InstructorAssetListEnvelope");
    expect(
      openApi.paths["/api/v1/bff/teacher/instructor-assets/{assetId}/publish"]?.post?.responses?.[
        "200"
      ]?.content?.["application/json"]?.schema?.$ref
    ).toBe("#/components/schemas/InstructorAssetEnvelope");
    expect(
      openApi.paths["/api/v1/bff/teacher/instructor-assets/{assetId}/publish"]?.post?.requestBody
        ?.content?.["application/json"]?.schema?.$ref
    ).toBe("#/components/schemas/InstructorAssetEmptyInput");
    expect(
      openApi.paths["/api/v1/bff/teacher/instructor-assets/{assetId}/reject"]?.post?.responses?.[
        "200"
      ]?.content?.["application/json"]?.schema?.$ref
    ).toBe("#/components/schemas/InstructorAssetEnvelope");
    expect(
      openApi.paths["/api/v1/bff/teacher/instructor-assets/{assetId}/reject"]?.post?.requestBody
        ?.content?.["application/json"]?.schema?.$ref
    ).toBe("#/components/schemas/InstructorAssetEmptyInput");
    expect(
      openApi.paths["/api/v1/bff/teacher/instructor-assets/{assetId}/revisions"]?.post?.requestBody
        ?.content?.["application/json"]?.schema?.$ref
    ).toBe("#/components/schemas/InstructorAssetRevisionInput");
    expect(
      openApi.paths["/api/v1/bff/teacher/instructor-intelligence"]?.get?.responses?.["200"]
        ?.content?.["application/json"]?.schema?.$ref
    ).toBe("#/components/schemas/InstructorIntelligenceKitEnvelope");
    expect(
      openApi.paths["/api/v1/bff/teacher/instructor-debrief-artifact"]?.get?.responses?.["200"]
        ?.content?.["application/json"]?.schema?.$ref
    ).toBe("#/components/schemas/InstructorDebriefArtifactEnvelope");
    expect(
      openApi.paths["/api/v1/bff/teacher/instructor-debrief-artifact/export"]?.get?.responses?.[
        "200"
      ]?.content?.["application/json"]?.schema?.$ref
    ).toBe("../schemas/instructor-debrief-artifact.v1.json");
  });
});
