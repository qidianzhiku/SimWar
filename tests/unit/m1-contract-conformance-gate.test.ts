import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const yaml = require("js-yaml") as { load: (input: string) => unknown };

const readJson = <T>(path: string): T => JSON.parse(readFileSync(resolve(path), "utf8")) as T;

const readYaml = <T>(path: string): T => yaml.load(readFileSync(resolve(path), "utf8")) as T;

type OpenApiOperation = {
  requestBody?: {
    content?: Record<string, { schema?: { $ref?: string; oneOf?: Array<{ $ref: string }> } }>;
  };
  responses?: Record<
    string,
    {
      content?: Record<string, { schema?: { $ref?: string; oneOf?: Array<{ $ref: string }> } }>;
    }
  >;
};

type OpenApiDocument = {
  paths: Record<string, Record<string, OpenApiOperation>>;
  components?: {
    schemas?: Record<string, { $ref?: string }>;
  };
};

type JsonSchema = Record<string, unknown>;
type JsonObject = Record<string, unknown>;

const openApi = (): OpenApiDocument =>
  readYaml<OpenApiDocument>("contracts/openapi/p0-api.openapi.yaml");

const schema = (path: string): JsonSchema => readJson<JsonSchema>(path);

const fixture = (path: string): unknown => readJson<unknown>(path);

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const asJsonObject = (value: unknown, label: string): JsonObject => {
  expect(value, `${label} should be an object`).toBeTruthy();
  expect(typeof value, `${label} should be an object`).toBe("object");
  expect(Array.isArray(value), `${label} should not be an array`).toBe(false);
  return value as JsonObject;
};

const schemaRef = (name: string): string => `#/components/schemas/${name}`;

const externalSchemaPath = (document: OpenApiDocument, name: string): string => {
  const ref = document.components?.schemas?.[name]?.$ref;
  expect(ref, `missing OpenAPI component schema ${name}`).toBeDefined();
  expect(ref?.startsWith("../schemas/")).toBe(true);
  return `contracts/schemas/${ref?.replace("../schemas/", "")}`;
};

const jsonContentSchema = (operation: OpenApiOperation, status: string) =>
  operation.responses?.[status]?.content?.["application/json"]?.schema;

describe("M1 contract conformance gate", () => {
  it("binds active M1 OpenAPI operations to request, response, and error schemas", () => {
    const document = openApi();
    const decisionPost = document.paths["/api/v1/runs/{runId}/rounds/{roundNo}/decisions"]?.post;
    const resultsGet = document.paths["/api/v1/runs/{runId}/rounds/{roundNo}/results"]?.get;

    expect(decisionPost).toBeDefined();
    expect(resultsGet).toBeDefined();
    expect(decisionPost?.requestBody?.content?.["application/json"]?.schema?.$ref).toBe(
      schemaRef("M1DecisionSubmitRequest")
    );
    expect(jsonContentSchema(decisionPost!, "201")?.$ref).toBe(
      schemaRef("M1DecisionSubmitSuccessEnvelope")
    );
    expect(jsonContentSchema(decisionPost!, "403")?.$ref).toBe(schemaRef("ApiErrorEnvelope"));
    expect(jsonContentSchema(decisionPost!, "404")?.$ref).toBe(schemaRef("ApiErrorEnvelope"));
    expect(jsonContentSchema(decisionPost!, "409")?.$ref).toBe(schemaRef("ApiErrorEnvelope"));
    expect(jsonContentSchema(decisionPost!, "422")?.$ref).toBe(schemaRef("ApiErrorEnvelope"));
    expect(jsonContentSchema(resultsGet!, "200")?.oneOf).toEqual([
      { $ref: schemaRef("M1StudentResultEnvelope") },
      { $ref: schemaRef("M1TeacherAdminResultEnvelope") }
    ]);

    for (const componentName of [
      "ApiErrorEnvelope",
      "M1DecisionSubmitRequest",
      "M1DecisionSubmitSuccessEnvelope",
      "M1StudentResultEnvelope",
      "M1TeacherAdminResultEnvelope",
      "M1PublicReplayEvidence"
    ]) {
      expect(existsSync(resolve(externalSchemaPath(document, componentName)))).toBe(true);
    }
  });

  it("validates positive and negative M1 contract fixtures through executable JSON schemas", () => {
    const ajv = new Ajv2020({ allErrors: true });
    const cases = [
      {
        schemaPath: "contracts/schemas/m1-decision-submit-request.v1.json",
        validFixture: "contracts/fixtures/m1-decision-submit-request.valid.json",
        invalidFixture: "contracts/fixtures/m1-decision-submit-request.invalid.json"
      },
      {
        schemaPath: "contracts/schemas/m1-student-result-envelope.v1.json",
        validFixture: "contracts/fixtures/m1-student-result-envelope.valid.json",
        invalidFixture: "contracts/fixtures/m1-student-result-state-true.invalid.json"
      },
      {
        schemaPath: "contracts/schemas/m1-teacher-admin-result-envelope.v1.json",
        validFixture: "contracts/fixtures/m1-teacher-admin-result-envelope.valid.json",
        invalidFixture: "contracts/fixtures/m1-teacher-admin-result-missing-state-true.invalid.json"
      },
      {
        schemaPath: "contracts/schemas/m1-public-replay-evidence.v1.json",
        validFixture: "contracts/fixtures/m1-public-replay-evidence.valid.json",
        invalidFixture:
          "contracts/fixtures/m1-public-replay-evidence-missing-decision-batch-hash.invalid.json"
      },
      {
        schemaPath: "contracts/schemas/api-error-envelope.v1.json",
        validFixture: "contracts/fixtures/m1-wrong-team-error-envelope.valid.json",
        invalidFixture: "contracts/fixtures/api-error-envelope-missing-code.invalid.json"
      }
    ];

    for (const testCase of cases) {
      const validate = ajv.compile(schema(testCase.schemaPath));
      expect(
        validate(fixture(testCase.validFixture)),
        `${testCase.validFixture} should be valid`
      ).toBe(true);
      expect(
        validate(fixture(testCase.invalidFixture)),
        `${testCase.invalidFixture} should be invalid`
      ).toBe(false);
    }
  });

  it("keeps student result fixtures free of replay-private and truth fields", () => {
    const student = fixture("contracts/fixtures/m1-student-result-envelope.valid.json");
    const serialized = JSON.stringify(student);

    expect(serialized).not.toContain("state_true");
    expect(serialized).not.toContain("decision_batch_hash");
    expect(serialized).not.toContain("json_runtime_source_digest");
    expect(serialized).not.toContain("canonical_evidence_digest");
    expect(serialized).not.toContain("Teacher");
  });

  it("keeps replay_hash allowed while rejecting student replay-private fields", () => {
    const ajv = new Ajv2020({ allErrors: true });
    const validate = ajv.compile(schema("contracts/schemas/m1-student-result-envelope.v1.json"));
    const validStudent = fixture("contracts/fixtures/m1-student-result-envelope.valid.json");
    const studentData = asJsonObject(
      asJsonObject(validStudent, "valid student envelope").data,
      "valid student data"
    );
    const privateReplayMetadata = fixture(
      "contracts/fixtures/m1-student-result-private-replay-metadata.invalid.json"
    );
    const privateReplayData = asJsonObject(
      asJsonObject(privateReplayMetadata, "private replay fixture").data,
      "private replay fixture data"
    );
    const withStudentDataMutation = (mutate: (data: JsonObject) => void): unknown => {
      const draft = cloneJson(validStudent);
      mutate(
        asJsonObject(
          asJsonObject(draft, "student mutation envelope").data,
          "student mutation data"
        )
      );
      return draft;
    };
    const deniedCases = [
      {
        label: "state_true in a student result",
        value: fixture("contracts/fixtures/m1-student-result-state-true.invalid.json")
      },
      {
        label: "replay_evidence with private manifest metadata",
        value: privateReplayMetadata
      },
      {
        label: "decision_batch_hash on student result data",
        value: fixture("contracts/fixtures/m1-student-result-decision-batch-hash.invalid.json")
      },
      {
        label: "json_runtime_source_digest fixture on student result data",
        value: fixture(
          "contracts/fixtures/m1-student-result-json-runtime-source-digest.invalid.json"
        )
      },
      {
        label: "full ReplayManifest fixture on student result data",
        value: fixture("contracts/fixtures/m1-student-result-full-replay-manifest.invalid.json")
      },
      {
        label: "json_runtime_source_digest on student result data",
        value: withStudentDataMutation((data) => {
          data.json_runtime_source_digest = "json-runtime-source-digest";
        })
      },
      {
        label: "canonical_evidence_digest on student result data",
        value: withStudentDataMutation((data) => {
          data.canonical_evidence_digest = privateReplayData.canonical_evidence_digest;
        })
      },
      {
        label: "manifest_hash on student result data",
        value: withStudentDataMutation((data) => {
          data.manifest_hash = asJsonObject(
            privateReplayData.replay_evidence,
            "private replay evidence"
          ).manifest_hash;
        })
      },
      {
        label: "source_result_id on student result data",
        value: withStudentDataMutation((data) => {
          data.source_result_id = asJsonObject(
            privateReplayData.replay_evidence,
            "private replay evidence"
          ).source_result_id;
        })
      }
    ];

    expect(studentData.replay_hash).toBe("replay-hash-demo-001");
    expect(validate(validStudent), "valid student fixture should allow replay_hash").toBe(true);
    for (const testCase of deniedCases) {
      expect(validate(testCase.value), testCase.label).toBe(false);
    }
  });

  it("keeps teacher and admin replay evidence limited to the approved public surface", () => {
    const ajv = new Ajv2020({ allErrors: true });
    const validate = ajv.compile(
      schema("contracts/schemas/m1-teacher-admin-result-envelope.v1.json")
    );

    expect(
      validate(fixture("contracts/fixtures/m1-teacher-admin-result-envelope.valid.json")),
      "teacher/admin fixture should allow the approved public replay evidence surface"
    ).toBe(true);
    expect(
      validate(
        fixture(
          "contracts/fixtures/m1-teacher-admin-result-private-runtime-source-digest.invalid.json"
        )
      ),
      "teacher/admin replay evidence must not grow private runtime-source metadata"
    ).toBe(false);
  });
});
